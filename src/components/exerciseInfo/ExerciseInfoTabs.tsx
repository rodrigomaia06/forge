import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ForgeSegmentedSwitch } from '../ui';
import { ForgeSheetScrollView } from '../ui/ForgeSheetScrollView';
import { ExerciseProgressPanel } from './ExerciseProgressPanel';
import { ExerciseHistory } from './ExerciseHistory';
import { effectiveTracking } from '../../domain/exercises/tracking';
import {
  exerciseProgress,
  exerciseSessions,
  metricsFor,
  progressInRange,
  type ProgressMetric,
} from '../../domain/exercises/progress';
import { useSettings } from '../../state/SettingsContext';
import { scaleUI } from '../../theme/scale';
import type { Workout, WorkoutExercise } from '../../types';

export type ExerciseInfoTab = 'info' | 'progress' | 'history';
export type ExerciseInfoHeader = {
  title: string;
  backLabel: string;
  onBack: () => void;
  backDisabled: boolean;
};
export type ExerciseInfoReview = {
  metric?: ProgressMetric;
  range?: string;
  expanded?: boolean;
  offset?: number;
};
const tabs = [
  { value: 'info', label: 'Info', icon: 'note' },
  { value: 'progress', label: 'Progress', icon: 'activity' },
  { value: 'history', label: 'History', icon: 'time' },
] as const;

export function ExerciseInfoTabs({
  exercise,
  workouts,
  info,
  contentTitle,
  excludeWorkoutId,
  onOpenWorkout,
  tab: controlledTab,
  onTabChange,
  review: controlledReview,
  onReviewChange,
  onHeaderChange,
  presentation = 'sheet',
  bottomInset = 0,
  onScrollOffsetChange,
}: {
  exercise: WorkoutExercise;
  workouts: readonly Workout[];
  info: React.ReactNode;
  contentTitle?: React.ReactNode;
  excludeWorkoutId?: string;
  onOpenWorkout?: (id: string) => void;
  tab?: ExerciseInfoTab;
  onTabChange?: (tab: ExerciseInfoTab) => void;
  review?: ExerciseInfoReview;
  onReviewChange?: (review: ExerciseInfoReview) => void;
  onHeaderChange?: (header: ExerciseInfoHeader | null) => void;
  presentation?: 'sheet' | 'screen';
  bottomInset?: number;
  onScrollOffsetChange?: (offset: number) => void;
}) {
  const { preferences } = useSettings();
  const [ownTab, setOwnTab] = useState<ExerciseInfoTab>('info');
  const tab = controlledTab ?? ownTab;
  const [ownReview, setOwnReview] = useState<ExerciseInfoReview>({});
  const review = controlledReview ?? ownReview;
  const latestReview = useRef(review);
  latestReview.current = review;
  const updateReview = (changes: ExerciseInfoReview) => {
    const next = { ...latestReview.current, ...changes };
    latestReview.current = next;
    if (onReviewChange) onReviewChange(next);
    else setOwnReview(next);
  };
  useLayoutEffect(() => {
    onHeaderChange?.(null);
  }, [onHeaderChange]);
  const mode = effectiveTracking(exercise);
  const metrics = metricsFor(mode);
  const metric =
    review.metric && metrics.includes(review.metric)
      ? review.metric
      : metrics.includes('volume')
        ? 'volume'
        : metrics[0];
  const range = review.range ?? '90';
  const sessions = useMemo(
    () =>
      exerciseSessions(exercise, workouts).filter(
        (session) => session.workout.id !== excludeWorkoutId,
      ),
    [exercise, workouts, excludeWorkoutId],
  );
  const points = useMemo(
    () => exerciseProgress(exercise, sessions, metric, preferences.exerciseProgressOverrides),
    [exercise, sessions, metric, preferences.exerciseProgressOverrides],
  );
  const visible = progressInRange(points, range === 'all' ? 'all' : Number(range));
  const page = presentation === 'screen';
  const ContentScroll = page ? ScrollView : ForgeSheetScrollView;
  return (
    <>
      <View style={styles.tabs}>
        <ForgeSegmentedSwitch
          options={tabs}
          value={tab}
          onChange={(next) => {
            if (onTabChange) onTabChange(next);
            else setOwnTab(next);
          }}
          showLabels
          accessibilityLabel="Exercise information"
        />
      </View>
      {tab === 'info' ? (
        info
      ) : tab === 'history' ? (
        <ExerciseHistory
          contentTitle={contentTitle}
          presentation={presentation}
          bottomInset={bottomInset}
          onPageScroll={onScrollOffsetChange}
          exercise={exercise}
          workouts={workouts}
          excludeWorkoutId={excludeWorkoutId}
          onOpenWorkout={onOpenWorkout}
          showAll={review.expanded ?? false}
          onShowAllChange={(expanded) => updateReview({ expanded })}
          scrollOffset={review.offset ?? 0}
          onScrollOffsetChange={(offset) => updateReview({ offset })}
        />
      ) : (
        <ContentScroll
          {...(!page ? { dragToDismiss: false } : {})}
          testID="exercise-progress-content"
          style={page ? styles.scroll : undefined}
          contentContainerStyle={[
            styles.content,
            !visible.some((point) => !point.excluded) && { flexGrow: 1 },
            { paddingBottom: scaleUI(32) + bottomInset },
          ]}
          scrollEventThrottle={16}
          onScroll={(event) => onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)}
        >
          {contentTitle}
          <ExerciseProgressPanel
            key={`${metric}:${range}`}
            points={visible}
            sessions={sessions}
            metric={metric}
            metrics={metrics}
            mode={mode}
            range={range}
            units={preferences.units}
            hasHistory={points.length > 0}
            onMetricChange={(metric) => updateReview({ metric })}
            onRangeChange={(range) => updateReview({ range })}
          />
        </ContentScroll>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  tabs: { paddingHorizontal: scaleUI(20), paddingBottom: scaleUI(14) },
  scroll: { flex: 1 },
  content: { paddingHorizontal: scaleUI(20), paddingTop: scaleUI(12), gap: scaleUI(16) },
});
