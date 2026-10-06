import { scaleUI } from '../../theme/scale';
import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  ForgeText as Text,
  ForgeSingleSelectList,
  ForgeCard,
  ForgeSheetScrollView,
} from '../../components/ui';
import type { TrackingType, WorkoutExercise } from '../../types';
import {
  effectiveTracking,
  trackingChoices,
  trackingModeLabel,
} from '../../domain/exercises/tracking';
import { hasRecordedSets, losesTrackingData } from '../../domain/exercises/trackingChanges';
import { spacing, typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';

export function TrackingChoices({
  exercise,
  onSelect,
}: {
  exercise: WorkoutExercise;
  onSelect: (mode: TrackingType) => void;
}) {
  const theme = useForgeTheme();
  const [pending, setPending] = useState<TrackingType | null>(null);
  const recorded = hasRecordedSets(exercise);
  return (
    <ForgeSheetScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: spacing.screen,
        paddingTop: scaleUI(4),
        paddingBottom: scaleUI(32),
        gap: spacing.section,
      }}
    >
      {recorded ? (
        <Text style={{ ...typeScale.supporting, color: theme.textSecondary }}>
          Completed sets stay here. A new block starts with three empty sets.
        </Text>
      ) : null}
      {!pending ? (
        <ForgeCard variant="nested" size="compact">
          <ForgeSingleSelectList
            options={trackingChoices(exercise).map((value) => ({
              value,
              label: trackingModeLabel(value),
            }))}
            selectedValue={effectiveTracking(exercise)}
            onSelect={(mode) => {
              if (!recorded && losesTrackingData(exercise, mode)) setPending(mode);
              else onSelect(mode);
            }}
          />
        </ForgeCard>
      ) : null}
      {pending ? (
        <View style={{ gap: spacing.section }}>
          <Text accessibilityRole="alert" style={{ ...typeScale.body, color: theme.textPrimary }}>
            Change to {trackingModeLabel(pending)}? Incompatible draft values and targets will be
            cleared.
          </Text>
          <Button
            label="Change tracking"
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
