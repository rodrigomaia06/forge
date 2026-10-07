import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import {
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgePickerDefaultAction,
  ForgeSheetHeader,
  ForgeSheetScrollView,
  Icon,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import type { WorkoutTypePreference } from '../../types';
import {
  defaultWorkoutTypeIcon,
  workoutTypeIconChoices,
} from '../../domain/workouts/workoutTypeMetadata';

export function WorkoutTypeIconSheet({
  type,
  onChange,
  onClose,
}: {
  type: WorkoutTypePreference;
  onChange: (changes: Partial<WorkoutTypePreference>) => void;
  onClose: () => void;
}) {
  const theme = useForgeTheme();
  return (
    <ForgeBottomSheet
      visible
      onClose={onClose}
      testID="workout-type-icon-picker"
      accessibilityLabel="Close workout type icon"
    >
      {(close) => (
        <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title="Icon"
            onClose={close}
            closePosition="left"
            closeAccessibilityLabel="Close workout type icon"
            trailing={
              <ForgePickerDefaultAction
                accessibilityLabel="Use default workout type icon"
                icon={defaultWorkoutTypeIcon(type.id)}
                onPress={() => {
                  if (type.icon !== undefined) onChange({ icon: undefined });
                  close();
                }}
              />
            }
          />
          <ForgeSheetScrollView
            testID="workout-type-icon-scroll"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <View
              testID="workout-type-icon-grid"
              accessibilityRole="radiogroup"
              style={styles.grid}
            >
              {workoutTypeIconChoices.map(({ value, label }) => {
                const selected = type.icon === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: selected }}
                    aria-checked={selected}
                    onPress={() => {
                      if (!selected) {
                        selectionHaptic();
                        onChange({ icon: value });
                      }
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.choice,
                      { backgroundColor: theme.surfaceElevated },
                      selected && { borderWidth: 2, borderColor: theme.selectionIndicator },
                      pressed && pressedFeedback,
                    ]}
                  >
                    <Icon name={value} size={24} color={theme.textPrimary} />
                  </Pressable>
                );
              })}
            </View>
          </ForgeSheetScrollView>
        </>
      )}
    </ForgeBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.screen, paddingBottom: scaleUI(32), gap: scaleUI(16) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: scaleUI(12) },
  choice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
