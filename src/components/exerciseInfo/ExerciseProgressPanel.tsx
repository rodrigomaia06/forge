import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ForgeCard, ForgeText as Text, Button } from '../ui';
import { ForgeDropdown } from '../ui/ForgeDropdown';
import { ForgeLineChart } from '../charts/ForgeLineChart';
import {
  type ExerciseSession,
  type ProgressMetric,
  type ProgressPoint,
  metricLabel,
} from '../../domain/exercises/progress';
import {
  estimatedOneRepMax,
  progressChange,
  progressRecord,
} from '../../domain/exercises/progressStats';
import { formatProgressValue } from '../../domain/exercises/progressPresentation';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { typeScale } from '../../theme/tokens';
import type { TrackingType, UnitsPreference } from '../../types';

const ranges = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'all', label: 'All' },
];
const dateLabel = (date: number) =>
  new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const signed = (value: number, formatted: string) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}`;

export function ExerciseProgressPanel({
  points,
  sessions,
  metric,
  metrics,
  mode,
  range,
  units,
  hasHistory,
  onMetricChange,
  onRangeChange,
}: {
  points: ProgressPoint[];
  sessions: ExerciseSession[];
  metric: ProgressMetric;
  metrics: ProgressMetric[];
  mode: TrackingType;
  range: string;
  units: UnitsPreference;
  hasHistory: boolean;
  onMetricChange: (metric: ProgressMetric) => void;
  onRangeChange: (range: string) => void;
}) {
  const theme = useForgeTheme();
  const included = useMemo(() => points.filter((point) => !point.excluded), [points]);
  const [index, setIndex] = useState(included.length - 1);
  const selectedIndex = Math.max(0, Math.min(index, included.length - 1));
  const selected = included[selectedIndex];
  const excluded = points.length - included.length;
  const record = useMemo(
    () =>
      mode === 'weight-reps'
        ? estimatedOneRepMax(sessions, range === 'all' ? 'all' : Number(range))
        : progressRecord(points, metric, mode),
    [sessions, range, points, metric, mode],
  );
  const change = useMemo(() => progressChange(points), [points]);
  const [width, setWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);
  const stacked =
    width > 0 && Math.max(scaleUI(150), labelWidth + scaleUI(32)) * 2 + scaleUI(12) > width;
  const format = (value: number) => formatProgressValue(metric, value, units);
  const color = { color: theme.textPrimary };
  const secondary = { color: theme.textSecondary };
  return (
    <View style={styles.panel}>
      <ForgeCard style={styles.toolbar} testID="exercise-progress-toolbar">
        <View style={styles.selectors}>
          <ForgeDropdown
            label={metricLabel(metric, mode)}
            accessibilityLabel="Progress metric"
            value={metric}
            options={metrics.map((value) => ({ value, label: metricLabel(value, mode) }))}
            onChange={onMetricChange}
          />
          <ForgeDropdown
            label={range === 'all' ? 'All' : `${range}d`}
            accessibilityLabel="Progress date range"
            value={range}
            options={ranges}
            onChange={onRangeChange}
          />
        </View>
        <View style={styles.navigation}>
          <Button
            icon="chevron-back"
            accessibilityLabel="Previous session point"
            variant="secondary"
            style={styles.sessionAction}
            disabled={!selected || selectedIndex === 0}
            onPress={() => setIndex(selectedIndex - 1)}
          />
          <Button
            icon="chevron-forward"
            accessibilityLabel="Next session point"
            variant="secondary"
            style={styles.sessionAction}
            disabled={!selected || selectedIndex === included.length - 1}
            onPress={() => setIndex(selectedIndex + 1)}
          />
        </View>
      </ForgeCard>
      <ForgeCard style={styles.chartCard} testID="exercise-progress-card">
        {selected ? (
          <>
            <View
              testID="exercise-progress-selection"
              accessibilityLiveRegion="polite"
              style={styles.readout}
            >
              <Text style={[typeScale.metricLarge, color]}>{format(selected.value)}</Text>
              <Text style={[typeScale.supporting, secondary]}>
                {new Date(selected.date).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <ForgeLineChart
              selectionPlacement="none"
              showAxes
              height={250}
              selectedIndex={selectedIndex}
              onSelectionChange={setIndex}
              formatValue={format}
              data={included.map((point) => ({
                value: point.value,
                date: point.date,
                trend: point.trend,
                label: new Date(point.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                }),
              }))}
            />
          </>
        ) : (
          <Text style={[typeScale.supporting, secondary]}>
            {hasHistory
              ? 'No included sessions in this range.'
              : 'Complete working sets to see progress.'}
          </Text>
        )}
        {excluded ? (
          <Text style={[typeScale.supporting, secondary]}>{excluded} excluded</Text>
        ) : null}
      </ForgeCard>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.statistics, stacked && styles.stacked]}
      >
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={styles.probe}
        >
          <Text
            style={typeScale.body}
            onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
          >
            Estimated 1RM
          </Text>
        </View>
        <ForgeCard
          testID="exercise-progress-record"
          style={[styles.statCard, stacked && styles.stackedCard]}
        >
          <Text style={[typeScale.body, secondary]}>
            {mode === 'weight-reps' ? 'Estimated 1RM' : 'Period record'}
          </Text>
          <Text style={[typeScale.metricMedium, color]}>
            {record
              ? formatProgressValue(mode === 'weight-reps' ? 'load' : metric, record.value, units)
              : '—'}
          </Text>
          <Text style={[typeScale.label, secondary]}>
            {record
              ? dateLabel(record.date)
              : mode === 'weight-reps'
                ? 'No eligible sets in this period'
                : 'No included sessions'}
          </Text>
        </ForgeCard>
        <ForgeCard
          testID="exercise-progress-change"
          style={[styles.statCard, stacked && styles.stackedCard]}
        >
          <Text style={[typeScale.body, secondary]}>Metric change</Text>
          <Text style={[typeScale.metricMedium, color]}>
            {change ? signed(change.absolute, format(Math.abs(change.absolute))) : '—'}
          </Text>
          <Text style={[typeScale.label, secondary]}>
            {change
              ? change.percent === undefined
                ? 'From first to last session'
                : signed(change.percent, `${Number(Math.abs(change.percent).toFixed(1))}%`)
              : 'Needs 2 included sessions'}
          </Text>
        </ForgeCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: scaleUI(16) },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scaleUI(8),
    gap: scaleUI(8),
  },
  selectors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scaleUI(8),
    flexShrink: 1,
  },
  navigation: { flexDirection: 'row', gap: scaleUI(4), marginLeft: 'auto' },
  sessionAction: { width: 44, minWidth: 44, paddingHorizontal: 0 },
  chartCard: { padding: scaleUI(16), gap: scaleUI(16) },
  readout: { gap: scaleUI(4) },
  statistics: { flexDirection: 'row', gap: scaleUI(12) },
  stacked: { flexDirection: 'column' },
  statCard: { flex: 1, minWidth: 0, padding: scaleUI(16), gap: scaleUI(8) },
  stackedCard: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  probe: { position: 'absolute', opacity: 0, alignItems: 'flex-start' },
});
