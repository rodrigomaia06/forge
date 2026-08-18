import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/tokens';

export function NavigationItem({ icon, label, active = false, onPress }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Ionicons name={active ? icon.replace('-outline', '') : icon} size={22} color={active ? colors.inkInteractive : colors.slate} />
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', justifyContent: 'center', minWidth: 64, minHeight: 48, gap: 4 },
  label: { color: colors.slate, fontSize: 11, fontWeight: '500' },
  activeLabel: { color: colors.inkInteractive, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
