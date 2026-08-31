import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
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
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.surfaceMuted }, pressed && styles.pressed, style]}
    >
      <Icon name="close" size={22} color={theme.textSecondary} />
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
    backgroundColor: '#00000000',
  },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.74 },
});
