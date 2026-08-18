import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <View style={[styles.iconFrame, active && [styles.activeIconFrame, { backgroundColor: theme.dockSelected || theme.slate }]]}>
        <Icon name={active ? icon.replace('-outline', '') : icon} size={22} color={theme.dockForeground || theme.surface} weight={active ? 'fill' : 'regular'} />
      </View>
      <Text testID={`dashboard-nav-label-${label.toLowerCase()}`} style={[styles.label, { color: theme.dockForeground || theme.surface }, !active && { color: theme.dockMuted || theme.slate }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', justifyContent: 'center', minWidth: 64, minHeight: 56, paddingHorizontal: 6, gap: 2 },
  iconFrame: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  activeIconFrame: { width: 48, height: 48, borderRadius: 24 },
  label: { color: colors.ink, fontFamily: typography.medium, fontSize: 11, fontWeight: '500' },
  inactiveLabel: { opacity: 0.68 },
  activeLabel: { color: colors.inkInteractive, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
