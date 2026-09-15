import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ForgeCard, ForgeText as Text, Icon, pressedFeedbackSubtle, selectionHaptic } from './ui';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { IconName, Workout, WorkoutTypePreference } from '../types';

type Metadata = { icon: IconName; label: string; value: string };

/**
 * The shared, read-only workout overview used before a workout's exercises.
 * Its neutral grouped surface keeps the information scanable while workout
 * type colour remains limited to the small semantic marker.
 */
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
  const usesWideSummary = width >= 640;
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

  return (
      <ForgeCard testID={testID} style={styles.card}>
      <View style={[styles.summaryHeader, usesWideSummary && styles.summaryHeaderWide]}>
        <View style={styles.identityRow}>
          <View style={[styles.typeMarker, { backgroundColor: type.background }]}>
            <Icon name={type.icon} size={26} color={type.color} />
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={2}>{workout.name}</Text>
            <Text style={styles.summary} numberOfLines={1}>
              {`${workout.exercises.length} ${workout.exercises.length === 1 ? 'exercise' : 'exercises'}, ${countWorkoutSets(workout)} ${countWorkoutSets(workout) === 1 ? 'set' : 'sets'}`}
            </Text>
          </View>
        </View>

        <View style={[styles.timingRow, usesWideSummary && styles.timingRowWide]}>
          <TimingMetric icon="time-outline" label="Duration" value={duration} />
          <View style={styles.verticalDivider} />
          <TimingMetric icon="time-outline" label="Avg rest / set" value={rest} />
        </View>
      </View>

      <View style={styles.divider} />
      <View style={styles.overviewRow}>
        <View style={styles.dateGroup}>
          <Icon name="calendar" size={21} color={theme.slate} />
          <View>
            <Text style={styles.date}>{formatDate(completedAt)}</Text>
            <Text style={styles.time}>{formatTime(completedAt)}</Text>
          </View>
        </View>
        <View style={styles.verticalDivider} />
        <Metric label="Exercises" value={String(workout.exercises.length)} />
        <Metric label="Sets" value={String(countWorkoutSets(workout))} />
      </View>

      {note ? <>
        <View style={styles.divider} />
        <View style={styles.noteRow}>
          <Icon name="note" size={22} color={theme.slate} />
          <Text style={styles.note} numberOfLines={detailsExpanded ? undefined : 3}>{note}</Text>
        </View>
      </> : null}

      {metadata.length > 0 ? <>
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
          <Icon name="ellipsis-horizontal" size={22} color={theme.slate} />
          <Text style={styles.detailsPreview} numberOfLines={1}>
            {detailsExpanded ? 'Session details' : `Session details · ${detailPreview}${remainingDetails ? ` +${remainingDetails}` : ''}`}
          </Text>
          <Icon name="chevron-down" size={20} color={theme.slate} />
        </Pressable>
        {detailsExpanded ? (
          <ForgeCard variant="inset" size="compact" style={styles.detailGrid}>
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
      </ForgeCard>
  );
}

function TimingMetric({ icon, label, value }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.timingMetric}>
      <View style={styles.timingValueRow}>
        <Icon name={icon} size={17} color={theme.slate} />
        <Text style={styles.timingValue} numberOfLines={1}>{value}</Text>
      </View>
      <Text style={styles.timingLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatRest(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return rounded < 60 ? `${rounded}s` : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

const createStyles = (theme: import('../types').ForgeTheme) => StyleSheet.create({
  card: { padding: 16, gap: 14 },
  summaryHeader: { gap: 14 },
  summaryHeaderWide: { flexDirection: 'row', alignItems: 'center' },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeMarker: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  identityCopy: { flex: 1, gap: 2 },
  name: { color: theme.ink, ...typeScale.sectionTitle },
  summary: { color: theme.slate, ...typeScale.supporting },
  timingRow: { flexDirection: 'row', minHeight: 55, alignItems: 'center', gap: 12 },
  timingRowWide: { flex: 1.15, minWidth: 0 },
  timingMetric: { flex: 1, minWidth: 0, gap: 3 },
  timingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timingValue: { color: theme.ink, ...typeScale.cardTitle },
  timingLabel: { color: theme.slate, ...typeScale.label },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
  verticalDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: theme.divider },
  overviewRow: { flexDirection: 'row', alignItems: 'center', minHeight: 66, gap: 12 },
  dateGroup: { flex: 1.35, flexDirection: 'row', alignItems: 'center', gap: 9 },
  date: { color: theme.ink, ...typeScale.label },
  time: { color: theme.slate, ...typeScale.label, marginTop: 2 },
  metric: { flex: 0.75, alignItems: 'center', gap: 2 },
  metricLabel: { color: theme.slate, ...typeScale.label, textAlign: 'center' },
  metricValue: { color: theme.ink, ...typeScale.metricMedium, textAlign: 'center' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  note: { flex: 1, color: theme.ink, ...typeScale.body },
  detailsTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailsPreview: { flex: 1, color: theme.slate, ...typeScale.body },
  detailGrid: { marginTop: -4, padding: 0, overflow: 'hidden' },
  detailItem: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailItemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
  detailCopy: { flexShrink: 1, maxWidth: '34%', minWidth: 0, paddingTop: 1 },
  detailLabel: { color: theme.slate, ...typeScale.body },
  detailValue: { flex: 1, minWidth: 0, color: theme.ink, ...typeScale.body, textAlign: 'right' },
});
