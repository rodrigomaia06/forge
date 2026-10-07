import { scaleUI } from '../../theme/scale';
import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  ForgeSingleSelectList,
  ForgeCard,
  ForgeSheetScrollView,
} from '../../components/ui';
import type { TrackingType, WorkoutExercise } from '../../types';
import {
  effectiveTracking,
  trackingChoices,
  trackingModeLabel,
  trackingFields,
} from '../../domain/exercises/tracking';
import { hasRecordedSets, losesTrackingData } from '../../domain/exercises/trackingChanges';
import { spacing } from '../../theme/tokens';

export function TrackingChoices({
  exercise,
  onSelect,
}: {
  exercise: WorkoutExercise;
  onSelect: (mode: TrackingType) => void;
}) {
  const [pending, setPending] = useState<TrackingType | null>(null);
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
    ? trackingFields[current]
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
              if (!recorded && losesTrackingData(exercise, mode)) setPending(mode);
              else onSelect(mode);
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
            onPress={() => onSelect(pending)}
          />
          <Button
            label="Keep current tracking"
            variant="secondary"
            onPress={() => setPending(null)}
          />
        </View>
      ) : null}
    </ForgeSheetScrollView>
  );
}
