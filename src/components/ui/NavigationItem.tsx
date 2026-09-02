import React, { useEffect, useRef } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from './Icon';
import { colors } from '../../theme/tokens';
import type { ForgeTheme, IconName } from '../../types';

interface NavigationItemProps {
  icon: IconName;
  label: string;
  active?: boolean;
  emphasis?: boolean;
  onPress: () => void;
  theme?: ForgeTheme;
  iconSize?: number;
  enterFromBottom?: boolean;
  compact?: boolean;
}

export function NavigationItem({
  icon,
  label,
  active = false,
  emphasis = false,
  onPress,
  theme = colors,
  iconSize = 23,
  enterFromBottom = false,
  compact = false,
}: NavigationItemProps) {
  const activeProgress = useRef(new RNAnimated.Value(active ? 1 : 0)).current;
  const entranceProgress = useSharedValue(enterFromBottom ? 0 : 1);
  const entranceStarted = useRef(false);

  useEffect(() => {
    RNAnimated.timing(activeProgress, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, activeProgress]);

  useEffect(() => {
    if (!enterFromBottom) {
      entranceStarted.current = false;
      entranceProgress.value = 1;
      return undefined;
    }
    if (entranceStarted.current) return () => cancelAnimation(entranceProgress);
    entranceProgress.value = 0;
    return () => cancelAnimation(entranceProgress);
  }, [enterFromBottom, entranceProgress]);

  const startEntranceAfterLayout = (): void => {
    if (!enterFromBottom || entranceStarted.current) return;
    entranceStarted.current = true;
    entranceProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  };

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entranceProgress.value,
  }));

  return (
    <Animated.View
      onLayout={startEntranceAfterLayout}
      style={[styles.itemAnimation, enterFromBottom && entranceStyle]}
    >
      <Pressable
        testID={active ? 'dashboard-nav-active' : `dashboard-nav-${label.toLowerCase()}`}
        accessibilityRole={emphasis ? 'button' : 'tab'}
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.item,
          compact && styles.itemCompact,
          active && [
            styles.activeItem,
            {
              backgroundColor: emphasis
                ? theme.actionPrimary
                : theme.dockSelected || theme.slate,
            },
          ],
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
              emphasis && active
                ? theme.onActionPrimary
                : emphasis
                  ? theme.actionPrimary
                : active
                  ? theme.dockForeground || theme.surface
                  : theme.dockMuted || theme.slate
            }
            weight={emphasis ? 'thin' : active ? 'fill' : 'regular'}
          />
        </RNAnimated.View>
      </Pressable>
    </Animated.View>
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconFrameCompact: { width: 36, height: 36, borderRadius: 18 },
  activeItem: { width: '100%', marginHorizontal: 2 },
  emphasisItem: { width: '100%', marginHorizontal: 2 },
  activeIconFrame: { width: 44, height: 44, borderRadius: 22 },
  activeIconFrameCompact: { width: 36, height: 36, borderRadius: 18 },
  inactiveLabel: { opacity: 0.68 },
  activeLabel: { color: colors.selectionIndicator, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  itemCompact: { minHeight: 42, marginVertical: 2 },
});
