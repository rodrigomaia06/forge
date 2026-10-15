import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { ForgeSheetScrollView } from '../ui/ForgeSheetScrollView';
import { ForgeCard, ForgeText as Text, ForgePressable as Pressable, Icon, Button } from '../ui';
import { HistorySetRow } from '../../screens/activeWorkout/HistorySetRow';
import { SetDetailsCard } from '../../screens/activeWorkout/SetDetailsCard';
import {
  effectiveTracking,
  trackingFieldLabel,
  trackingFields,
} from '../../domain/exercises/tracking';
import { exerciseSessions, type ExerciseSession } from '../../domain/exercises/progress';
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
  presentation = 'sheet',
  bottomInset = 0,
  onPageScroll,
}: {
  presentation?: 'sheet' | 'screen';
  bottomInset?: number;
  onPageScroll?: (offset: number) => void;
  exercise: WorkoutExercise;
  workouts: readonly Workout[];
  excludeWorkoutId?: string;
  onOpenWorkout?: (id: string) => void;
  showAll?: boolean;
  onShowAllChange?: (value: boolean) => void;
  scrollOffset?: number;
  onScrollOffsetChange?: (value: number) => void;
}) {
  const theme = useForgeTheme();
  const focused = useIsFocused();
  const latestOffset = useRef(scrollOffset);
  const openingWorkout = useRef(false);
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [openSet, setOpenSet] = useState<{
    set: WorkoutSet;
    index: number;
    trackingType: TrackingType;
  } | null>(null);
  const page = presentation === 'screen';
  const showAll = controlledShowAll ?? expanded;
  const PreviewScroll = page ? ScrollView : ForgeSheetScrollView;
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
  useEffect(() => {
    if (!focused) return;
    openingWorkout.current = false;
    initialOffset.current = latestOffset.current;
    restored.current = false;
    const timer = setTimeout(restore, 250);
    return () => clearTimeout(timer);
  }, [focused]);
  const sessions = useMemo(
    () =>
      exerciseSessions(exercise, workouts)
        .filter((session) => session.workout.id !== excludeWorkoutId)
        .map((session) => ({
          ...session,
          exercises: session.exercises.filter((block) => block.sets.some(isCompletedSet)),
        }))
        .filter((session) => session.exercises.length > 0)
        .reverse(),
    [exercise, workouts, excludeWorkoutId],
  );
  const restore = () => {
    if (restored.current || !initialOffset.current) return;
    // A hidden web route can reset FlatList's window while the browser retains
    // its DOM offset. Move one pixel so restoration also refreshes that window.
    if (showAll && Platform.OS === 'web') {
      listRef.current?.scrollToOffset({
        offset: Math.max(0, initialOffset.current - 1),
        animated: false,
      });
    }
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
    if (!mounted.current || !focused || openingWorkout.current) return;
    if (!restored.current && initialOffset.current > 0) {
      if (Math.abs(offset - initialOffset.current) > 1) {
        restore();
        return;
      }
      restored.current = true;
    }
    onScrollOffsetChange?.(offset);
    latestOffset.current = offset;
    onPageScroll?.(offset);
  };
  const SessionSurface = ForgeCard;
  const renderSession = ({ workout, exercises }: ExerciseSession) => {
    return (
      <SessionSurface
        testID={`previous-session-card-${workout.id}`}
        variant={page ? 'base' : 'nested'}
        style={styles.card}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole={onOpenWorkout ? 'button' : undefined}
            accessibilityLabel={onOpenWorkout ? `Open ${workout.name}` : undefined}
            onPress={() => {
              if (!onOpenWorkout) return;
              // Hiding the route can emit a zero offset before focus updates.
              openingWorkout.current = true;
              onOpenWorkout(workout.id);
            }}
            style={styles.workoutAction}
          >
            <View style={styles.copy}>
              <Text numberOfLines={2} style={[styles.title, { color: theme.textPrimary }]}>
                {workout.name}
              </Text>
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
          {onOpenWorkout ? (
            <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
          ) : null}
        </View>
        {exercises.map((block) => {
          const sets = block.sets
            .map((set, index) => ({ set, index }))
            .filter(({ set }) => isCompletedSet(set));
          return (
            <SetTableSurface key={block.id} page={page}>
              {block.offSession ? (
                <Text
                  style={[styles.caption, { color: theme.textSecondary, paddingHorizontal: 14 }]}
                >
                  Off-session
                </Text>
              ) : null}
              <View style={styles.setHeader}>
                <Text style={[styles.setColumn, styles.caption, { color: theme.textSecondary }]}>
                  Set
                </Text>
                {trackingFields[effectiveTracking(block)].map((kind) => (
                  <Text
                    key={kind}
                    style={[
                      styles.measurementColumn,
                      styles.caption,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {trackingFieldLabel(effectiveTracking(block), kind)}
                  </Text>
                ))}
              </View>
              {sets.map(({ set, index }, visibleIndex) => (
                <View key={set.id}>
                  <HistorySetRow
                    set={set}
                    index={index}
                    compact
                    isLast={visibleIndex === sets.length - 1}
                    trackingType={effectiveTracking(block)}
                    onOpenDetails={() =>
                      setOpenSet({ set, index, trackingType: effectiveTracking(block) })
                    }
                  />
                </View>
              ))}
            </SetTableSurface>
          );
        })}
      </SessionSurface>
    );
  };
  return (
    <>
      {showAll ? (
        <View
          style={page ? { flex: 1, minHeight: 0 } : { height: height * 0.66, flexShrink: 1 }}
          testID="exercise-history-expanded"
        >
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={sessions}
            keyExtractor={(item) => item.workout.id}
            renderItem={({ item }) => renderSession(item)}
            contentContainerStyle={[styles.content, { paddingBottom: scaleUI(24) + bottomInset }]}
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
        <PreviewScroll
          {...(!page ? { dragToDismiss: false } : {})}
          style={page ? { flex: 1 } : undefined}
          testID="previous-sessions-scroll"
          ref={previewRef}
          contentContainerStyle={[styles.content, { paddingBottom: scaleUI(24) + bottomInset }]}
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
        </PreviewScroll>
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
function SetTableSurface({ page, children }: { page: boolean; children: React.ReactNode }) {
  return <View>{children}</View>;
}
function isCompletedSet(set: WorkoutSet): boolean {
  return (
    set.completed && (!set.sideCompletion || (set.sideCompletion.left && set.sideCompletion.right))
  );
}
const styles = StyleSheet.create({
  openSession: { gap: scaleUI(4) },
  content: {
    paddingHorizontal: scaleUI(20),
    paddingTop: scaleUI(4),
    paddingBottom: scaleUI(24),
    gap: scaleUI(12),
  },
  card: { padding: 0, overflow: 'hidden' },
  header: {
    paddingHorizontal: scaleUI(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleUI(8),
  },
  workoutAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: scaleUI(8),
    borderRadius: scaleUI(12),
  },
  copy: { minWidth: 0, gap: scaleUI(2) },
  title: { ...typeScale.cardTitle },
  caption: { ...typeScale.label },
  setHeader: {
    paddingHorizontal: scaleUI(12),
    minHeight: scaleUI(24),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
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
