import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ForgeText as Text, Icon } from './ui';
import { colors, radii, typeScale } from '../theme/tokens';
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
  actionText: { color: colors.surface, ...typeScale.supporting },
  pressed: { opacity: 0.65 },
});
