import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ForgeSheetScrollView } from '../ui/ForgeSheetScrollView';
import { ForgeCard, ForgeText as Text, ForgePressable as Pressable, Icon, Button } from '../ui';
import { HistorySetRow } from '../../screens/activeWorkout/HistorySetRow';
import { SetDetailsCard } from '../../screens/activeWorkout/SetDetailsCard';
import { effectiveTracking, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import {
  exerciseSessions,
  type ExerciseSession,
  type ProgressPoint,
} from '../../domain/exercises/progress';
import type { Workout, WorkoutExercise, WorkoutSet, TrackingType } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';

export function ExerciseHistory({
  exercise,
  workouts,
  excludeWorkoutId,
  onOpenWorkout,
  showAll: controlledShowAll,
  onShowAllChange,
  scrollOffset = 0,
  onScrollOffsetChange,
  points = [],
  onSelectOverride,
}: {
  exercise: WorkoutExercise;
  workouts: readonly Workout[];
  excludeWorkoutId?: string;
  onOpenWorkout?: (id: string) => void;
  showAll?: boolean;
  onShowAllChange?: (value: boolean) => void;
  scrollOffset?: number;
  onScrollOffsetChange?: (value: number) => void;
  points?: readonly ProgressPoint[];
  onSelectOverride?: (id: string) => void;
}) {
  const theme = useForgeTheme();
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [openSet, setOpenSet] = useState<{
    set: WorkoutSet;
    index: number;
    trackingType: TrackingType;
  } | null>(null);
  const showAll = controlledShowAll ?? expanded;
  const listRef = useRef<FlatList<ExerciseSession>>(null);
  const previewRef = useRef<ScrollView>(null);
  const restored = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const initialOffset = useRef(scrollOffset);
  const sessions = useMemo(
    () =>
      exerciseSessions(exercise, workouts)
        .filter((session) => session.workout.id !== excludeWorkoutId)
        .reverse(),
    [exercise, workouts, excludeWorkoutId],
  );
  const pointById = useMemo(
    () => new Map(points.map((point) => [point.workoutId, point])),
    [points],
  );
  const restore = () => {
    if (restored.current || !initialOffset.current) return;
    requestAnimationFrame(() => {
      if (showAll)
        listRef.current?.scrollToOffset({ offset: initialOffset.current, animated: false });
      else previewRef.current?.scrollTo({ y: initialOffset.current, animated: false });
    });
  };
  useEffect(() => {
    // Restore after sheet layout settles; early offsets can be clamped by the first list window.
    const timer = setTimeout(restore, 250);
    return () => clearTimeout(timer);
  }, [showAll]);
  const recordScroll = (offset: number) => {
    if (!mounted.current) return;
    if (!restored.current && initialOffset.current > 0) {
      if (Math.abs(offset - initialOffset.current) > 1) {
        restore();
        return;
      }
      restored.current = true;
    }
    onScrollOffsetChange?.(offset);
  };
  const renderSession = ({ workout, exercises }: ExerciseSession) => {
    const point = pointById.get(workout.id);
    const status =
      point?.override === 'exclude'
        ? 'Excluded'
        : point?.automatic && point.override !== 'include'
          ? 'Auto-filtered'
          : point?.override === 'include'
            ? 'Included'
            : 'Auto';
    return (
      <ForgeCard
        testID={`previous-session-card-${workout.id}`}
        variant="nested"
        style={styles.card}
      >
        <View style={styles.header}>
        <Pressable
          accessibilityRole={onOpenWorkout ? 'button' : undefined}
          accessibilityLabel={onOpenWorkout ? `Open ${workout.name}` : undefined}
          onPress={() => onOpenWorkout?.(workout.id)}
          style={styles.workoutAction}
        >
          <View style={styles.copy}>
            <Text numberOfLines={2} style={[styles.title, { color: theme.textPrimary }]}>{workout.name}</Text>
            <Text style={[styles.caption, { color: theme.textSecondary }]}>
              {new Date(workout.startedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </Pressable>
        {point && onSelectOverride ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Session filtering: ${status}, ${workout.name}`}
            onPress={() => onSelectOverride(workout.id)}
            style={[styles.status, { backgroundColor: theme.surfaceMuted }]}
          >
            <Icon
              name="filter"
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : null}
        {onOpenWorkout ? <Icon name="chevron-forward" size={18} color={theme.textSecondary} /> : null}
        </View>
        {exercises.map((block) => (
          <View key={block.id}>
            {block.offSession ? (
              <Text style={[styles.caption, { color: theme.textSecondary, paddingHorizontal: 14 }]}>
                Off-session
              </Text>
            ) : null}
            <View style={styles.setHeader}>
              <Text style={[styles.setColumn, styles.caption, { color: theme.textSecondary }]}>Set</Text>
              {trackingFields[effectiveTracking(block)].map(kind => (
                <Text key={kind} style={[styles.measurementColumn, styles.caption, { color: theme.textSecondary }]}>
                  {trackingFieldLabel(effectiveTracking(block), kind)}
                </Text>
              ))}
            </View>
            {block.sets.map((set, index) => (
              <View key={set.id}>
                {!set.completed ||
                (set.sideCompletion && (!set.sideCompletion.left || !set.sideCompletion.right)) ? (
                  <Text
                    style={[styles.caption, { color: theme.textSecondary, paddingHorizontal: 14 }]}
                  >
                    Incomplete
                  </Text>
                ) : null}
                <HistorySetRow
                  set={set}
                  index={index}
                  compact
                  isLast={index === block.sets.length - 1}
                  trackingType={effectiveTracking(block)}
                  onOpenDetails={() =>
                    setOpenSet({ set, index, trackingType: effectiveTracking(block) })
                  }
                />
              </View>
            ))}
          </View>
        ))}
      </ForgeCard>
    );
  };
  return (
    <>
      {showAll ? (
        <View style={{ height: height * 0.66, flexShrink: 1 }} testID="exercise-history-expanded">
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={sessions}
            keyExtractor={(item) => item.workout.id}
            renderItem={({ item }) => renderSession(item)}
            contentContainerStyle={styles.content}
            initialNumToRender={4}
            windowSize={5}
            maxToRenderPerBatch={4}
            onContentSizeChange={restore}
            onLayout={restore}
            onScroll={(event) => recordScroll(event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={[styles.caption, { color: theme.textSecondary }]}>
                No completed sessions for this exercise yet.
              </Text>
            }
          />
        </View>
      ) : (
        <ForgeSheetScrollView
          testID="previous-sessions-scroll"
          dragToDismiss={false}
          ref={previewRef}
          contentContainerStyle={styles.content}
          onContentSizeChange={restore}
          onLayout={restore}
          onScroll={(event) => recordScroll(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          {sessions.slice(0, 3).map((session) => (
            <View key={session.workout.id}>{renderSession(session)}</View>
          ))}
          {sessions.length > 3 ? (
            <Button
              label={`Show ${sessions.length - 3} more`}
              accessibilityLabel={`Show ${sessions.length - 3} more sessions`}
              variant="secondary"
              onPress={() => {
                initialOffset.current = 0;
                restored.current = false;
                onScrollOffsetChange?.(0);
                if (onShowAllChange) onShowAllChange(true);
                else setExpanded(true);
              }}
            />
          ) : null}
          {!sessions.length ? (
            <Text style={[styles.caption, { color: theme.textSecondary }]}>
              No completed sessions for this exercise yet.
            </Text>
          ) : null}
        </ForgeSheetScrollView>
      )}
      {openSet ? (
        <SetDetailsCard
          visible
          set={openSet.set}
          index={openSet.index}
          editable={false}
          onChange={() => undefined}
          onDelete={() => undefined}
          onDone={() => setOpenSet(null)}
          trackingType={openSet.trackingType}
        />
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: scaleUI(20), paddingTop: scaleUI(4), paddingBottom: scaleUI(24), gap: scaleUI(12) },
  card: { padding: 0, overflow: 'hidden' },
  header: { paddingHorizontal: scaleUI(12), flexDirection: 'row', alignItems: 'center', gap: scaleUI(8) },
  workoutAction: { flex: 1, minWidth: 0, minHeight: 56, justifyContent: 'center', paddingVertical: scaleUI(8), borderRadius: scaleUI(12) },
  copy: { minWidth: 0, gap: scaleUI(2) },
  title: { ...typeScale.cardTitle },
  caption: { ...typeScale.label },
  setHeader: { paddingHorizontal: scaleUI(12), minHeight: scaleUI(24), flexDirection: 'row', alignItems: 'center', gap: 6 },
  setColumn: { width: 46, textAlign: 'center' },
  measurementColumn: { flex: 1, minWidth: 0, textAlign: 'center' },
  status: {
    minHeight: 44,
    width: 44,
    borderRadius: scaleUI(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
