import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from './Icon';
import { colors, typography } from '../../theme/tokens';

export function NavigationItem({ icon, label, active = false, onPress, theme = colors }) {
  return (
    <Pressable
      testID={active ? 'dashboard-nav-active' : `dashboard-nav-${label.toLowerCase()}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, active && [styles.activeItem, { backgroundColor: theme.slate }], pressed && styles.pressed]}
    >
      <Icon name={active ? icon.replace('-outline', '') : icon} size={22} color={theme.surface} weight={active ? 'fill' : 'regular'} />
      <Text style={[styles.label, { color: theme.surface }, !active && styles.inactiveLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', justifyContent: 'center', minWidth: 64, minHeight: 48, paddingHorizontal: 6, gap: 4 },
  activeItem: { minWidth: 76, paddingHorizontal: 12, borderRadius: 100 },
  label: { color: colors.surface, fontFamily: typography.medium, fontSize: 11, fontWeight: '500' },
  inactiveLabel: { opacity: 0.68 },
  activeLabel: { color: colors.inkInteractive, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
