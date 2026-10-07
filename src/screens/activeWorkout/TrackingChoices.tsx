import { scaleUI } from '../../theme/scale';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  ForgeSingleSelectList,
  ForgeCard,
  ForgeSheetScrollView,
  ForgeText,
} from '../../components/ui';
import type { TrackingType, WorkoutExercise } from '../../types';
import {
  effectiveTracking,
  trackingChoices,
  trackingModeLabel,
  trackingFields,
} from '../../domain/exercises/tracking';
import {
  hasRecordedSets,
  losesTrackingData,
  type TrackingChangeResult,
} from '../../domain/exercises/trackingChanges';
import { spacing, typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';

export function TrackingChoices({
  exercise,
  onSelect,
  onApplied,
  resolveSelection = false,
}: {
  exercise: WorkoutExercise;
  onSelect: (mode: TrackingType, confirmed?: boolean) => void | Promise<TrackingChangeResult>;
  onApplied: () => void;
  /** Live requests decide confirmation against the reducer's current block. */
  resolveSelection?: boolean;
}) {
  const theme = useForgeTheme();
  const [pending, setPending] = useState<TrackingType | null>(null);
  const [pendingExercise, setPendingExercise] = useState(exercise);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const applying = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const apply = async (mode: TrackingType, confirmed = false): Promise<void> => {
    if (applying.current) return;
    applying.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onSelect(mode, confirmed);
      if (!mounted.current) return;
      if (result?.status === 'confirmation') {
        setPendingExercise(result.exercise);
        setPending(mode);
      } else if (
        result?.status === 'missing' ||
        result?.status === 'incompatible' ||
        result?.status === 'failed'
      ) {
        setError(
          result.status === 'missing'
            ? 'This exercise is no longer in the workout.'
            : result.status === 'incompatible'
              ? 'This tracking mode is no longer available.'
              : 'Tracking could not be changed. Try again.',
        );
      } else if (result?.status !== 'unchanged') {
        onApplied();
      }
    } catch {
      if (mounted.current) setError('Tracking could not be changed. Try again.');
    } finally {
      applying.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const recorded = hasRecordedSets(exercise);
  const current = effectiveTracking(exercise);
  const fields = {
    weight: 'weight',
    addedWeight: 'load',
    reps: 'reps',
    duration: 'time',
    distance: 'distance',
    rpe: 'effort',
  };
  const cleared = pending
    ? trackingFields[effectiveTracking(pendingExercise)]
        .filter((kind) => !trackingFields[pending].includes(kind))
        .map((kind) => fields[kind])
        .join(' and ')
    : '';
  const next = pending
    ? trackingFields[pending]
        .filter((kind) => kind !== 'weight' && kind !== 'addedWeight')
        .map((kind) => fields[kind])
        .join(' and ')
    : '';
  return (
    <ForgeSheetScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: spacing.screen,
        paddingTop: scaleUI(4),
        paddingBottom: scaleUI(32),
      }}
    >
      {!pending ? (
        <ForgeCard variant="nested" size="compact">
          <ForgeSingleSelectList
            showSeparators={false}
            options={trackingChoices(exercise).map((value) => ({
              value,
              label: trackingModeLabel(value),
            }))}
            selectedValue={current}
            onSelect={(mode) => {
              if (applying.current) return;
              if (resolveSelection) {
                void apply(mode);
                return;
              }
              if (mode === current) return;
              if (!recorded && losesTrackingData(exercise, mode)) {
                setPendingExercise(exercise);
                setPending(mode);
                setError('');
              } else void apply(mode);
            }}
          />
        </ForgeCard>
      ) : null}
      {pending ? (
        <View
          accessibilityRole="alert"
          accessibilityLabel={`Change to ${trackingModeLabel(pending)}? ${cleared} values and targets will be cleared.`}
          style={{ gap: scaleUI(12) }}
        >
          <Button
            label={`Clear ${cleared} and use ${next}`}
            accessibilityLabel="Change tracking"
            accessibilityHint={`Switch to ${trackingModeLabel(pending)}. Clears ${cleared} values and targets.`}
            variant="outline"
            tone="destructive"
            disabled={busy}
            onPress={() => void apply(pending, true)}
          />
          <Button
            label="Keep current tracking"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setPending(null);
              setError('');
            }}
          />
        </View>
      ) : null}
      {error ? (
        <ForgeText
          accessibilityRole="alert"
          style={[typeScale.supporting, { color: theme.textPrimary, marginTop: scaleUI(12) }]}
        >
          {error}
        </ForgeText>
      ) : null}
    </ForgeSheetScrollView>
  );
}
