import { formatProgressValue } from '../../domain/exercises/progressPresentation';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ForgeCard,
  ForgeText as Text,
  ForgeSegmentedSwitch,
  ForgeSingleSelectList,
  Icon,
} from '../ui';
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
  progressScope,
  type ProgressMetric,
} from '../../domain/exercises/progress';
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
  { value: '7', label: '7d', icon: 'calendar' },
  { value: '30', label: '30d', icon: 'calendar' },
  { value: '90', label: '90d', icon: 'calendar' },
  { value: 'all', label: 'All', icon: 'calendar' },
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
}) {
  const theme = useForgeTheme();
  const { preferences, updatePreferences } = useSettings();
  const [ownTab, setOwnTab] = useState<ExerciseInfoTab>('info');
  const tab = controlledTab ?? ownTab;
  const mode = effectiveTracking(exercise);
  const metrics = metricsFor(mode);
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
  const metric = review.metric && metrics.includes(review.metric) ? review.metric : metrics[0];
  const range = review.range ?? '90';
  const expanded = review.expanded ?? false;
  const offset = review.offset ?? 0;
  const [selector, setSelector] = useState<'metric' | 'range' | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [choice, setChoice] = useState('auto');
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const header = useMemo<ExerciseInfoHeader | null>(
    () =>
      selector
        ? {
            title: selector === 'range' ? 'Date range' : 'Metric',
            backLabel: tab === 'history' ? 'Back to history' : 'Back to progress',
            backDisabled: false,
            onBack: () => setSelector(null),
          }
        : overrideId
          ? {
              title: 'Filtering',
              backLabel: 'Back to history',
              backDisabled: saving,
              onBack: () => {
                if (!saving) setOverrideId(null);
              },
            }
          : null,
    [selector, overrideId, saving, tab],
  );
  useLayoutEffect(() => {
    onHeaderChange?.(header);
    return () => onHeaderChange?.(null);
  }, [header, onHeaderChange]);
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
  const chartPoints = visible.filter((point) => !point.excluded);
  const formatValue = (value: number) => formatProgressValue(metric, value, preferences.units);
  const saveOverride = async () => {
    if (!overrideId || saving) return;
    setSaving(true);
    const scope = progressScope(exercise, metric);
    const records = { ...preferences.exerciseProgressOverrides[scope] };
    if (choice === 'auto') delete records[overrideId];
    else records[overrideId] = choice as 'include' | 'exclude';
    const saved = await updatePreferences({
      exerciseProgressOverrides: { ...preferences.exerciseProgressOverrides, [scope]: records },
    });
    setSaving(false);
    setSaveError(!saved);
    if (saved) setOverrideId(null);
  };
  const chooseOverride = (id: string) => {
    setOverrideId(id);
    setChoice(
      preferences.exerciseProgressOverrides[progressScope(exercise, metric)]?.[id] ?? 'auto',
    );
    setSaveError(false);
  };
  const metricButton = (
    <Button
      label={metricLabel(metric, mode)}
      accessibilityLabel="Progress metric"
      icon="chevron-down"
      variant="secondary"
      onPress={() => setSelector('metric')}
      style={styles.metricControl}
    />
  );
  return (
    <>
      {!header ? (
        <View style={styles.tabs}>
          <ForgeSegmentedSwitch
            options={tabs}
            value={tab}
            onChange={(value) => {
              if (onTabChange) onTabChange(value);
              else setOwnTab(value);
              setSelector(null);
              setOverrideId(null);
            }}
            showLabels
            accessibilityLabel="Exercise information"
          />
        </View>
      ) : null}
      {selector ? (
        <ForgeSheetScrollView contentContainerStyle={styles.content}>
          {selector === 'range' ? (
            <ForgeSingleSelectList
              options={ranges}
              selectedValue={range}
              onSelect={(value) => {
                updateReview({ range: value });
                setSelector(null);
              }}
              onSelectedPress={() => setSelector(null)}
              disableVirtualization
            />
          ) : (
            <ForgeSingleSelectList
              options={metrics.map((value) => ({ value, label: metricLabel(value, mode) }))}
              selectedValue={metric}
              onSelect={(value) => {
                updateReview({ metric: value });
                setSelector(null);
              }}
              onSelectedPress={() => setSelector(null)}
              disableVirtualization
            />
          )}
        </ForgeSheetScrollView>
      ) : overrideId ? (
        <ForgeSheetScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.copy, { color: theme.textSecondary }]}>
            {sessions.find((session) => session.workout.id === overrideId)?.workout.name} ·{' '}
            {metricLabel(metric, mode)}
          </Text>
          <ForgeSingleSelectList
            options={[
              {
                value: 'auto',
                label: 'Auto',
                description: 'Filter unusual values.',
              },
              {
                value: 'include',
                label: 'Include',
                description: 'Keep on the chart.',
              },
              {
                value: 'exclude',
                label: 'Exclude',
                description: 'Hide from the chart.',
              },
            ]}
            selectedValue={choice}
            onSelect={(value) => {
              if (!saving) setChoice(value);
            }}
            disableVirtualization
          />
          {saveError ? (
            <View accessibilityRole="alert" style={styles.exclusions}>
              <Icon name="alert-triangle" size={20} color={theme.textDestructive} />
              <Text style={[styles.copy, { flex: 1, color: theme.textPrimary }]}>
                Could not save. Your selection is still here. Try again.
              </Text>
            </View>
          ) : null}
          <Button
            label={saveError ? 'Retry save' : 'Save'}
            icon="check"
            tone="success"
            variant="outline"
            loading={saving}
            onPress={saveOverride}
          />
        </ForgeSheetScrollView>
      ) : tab === 'info' ? (
        info
      ) : tab === 'history' ? (
        <>
          <View style={styles.historyControls}>{metricButton}</View>
          <ExerciseHistory
            exercise={exercise}
            workouts={workouts}
            excludeWorkoutId={excludeWorkoutId}
            onOpenWorkout={onOpenWorkout}
            showAll={expanded}
            onShowAllChange={(expanded) => updateReview({ expanded })}
            scrollOffset={offset}
            onScrollOffsetChange={(offset) => updateReview({ offset })}
            points={points}
            onSelectOverride={chooseOverride}
          />
        </>
      ) : (
        <ForgeSheetScrollView
          testID="exercise-progress-content"
          dragToDismiss={false}
          contentContainerStyle={styles.content}
        >
          <ForgeCard variant="nested" style={styles.chart}>
            <View style={styles.chartHeader}>
              {metricButton}
              <Button
                label={range === 'all' ? 'All' : `${range}d`}
                icon="chevron-down"
                variant="secondary"
                accessibilityLabel="Progress date range"
                onPress={() => setSelector('range')}
              />
            </View>
            {visible.some((point) => point.excluded) ? (
              <Text style={[styles.copy, { alignSelf: 'flex-end', color: theme.textSecondary }]}>
                {visible.filter((point) => point.excluded).length} excluded
              </Text>
            ) : null}
            {chartPoints.length ? (
              <>
                <ForgeLineChart
                  key={`${metric}:${range}`}
                  data={chartPoints.map((point) => ({
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
                  height={180}
                  formatValue={formatValue}
                />
              </>
            ) : (
              <Text style={[styles.copy, { color: theme.textSecondary }]}>
                {points.length
                  ? 'No included sessions in this range.'
                  : 'Complete working sets to see progress.'}
              </Text>
            )}
          </ForgeCard>
        </ForgeSheetScrollView>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 20, paddingBottom: 14 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  historyControls: { paddingHorizontal: scaleUI(20), paddingBottom: scaleUI(8) },
  metricControl: { alignSelf: 'flex-start', minWidth: 44, flexShrink: 1 },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleUI(8),
    flexWrap: 'wrap',
  },
  title: { ...typeScale.sectionTitle },
  copy: { ...typeScale.supporting },
  chart: { padding: 14, gap: 8 },
  exclusions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
