import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ForgeText as Text } from '../../components/ui';
import {
  measurementDisplay,
  measurementText, trackingFieldLabel, trackingFields,
} from '../../domain/exercises/tracking';
import { SetNumberBadge, useSetNumberBadgeLayout } from './SetNumberBadge';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { SetMeasurementKind, TrackingType, WorkoutSet } from '../../types';
import { CompletionCheck } from './CompletionCheck';
import { selectionHaptic } from './activeWorkoutFeedback';

/** Read-only recorded-set row shared by workout details and Previous sessions. */
export function HistorySetRow({
  set,
  index,
  trackingType,
  compact = false,
  isLast = false,
  showPrevious = false,
  showCompletion = true,
  onOpenDetails,
}: {
  set: WorkoutSet;
  index: number;
  trackingType: TrackingType;
  compact?: boolean;
  isLast?: boolean;
  /** Workout detail tables share the live-workout Previous column. */
  showPrevious?: boolean;
  /** Recorded workouts show a completion tick; routines have no completion. */
  showCompletion?: boolean;
  onOpenDetails: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const rpe = measurementText(set, 'rpe');
  const badgeLayout = useSetNumberBadgeLayout(!compact && Boolean(rpe));
  const values = trackingFields[trackingType].map((kind) => measurementDisplay(set, kind)).filter(Boolean);
  const planned = set.plannedTargets?.map((item) => item.maxValue !== undefined && item.maxValue !== item.minValue ? `${item.minValue}–${item.maxValue}` : String(item.minValue ?? item.maxValue ?? '')).filter(Boolean).join(' · ');
  const formatTarget = (item: NonNullable<WorkoutSet['plannedTargets']>[number]): string =>
    item.maxValue !== undefined && item.maxValue !== item.minValue
      ? `${item.minValue}–${item.maxValue}`
      : String(item.minValue ?? item.maxValue ?? '');
  // A recorded value wins; otherwise show the set's planned target (routines
  // have targets, not recordings) and fall back to a clean dash rather than a
  // wrapping "Not recorded" inside the narrow value box.
  const valueFor = (kind: SetMeasurementKind): string => {
    const recorded = measurementDisplay(set, kind);
    if (recorded) return recorded;
    const targetForKind = set.plannedTargets?.find((item) => item.kind === kind)
      ?? set.targets?.find((item) => item.kind === kind);
    return targetForKind ? formatTarget(targetForKind) || '—' : '—';
  };
  if (compact) {
    return (
      <View style={[styles.compactRow, { borderTopColor: theme.divider }]}>
        <View style={styles.compactCopy}>
          <View style={styles.compactMetricsLine}>
            <Text style={styles.metrics}>
              {values.length ? values.join(' × ') : 'Not recorded'}
            </Text>
            {rpe ? <Text style={[styles.compactRpe, { color: theme.textSecondary }]}>{`RPE ${rpe}`}</Text> : null}
          </View>
          {planned ? <Text style={[styles.planned, { color: theme.textSecondary }]}>{planned}</Text> : null}
          {set.comment?.trim() ? <Text numberOfLines={2} style={[styles.comment, { color: theme.textSecondary }]}>{`“${set.comment.trim()}”`}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open details for set ${index + 1}`} onPress={() => { selectionHaptic(); onOpenDetails(); }} pressFeedbackStyle={badgeLayout.feedback} style={[styles.compactChipButton, { minHeight: Math.max(44, badgeLayout.height + 4) }]}>
          <SetNumberBadge set={set} index={index} testID={`history-set-number-chip-${index + 1}`} showEffort={false} />
        </Pressable>
      </View>
    );
  }
  return (
    <View testID={`workout-details-set-${set.id}`} style={[styles.fullRow, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open details for set ${index + 1}`} onPress={() => { selectionHaptic(); onOpenDetails(); }} pressFeedbackStyle={badgeLayout.feedback} style={[styles.numberButton, { minHeight: Math.max(44, badgeLayout.height + 4) }]}>
        <SetNumberBadge set={set} index={index} testID={`history-set-number-chip-${index + 1}`} />
      </Pressable>
      {showPrevious ? <Text style={styles.previous}>{set.previous?.trim() || 'Not recorded'}</Text> : null}
      {trackingFields[trackingType].map((kind) => (
        <View key={kind} accessibilityLabel={trackingFieldLabel(trackingType, kind)} style={[styles.value, { borderColor: theme.divider, backgroundColor: theme.surfaceMuted }]}>
          <Text numberOfLines={1} style={styles.valueText}>
            {valueFor(kind)}
          </Text>
        </View>
      ))}
      {showCompletion ? (
        <View style={styles.check}>
          <CompletionCheck selected={set.completed} testID={`workout-details-set-completion-${set.id}`} />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => StyleSheet.create({
  fullRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  numberButton: { width: 46, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  value: { width: 60, minHeight: 36, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  valueText: { color: theme.ink, ...typeScale.body },
  previous: { flex: 1, minWidth: 0, color: theme.ink, ...typeScale.body, textAlign: 'center' },
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  compactRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  compactCopy: { flex: 1, minWidth: 0, gap: 2 },
  compactMetricsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  compactChipButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  metrics: { color: theme.ink, ...typeScale.cardTitle },
  compactRpe: { ...typeScale.supporting },
  planned: { ...typeScale.body },
  comment: { fontStyle: 'italic', ...typeScale.body },
});
