import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from './Icon';
import { colors, typography } from '../../theme/tokens';

export function NavigationItem({ icon, label, active = false, onPress, theme = colors }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, active && styles.activeItem, pressed && styles.pressed]}
    >
      <Icon name={active ? icon.replace('-outline', '') : icon} size={22} color={active ? theme.accent : theme.slate} weight={active ? 'fill' : 'regular'} />
      <Text style={[styles.label, { color: theme.slate }, active && { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', justifyContent: 'center', minWidth: 64, minHeight: 48, paddingHorizontal: 6, gap: 4 },
  activeItem: { minWidth: 84, paddingHorizontal: 14, borderRadius: 100, backgroundColor: colors.surfaceMuted },
  label: { color: colors.slate, fontFamily: typography.medium, fontSize: 11, fontWeight: '500' },
  activeLabel: { color: colors.inkInteractive, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
