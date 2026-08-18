import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/tokens';

const items = [
  ['calendar-outline', 'Dashboard', true],
  ['layers-outline', 'Plans', false],
  ['time-outline', 'History', false],
  ['ellipsis-horizontal', 'More', false],
];

export function BottomNavigation() {
  return (
    <View style={styles.navigation}>
      {items.map(([icon, label, active]) => (
        <Pressable key={label} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <Ionicons name={active ? icon.replace('-outline', '') : icon} size={22} color={active ? colors.inkInteractive : colors.slate} />
          <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', minHeight: 76, paddingBottom: 7, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  item: { alignItems: 'center', justifyContent: 'center', minWidth: 64, minHeight: 48, gap: 4 },
  label: { color: colors.slate, fontSize: 11, fontWeight: '500' },
  activeLabel: { color: colors.inkInteractive, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
