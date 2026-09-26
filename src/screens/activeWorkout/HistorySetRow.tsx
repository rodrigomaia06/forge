import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ForgeText as Text } from '../../components/ui';
import { measurementText, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { hasNextSessionTarget, setTagPresentation } from '../../domain/workouts/setPresentation';
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
  onOpenDetails,
}: {
  set: WorkoutSet;
  index: number;
  trackingType: TrackingType;
  compact?: boolean;
  isLast?: boolean;
  /** Workout detail tables share the live-workout Previous column. */
  showPrevious?: boolean;
  onOpenDetails: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const tag = setTagPresentation(set.tag);
  const rpe = measurementText(set, 'rpe');
  const target = hasNextSessionTarget(set);
  const values = trackingFields[trackingType].map((kind) => measurementText(set, kind)).filter(Boolean);
  const planned = set.plannedTargets?.map((item) => item.maxValue !== undefined && item.maxValue !== item.minValue ? `${item.minValue}–${item.maxValue}` : String(item.minValue ?? item.maxValue ?? '')).filter(Boolean).join(' · ');
  const formatTarget = (item: NonNullable<WorkoutSet['plannedTargets']>[number]): string =>
    item.maxValue !== undefined && item.maxValue !== item.minValue
      ? `${item.minValue}–${item.maxValue}`
      : String(item.minValue ?? item.maxValue ?? '');
  // A recorded value wins; otherwise show the set's planned target (routines
  // have targets, not recordings) and fall back to a clean dash rather than a
  // wrapping "Not recorded" inside the narrow value box.
  const valueFor = (kind: SetMeasurementKind): string => {
    const recorded = measurementText(set, kind);
    if (recorded) return recorded;
    const targetForKind = set.plannedTargets?.find((item) => item.kind === kind)
      ?? set.targets?.find((item) => item.kind === kind);
    return targetForKind ? formatTarget(targetForKind) || '—' : '—';
  };
  if (compact) {
    return <View style={[styles.compactRow, { borderTopColor: theme.divider }]}>
      <View style={styles.compactCopy}>
        <View style={styles.compactMetricsLine}>
          <Text style={styles.metrics}>{values.length ? values.join(' × ') : 'Not recorded'}</Text>
          {rpe ? <Text style={[styles.compactRpe, { color: theme.textSecondary }]}>{`RPE ${rpe}`}</Text> : null}
        </View>
        {planned ? <Text style={[styles.planned, { color: theme.textSecondary }]}>{planned}</Text> : null}
        {set.comment?.trim() ? <Text numberOfLines={2} style={[styles.comment, { color: theme.textSecondary }]}>{`“${set.comment.trim()}”`}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open details for set ${index + 1}`} onPress={() => { selectionHaptic(); onOpenDetails(); }} style={({ pressed }) => [styles.compactChipButton, pressed && styles.compactChipPressed]}>
        <View testID={`history-set-number-chip-${index + 1}`} style={styles.chipWrap}><Text style={[styles.chip, tag && { color: tag.color, backgroundColor: `${tag.color}20` }]}>{tag?.letter ?? index + 1}</Text>{target ? <View accessibilityLabel={`Set ${index + 1} has a next session target`} style={[styles.targetDot, { backgroundColor: theme.setTargetIndicator }]} /> : null}{set.comment?.trim() ? <View accessibilityLabel={`Set ${index + 1} has a comment`} style={[styles.commentDot, { backgroundColor: theme.ink }]} /> : null}</View>
      </Pressable>
    </View>;
  }
  return <View testID={`workout-details-set-${set.id}`} style={[styles.fullRow, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}><Pressable accessibilityRole="button" accessibilityLabel={`Open details for set ${index + 1}`} onPress={() => { selectionHaptic(); onOpenDetails(); }} style={styles.numberButton}><View testID={`history-set-number-chip-${index + 1}`} style={styles.chipWrap}><Text style={[styles.chip, tag && { color: tag.color, backgroundColor: `${tag.color}20` }]}>{tag?.letter ?? index + 1}</Text>{target ? <View accessibilityLabel={`Set ${index + 1} has a next session target`} style={[styles.targetDot, { backgroundColor: theme.setTargetIndicator }]} /> : null}{rpe ? <Text accessibilityLabel={`Set ${index + 1} RPE ${rpe}`} style={styles.rpe}>{rpe}</Text> : null}{set.comment?.trim() ? <View accessibilityLabel={`Set ${index + 1} has a comment`} style={[styles.commentDot, { backgroundColor: theme.ink }]} /> : null}</View></Pressable>{showPrevious ? <Text style={styles.previous}>{set.previous?.trim() || 'Not recorded'}</Text> : null}{trackingFields[trackingType].map((kind) => <View key={kind} accessibilityLabel={trackingFieldLabel(trackingType, kind)} style={[styles.value, { borderColor: theme.divider, backgroundColor: theme.surfaceMuted }]}><Text numberOfLines={1} style={styles.valueText}>{valueFor(kind)}</Text></View>)}<View style={styles.check}><CompletionCheck selected={set.completed} testID={`workout-details-set-completion-${set.id}`} /></View></View>;
}

const createStyles = (theme: import('../../types').ForgeTheme) => StyleSheet.create({
  fullRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  numberButton: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
  chipWrap: { position: 'relative', width: 30, height: 30 },
  chip: { width: 30, height: 30, borderRadius: 9, textAlign: 'center', color: theme.ink, backgroundColor: theme.surfaceMuted, ...typeScale.caption, lineHeight: 30 },
  targetDot: { position: 'absolute', top: 1, left: 1, width: 7, height: 7, borderRadius: 4 },
  commentDot: { position: 'absolute', right: 1, bottom: 1, width: 7, height: 7, borderRadius: 4 },
  rpe: { position: 'absolute', left: 3, bottom: 1, color: theme.ink, ...typeScale.caption },
  value: { width: 60, minHeight: 36, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  valueText: { color: theme.ink, ...typeScale.body },
  previous: { flex: 1, minWidth: 0, color: theme.ink, ...typeScale.body, textAlign: 'center' },
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  compactRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  compactCopy: { flex: 1, minWidth: 0, gap: 2 },
  compactMetricsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  compactChipButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  compactChipPressed: { opacity: 0.62 },
  metrics: { color: theme.ink, ...typeScale.cardTitle },
  compactRpe: { ...typeScale.supporting },
  planned: { ...typeScale.body },
  comment: { fontStyle: 'italic', ...typeScale.body },
});
