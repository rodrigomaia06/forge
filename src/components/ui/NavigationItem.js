import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { colors } from '../../theme/tokens';

export function NavigationItem({ icon, label, active = false, emphasis = false, onPress, theme = colors }) {
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(activeProgress, { toValue: active ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [active, activeProgress]);

  return (
    <Pressable
      testID={active ? 'dashboard-nav-active' : `dashboard-nav-${label.toLowerCase()}`}
      accessibilityRole={emphasis ? 'button' : 'tab'}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, active && [styles.activeItem, { backgroundColor: theme.dockSelected || theme.slate }], emphasis && [styles.emphasisItem, { backgroundColor: theme.accent || colors.inkInteractive }], pressed && styles.pressed]}
    >
      <Animated.View style={[styles.iconFrame, active && styles.activeIconFrame, { opacity: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }), transform: [{ scale: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
        <Icon name={active || emphasis ? icon.replace('-outline', '') : icon} size={23} color={emphasis ? (theme.surface || colors.surface) : (theme.dockForeground || theme.surface)} weight={active || emphasis ? 'fill' : 'regular'} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 56, minHeight: 52, paddingHorizontal: 3, borderRadius: 1000, marginVertical: 3 },
  iconFrame: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  activeItem: { marginHorizontal: 2 },
  emphasisItem: { marginHorizontal: 2 },
  activeIconFrame: { width: 44, height: 44, borderRadius: 22 },
  inactiveLabel: { opacity: 0.68 },
  activeLabel: { color: colors.inkInteractive, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
