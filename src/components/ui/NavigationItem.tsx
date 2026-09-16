import React, { useEffect, useRef } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Icon } from './Icon';
import { ForgeText as Text } from './ForgeText';
import { colors } from '../../theme/tokens';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../../theme/motion';
import type { ForgeTheme, IconName } from '../../types';

interface NavigationItemProps {
  icon: IconName;
  label: string;
  active?: boolean;
  emphasis?: boolean;
  onPress: () => void;
  theme?: ForgeTheme;
  iconSize?: number;
  compact?: boolean;
  /** A compact, live metadata value such as the active rest countdown. */
  badge?: string;
  accessibilityLabel?: string;
}

export function NavigationItem({
  icon,
  label,
  active = false,
  emphasis = false,
  onPress,
  theme = colors,
  iconSize = 23,
  compact = false,
  badge,
  accessibilityLabel,
}: NavigationItemProps) {
  const activeProgress = useRef(new RNAnimated.Value(0)).current;
  const reducedMotion = useForgeReducedMotion();

  useEffect(() => {
    RNAnimated.timing(activeProgress, {
      toValue: active ? 1 : 0,
      duration: forgeMotionDuration(reducedMotion, forgeMotion.transition),
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [active, activeProgress, reducedMotion]);

  return (
    <View style={styles.itemAnimation}>
      <Pressable
        testID={active ? 'dashboard-nav-active' : `dashboard-nav-${label.toLowerCase()}`}
        accessibilityRole="tab"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected: active }}
        aria-selected={active}
        onPress={onPress}
        style={({ pressed }) => [
          styles.item,
          compact && styles.itemCompact,
          active && styles.activeItem,
          emphasis && styles.emphasisItem,
          pressed && styles.pressed,
        ]}
      >
        <RNAnimated.View
          style={[
            styles.iconFrame,
            compact && styles.iconFrameCompact,
            active && styles.activeIconFrame,
            active && compact && styles.activeIconFrameCompact,
            {
              opacity: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
              transform: emphasis
                ? []
                : [
                    {
                      scale: activeProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1.1],
                      }),
                    },
                  ],
            },
          ]}
        >
          <Icon
            name={
              (active || emphasis
                ? icon.replace('-outline', '')
                : icon) as import('../../types').IconName
            }
            size={iconSize}
            color={
              active
                ? theme.dockForeground || theme.surface
                : emphasis
                  ? theme.actionPrimary
                  : theme.dockMuted || theme.slate
            }
            weight={emphasis ? 'thin' : active ? 'fill' : 'regular'}
          />
          {badge ? <View style={[styles.badge, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Text style={[styles.badgeText, { color: theme.textPrimary }]}>{badge}</Text>
          </View> : null}
        </RNAnimated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  itemAnimation: { flex: 1, alignItems: 'center' },
  item: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    minHeight: 52,
    paddingHorizontal: 3,
    borderRadius: 1000,
    marginVertical: 3,
  },
  iconFrame: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconFrameCompact: { width: 44, height: 44, borderRadius: 22 },
  activeItem: { width: '100%', marginHorizontal: 2 },
  emphasisItem: { width: '100%', marginHorizontal: 2 },
  activeIconFrame: { width: 44, height: 44, borderRadius: 22 },
  activeIconFrameCompact: { width: 44, height: 44, borderRadius: 22 },
  inactiveLabel: { opacity: 0.68 },
  activeLabel: { color: colors.selectionIndicator, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -16,
    minWidth: 34,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typeScale.caption, fontVariant: ['tabular-nums'], lineHeight: 14 },
  pressed: { opacity: 0.65 },
  itemCompact: { height: 44, minHeight: 44, marginVertical: 0 },
});
