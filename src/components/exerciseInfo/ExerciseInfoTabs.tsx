import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ForgeText as Text, ForgeSegmentedSwitch } from '../ui';
import { ForgeDropdown } from '../ui/ForgeDropdown';
import { ForgeSheetScrollView } from '../ui/ForgeSheetScrollView';
import { ForgeLineChart } from '../charts/ForgeLineChart';
import { ExerciseHistory } from './ExerciseHistory';
import { effectiveTracking } from '../../domain/exercises/tracking';
import {
  exerciseProgress,
  exerciseSessions,
  metricsFor,
  metricLabel,
  progressInRange,
  type ProgressMetric,
} from '../../domain/exercises/progress';
import { formatProgressValue } from '../../domain/exercises/progressPresentation';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
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
const ranges = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'all', label: 'All' },
] as const;

export function ExerciseInfoTabs({
  exercise,
  workouts,
  info,
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
  const theme = useForgeTheme();
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
  const included = visible.filter((point) => !point.excluded);
  const excluded = visible.length - included.length;
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
          contentContainerStyle={[styles.content, { paddingBottom: scaleUI(32) + bottomInset }]}
          scrollEventThrottle={16}
          onScroll={(event) => onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)}
        >
          <View style={styles.toolbar}>
            <ForgeDropdown
              label={metricLabel(metric, mode)}
              accessibilityLabel="Progress metric"
              value={metric}
              options={metrics.map((value) => ({ value, label: metricLabel(value, mode) }))}
              onChange={(metric) => updateReview({ metric })}
            />
            <ForgeDropdown
              label={range === 'all' ? 'All' : `${range}d`}
              accessibilityLabel="Progress date range"
              value={range}
              options={ranges}
              onChange={(range) => updateReview({ range })}
            />
          </View>
          {excluded ? (
            <Text style={[styles.copy, styles.excluded, { color: theme.textSecondary }]}>
              {excluded} excluded
            </Text>
          ) : null}
          {included.length ? (
            <ForgeLineChart
              key={`${metric}:${range}`}
              showAxes={page}
              selectionPlacement={page ? 'above' : 'below'}
              height={page ? 250 : 180}
              formatValue={(value) => formatProgressValue(metric, value, preferences.units)}
              data={included.map((point) => ({
                value: point.value,
                date: point.date,
                trend: point.trend,
                description: new Date(point.date).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                label: new Date(point.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                }),
              }))}
            />
          ) : (
            <Text style={[styles.copy, { color: theme.textSecondary }]}>
              {points.length
                ? 'No included sessions in this range.'
                : 'Complete working sets to see progress.'}
            </Text>
          )}
        </ContentScroll>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  tabs: { paddingHorizontal: scaleUI(20), paddingBottom: scaleUI(14) },
  scroll: { flex: 1 },
  content: { paddingHorizontal: scaleUI(20), paddingTop: scaleUI(12), gap: scaleUI(16) },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleUI(8),
    flexWrap: 'wrap',
  },
  copy: { ...typeScale.supporting },
  excluded: { alignSelf: 'flex-end' },
});
