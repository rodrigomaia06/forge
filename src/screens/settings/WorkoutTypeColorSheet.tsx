import React from 'react';
import { StyleSheet } from 'react-native';
import {
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgePickerDefaultAction,
  ForgeSheetHeader,
  ForgeSheetScrollView,
} from '../../components/ui';
import { spacing } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import type { WorkoutTypePreference } from '../../types';
import { builtInWorkoutTypeColors } from '../../domain/workouts/workoutTypeDefaults';
import { WorkoutTypeCustomColorPicker } from './WorkoutTypeCustomColorPicker';

export function WorkoutTypeColorSheet({
  type,
  onChange,
  onClose,
}: {
  type: WorkoutTypePreference;
  onChange: (changes: Partial<WorkoutTypePreference>) => void;
  onClose: () => void;
}) {
  const defaultColor = type.source === 'builtIn' ? builtInWorkoutTypeColors[type.id] : undefined;
  return (
    <ForgeBottomSheet
      visible
      onClose={onClose}
      accessibilityLabel="Close workout type color"
      testID="workout-type-color-picker"
    >
      {(close) => {
        return (
          <>
            <ForgeBottomSheetHandle />
            <ForgeSheetHeader
              title="Color"
              onClose={close}
              closePosition="left"
              closeAccessibilityLabel="Close workout type color"
              trailing={
                defaultColor ? (
                  <ForgePickerDefaultAction
                    accessibilityLabel="Use default workout type color"
                    icon="restore"
                    onPress={() => {
                      onChange({ color: defaultColor, colorCustomized: false });
                      close();
                    }}
                  />
                ) : undefined
              }
            />
            <ForgeSheetScrollView
              testID="custom-color-scroll"
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              <WorkoutTypeCustomColorPicker
                color={type.color}
                onApply={(color) => {
                  onChange({ color, colorCustomized: true });
                  close();
                }}
              />
            </ForgeSheetScrollView>
          </>
        );
      }}
    </ForgeBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.screen, paddingBottom: scaleUI(32) },
});
