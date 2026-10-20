import { useSetRowLayout } from './useSetRowLayout';
import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ForgeText as Text } from '../../components/ui';
import {
  measurementDisplay,
  measurementText,
  trackingFieldLabel,
  trackingFields,
} from '../../domain/exercises/tracking';
import { SetNumberBadge, useSetNumberBadgeLayout } from './SetNumberBadge';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
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
  showCompletion = !compact,
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
  const { stacked, onLayout, probe } = useSetRowLayout(trackingFields[trackingType].length, showPrevious);
  const badgeLayout = useSetNumberBadgeLayout(Boolean(rpe));
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
    const targetForKind =
      set.plannedTargets?.find((item) => item.kind === kind) ??
      set.targets?.find((item) => item.kind === kind);
    return targetForKind ? formatTarget(targetForKind) || '—' : '—';
  };
  return (
    <View
      testID={`workout-details-set-${set.id}`}
      onLayout={onLayout}
      style={[
        styles.fullRow,
        stacked && styles.stackedRow,
        compact && styles.insetRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.divider,
        },
      ]}
    >
      {probe}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open details for set ${index + 1}`}
        onPress={() => {
          selectionHaptic();
          onOpenDetails();
        }}
        pressFeedbackStyle={badgeLayout.feedback}
        style={[styles.numberButton, { minHeight: Math.max(44, badgeLayout.height + 4) }]}
      >
        <SetNumberBadge set={set} index={index} testID={`history-set-number-chip-${index + 1}`} />
      </Pressable>
      {showPrevious ? (
        <Text style={[styles.previous, stacked && styles.stackedPrevious]}>{stacked ? 'Previous: ' : ''}{set.previous?.trim() || 'Not recorded'}</Text>
      ) : null}
      {trackingFields[trackingType].map((kind) => (
        <View
          key={kind}
          accessibilityLabel={trackingFieldLabel(trackingType, kind)}
          style={[
            styles.value,
            !showPrevious && styles.flexibleValue,
            stacked && styles.stackedField,
            { borderColor: theme.divider, backgroundColor: theme.surfaceMuted },
          ]}
        >
          {stacked ? <Text style={styles.valueText}>{trackingFieldLabel(trackingType, kind)}</Text> : null}
          <Text style={styles.valueText}>
            {valueFor(kind)}
          </Text>
        </View>
      ))}
      {showCompletion ? (
        <View style={styles.check}>
          <CompletionCheck
            selected={set.completed}
            testID={`workout-details-set-completion-${set.id}`}
          />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    stackedRow: { flexWrap: 'wrap' },
    stackedPrevious: { flexBasis: '70%', textAlign: 'left' },
    stackedField: { flexBasis: '100%', width: '100%', flexDirection: 'row', justifyContent: 'space-between', padding: scaleUI(8) },
    fullRow: {
      minHeight: Math.max(44, scaleUI(48)),
      paddingVertical: scaleUI(4),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    numberButton: { minWidth: 46, flexShrink: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    value: {
      width: 60,
      minHeight: scaleUI(36),
      borderWidth: 1,
      borderRadius: scaleUI(8),
      alignItems: 'center',
      justifyContent: 'center',
    },
    valueText: { flexShrink: 1, minWidth: 0, color: theme.ink, ...typeScale.body },
    previous: { flex: 1, minWidth: 0, color: theme.ink, ...typeScale.body, textAlign: 'center' },
    check: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    insetRow: { paddingHorizontal: scaleUI(12) },
    flexibleValue: { flex: 1, minWidth: 0 },
  });
