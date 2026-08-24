import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from './ui';
import { colors, radii, typography } from '../theme/tokens';
import type { ForgeTheme, IconName } from '../types';

export function IconButton({
  name,
  label,
  onPress,
  filled = false,
  title,
  theme = colors,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  filled?: boolean;
  title?: string;
  theme?: ForgeTheme;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        title ? styles.action : styles.icon,
        filled && styles.filled,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={name} size={20} color={filled ? theme.surface : theme.ink} />
      {title && <Text style={styles.actionText}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.iconButton,
    backgroundColor: colors.surfaceMuted,
  },
  action: {
    flexDirection: 'row',
    gap: 7,
    minWidth: 92,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.control,
  },
  filled: { backgroundColor: colors.inkInteractive },
  actionText: {
    color: colors.surface,
    fontFamily: typography.semibold,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: { opacity: 0.65 },
});
