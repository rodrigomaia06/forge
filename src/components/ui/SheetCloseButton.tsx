import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { dashboardTheme } from '../../theme/dashboardTheme';
import { Icon } from './Icon';
import { lightHaptic } from './haptics';

interface SheetCloseButtonProps {
  accessibilityLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Shared dismiss action for Forge sheets and modal surfaces. */
export function SheetCloseButton({
  accessibilityLabel = 'Close',
  onPress,
  style,
}: SheetCloseButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Icon name="close" size={22} color={dashboardTheme.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.74 },
});
