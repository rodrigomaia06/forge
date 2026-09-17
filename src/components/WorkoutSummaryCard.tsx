import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ForgeCard, ForgeText as Text, Icon, pressedFeedbackSubtle, selectionHaptic } from './ui';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { IconName, Workout, WorkoutTypePreference } from '../types';

type Metadata = { icon: IconName; label: string; value: string };

/** The shared read-only workout overview used before a workout's exercises. */
export function WorkoutSummaryCard({
  workout,
  workoutTypes,
  testID,
}: {
  workout: Workout;
  workoutTypes: WorkoutTypePreference[];
  testID?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const isNarrowPhone = width <= 390;
  const isCompactPhone = width <= 340;
  const type = getWorkoutTypePresentation(workout.type, workoutTypes, theme, 0.16);
  const metadata = useMemo<Metadata[]>(() => [
    ...Object.entries(workout.attributes ?? {}).flatMap(([label, value]) => {
      const normalized = value.trim();
      return normalized
        ? [{ icon: workout.attributeIcons?.[label] ?? 'note' as IconName, label, value: normalized }]
        : [];
    }),
  ], [workout.attributeIcons, workout.attributes]);
  const detailPreview = metadata.slice(0, 3).map((item) => item.label).join(', ');
  const remainingDetails = Math.max(0, metadata.length - 3);
  const duration = formatCompactDuration(workout.durationSeconds ?? 0);
  const rest = workout.averageRestSeconds === undefined
    ? 'Not recorded'
    : formatRest(workout.averageRestSeconds);
  const completedAt = workout.completedAt ?? workout.startedAt;
  const note = workout.note?.trim() ?? '';
  const setCount = countWorkoutSets(workout);

  return (
    <ForgeCard testID={testID} style={styles.card}>
      <View style={styles.layout}>
        <View
          testID={testID ? `${testID}-date-rail` : undefined}
          style={[styles.dateRail, isNarrowPhone && styles.dateRailNarrow]}
        >
          <View style={styles.dateRailContent}>
            <Text style={styles.dateWeekday}>{formatDatePart(completedAt, 'weekday').toUpperCase()}</Text>
            <Text testID={testID ? `${testID}-date-day` : undefined} style={styles.dateDay}>{new Date(completedAt).getDate()}</Text>
            <Text style={styles.dateMonth}>{formatDatePart(completedAt, 'month').toUpperCase()}</Text>
          </View>
        </View>

        <View style={[styles.content, isNarrowPhone && styles.contentNarrow]}>
          <View style={styles.identityRow}>
            <View style={[styles.typeMarker, { backgroundColor: type.background }]}>
              <Icon name={type.icon} size={26} color={type.color} />
            </View>
            <View style={styles.identityCopy}>
              <Text testID={testID ? `${testID}-title` : undefined} style={styles.name} numberOfLines={2}>{workout.name}</Text>
              <Text style={styles.summary} numberOfLines={2}>
                {`${workout.exercises.length} ${workout.exercises.length === 1 ? 'exercise' : 'exercises'} · ${setCount} ${setCount === 1 ? 'set' : 'sets'}`}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={[styles.timingRow, isCompactPhone && styles.timingRowCompact]}>
            <TimingMetric compact={isCompactPhone} icon="stopwatch-outline" label="Duration" value={duration} />
            <View style={styles.verticalDivider} />
            <TimingMetric compact={isCompactPhone} icon="hourglass" label="Avg rest" value={rest} />
          </View>

          {note ? <>
            <View style={styles.divider} />
            <View style={styles.noteRow}>
              <View style={styles.rowIcon}>
                <Icon name="note" size={18} color={theme.slate} />
              </View>
              <Text style={styles.note} numberOfLines={detailsExpanded ? undefined : 3}>{note}</Text>
            </View>
          </> : null}

          {metadata.length === 1 ? <>
            <View style={styles.divider} />
            <View style={styles.attributeRow}>
              <Icon name={metadata[0].icon} size={18} color={theme.slate} />
              <Text style={styles.attributeLabel} numberOfLines={1}>{metadata[0].label}</Text>
              <Text style={styles.attributeValue}>{metadata[0].value}</Text>
            </View>
          </> : null}

          {metadata.length > 1 ? <>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${detailsExpanded ? 'Hide' : 'Show'} session details`}
              accessibilityState={{ expanded: detailsExpanded }}
              onPress={() => {
                selectionHaptic();
                setDetailsExpanded((current) => !current);
              }}
              style={({ pressed }) => [styles.detailsTrigger, pressed && pressedFeedbackSubtle]}
            >
              <Icon name="info" size={20} color={theme.slate} />
              <Text style={styles.detailsPreview} numberOfLines={1}>
                {`${detailPreview}${remainingDetails ? ` +${remainingDetails}` : ''}`}
              </Text>
              <Icon name={detailsExpanded ? 'chevron-down' : 'chevron-forward'} size={20} color={theme.slate} />
            </Pressable>
            {detailsExpanded ? (
              <ForgeCard variant="nested" size="compact" style={styles.detailGrid}>
                {metadata.map((item, index) => (
                  <View key={item.label} style={[styles.detailItem, index > 0 && styles.detailItemDivider]}>
                    <Icon name={item.icon} size={18} color={theme.slate} />
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel} numberOfLines={1}>{item.label}</Text>
                    </View>
                    <Text style={styles.detailValue}>{item.value}</Text>
                  </View>
                ))}
              </ForgeCard>
            ) : null}
          </> : null}
        </View>
      </View>
    </ForgeCard>
  );
}

function TimingMetric({ compact = false, icon, label, value }: {
  compact?: boolean;
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.timingMetric, compact && styles.timingMetricCompact]}>
      <View style={[styles.metricIcon, compact && styles.metricIconCompact]}>
        <Icon name={icon} size={18} color={theme.slate} />
      </View>
      <View style={[styles.timingCopy, compact && styles.timingCopyCompact]}>
        <Text style={styles.timingLabel}>{label}</Text>
        <Text style={styles.timingValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatDatePart(value: number, part: 'weekday' | 'month'): string {
  return new Date(value).toLocaleDateString(undefined, { [part]: 'short' });
}

function formatRest(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return rounded < 60 ? `${rounded}s` : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

const createStyles = (theme: import('../types').ForgeTheme) => StyleSheet.create({
  card: { padding: 0 },
  layout: { flexDirection: 'row', alignItems: 'stretch' },
  dateRail: {
    width: 64,
    flexShrink: 0,
    alignItems: 'center',
    // Balance the weekday/day/month cluster against the identity title on
    // phone-sized cards without pulling the day above that title.
    paddingTop: 13,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.divider,
  },
  dateRailNarrow: { width: 56, paddingHorizontal: 6 },
  dateRailContent: { alignItems: 'center' },
  dateWeekday: { color: theme.slate, ...typeScale.label },
  dateDay: { marginTop: 2, color: theme.ink, ...typeScale.metricLarge },
  dateMonth: { marginTop: 1, color: theme.slate, ...typeScale.label },
  content: { flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  contentNarrow: { paddingHorizontal: 12, gap: 6 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeMarker: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: theme.ink, ...typeScale.sectionTitle },
  summary: { color: theme.slate, ...typeScale.supporting },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
  timingRow: { flexDirection: 'row', minHeight: 52, alignItems: 'center', gap: 8 },
  timingRowCompact: { minHeight: 88, alignItems: 'flex-start', gap: 8 },
  timingMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timingMetricCompact: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 6 },
  metricIcon: {
    width: 32, height: 32, flexShrink: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surfaceMuted,
  },
  metricIconCompact: { width: 32, height: 32, borderRadius: 16 },
  timingCopy: { flex: 1, minWidth: 0, gap: 1 },
  timingCopyCompact: { width: '100%', flexGrow: 0 },
  timingValue: { color: theme.ink, ...typeScale.cardTitle },
  timingLabel: { color: theme.slate, ...typeScale.supporting },
  verticalDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: theme.divider },
  rowIcon: {
    width: 36, height: 36, flexShrink: 0, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surfaceMuted,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  note: { flex: 1, minWidth: 0, paddingTop: 6, color: theme.ink, ...typeScale.body },
  detailsTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailsPreview: { flex: 1, color: theme.ink, ...typeScale.body },
  detailGrid: { marginTop: -2, padding: 0, overflow: 'hidden' },
  attributeRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  attributeLabel: { flexShrink: 1, color: theme.slate, ...typeScale.body },
  attributeValue: { flex: 1, minWidth: 0, color: theme.ink, ...typeScale.body, textAlign: 'right' },
  detailItem: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailItemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
  detailCopy: { flexShrink: 1, maxWidth: '34%', minWidth: 0 },
  detailLabel: { color: theme.slate, ...typeScale.body },
  detailValue: { flex: 1, minWidth: 0, color: theme.ink, ...typeScale.body, textAlign: 'right' },
});
