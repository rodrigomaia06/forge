import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ForgeSheetScrollView } from '../ui/ForgeSheetScrollView';
import { ForgeCard, ForgeText as Text, ForgePressable as Pressable, Icon, Button } from '../ui';
import { HistorySetRow } from '../../screens/activeWorkout/HistorySetRow';
import { SetDetailsCard } from '../../screens/activeWorkout/SetDetailsCard';
import { effectiveTracking } from '../../domain/exercises/tracking';
import {
  exerciseSessions,
  type ExerciseSession,
  type ProgressPoint,
} from '../../domain/exercises/progress';
import type { Workout, WorkoutExercise, WorkoutSet, TrackingType } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';

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
        <Pressable
          accessibilityRole={onOpenWorkout ? 'button' : undefined}
          accessibilityLabel={onOpenWorkout ? `Open ${workout.name}` : undefined}
          onPress={() => onOpenWorkout?.(workout.id)}
          style={styles.header}
        >
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{workout.name}</Text>
            <Text style={[styles.caption, { color: theme.textSecondary }]}>
              {new Date(workout.startedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          {onOpenWorkout ? (
            <Icon name="chevron-forward" size={22} color={theme.textSecondary} />
          ) : null}
        </Pressable>
        {point && onSelectOverride ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Session filtering: ${status}, ${workout.name}`}
            onPress={() => onSelectOverride(workout.id)}
            style={styles.status}
          >
            <Icon
              name={point.excluded ? 'filter' : 'check'}
              size={18}
              color={theme.textSecondary}
            />
            <Text style={[typeScale.controlLabel, { color: theme.textSecondary }]}>{status}</Text>
            <Icon name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
        {exercises.map((block) => (
          <View key={block.id}>
            {block.offSession ? (
              <Text style={[styles.caption, { color: theme.textSecondary, paddingHorizontal: 14 }]}>
                Off-session · not used for progress
              </Text>
            ) : null}
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
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 14 },
  card: { padding: 0, overflow: 'hidden' },
  header: { minHeight: 64, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, gap: 4 },
  title: { ...typeScale.cardTitle },
  caption: { ...typeScale.label },
  status: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
