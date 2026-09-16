import React, { useEffect, useRef } from 'react';
import { LayoutAnimation, Platform, UIManager, View, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { NavigationItem, selectionHaptic } from './ui';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { colors } from '../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../theme/motion';
import { useSettings } from '../state/SettingsContext';
import { useWorkouts } from '../state/WorkoutContext';
import type { ForgeTheme, IconName, RootTabParamList } from '../types';

interface BottomNavigationProps {
  tabBarProps: BottomTabBarProps;
  theme?: ForgeTheme;
  compact?: boolean;
  /** UI-thread dock width; required while the surface is animating. */
  surfaceWidth?: SharedValue<number>;
  onNavigate?: () => void;
}
type BottomNavigationScreen = keyof RootTabParamList;
type NavigationItemEntry = [IconName, string, BottomNavigationScreen, boolean];

export function BottomNavigation({
  tabBarProps,
  theme = colors,
  compact = false,
  surfaceWidth,
  onNavigate,
}: BottomNavigationProps) {
  const { navigation, state } = tabBarProps;
  const activeWorkout = useWorkouts().activeWorkout;
  const { preferences } = useSettings();
  const indicatorOpacity = useSharedValue(0);
  const activeIndex = useSharedValue(0);
  const navigationRef = useAnimatedRef<Animated.View>();
  const reducedMotion = useForgeReducedMotion();
  const hasActiveWorkout = Boolean(activeWorkout);
  const activeWorkoutIcon = activeWorkout
    ? getWorkoutTypePresentation(activeWorkout.type, preferences.workoutTypes, theme, 1).icon
    : 'fitness-outline';
  const workoutPresence = useRef(hasActiveWorkout);
  useEffect(() => {
    if (workoutPresence.current === hasActiveWorkout) return;
    if (!reducedMotion && Platform.OS !== 'web') {
      if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    workoutPresence.current = hasActiveWorkout;
  }, [hasActiveWorkout, reducedMotion]);
  const items: NavigationItemEntry[] = [
    ['home-outline', 'Dashboard', 'Dashboard', false],
    ['time-outline', 'History', 'History', false],
    ...(activeWorkout
      ? [[activeWorkoutIcon, 'Workout', 'ActiveWorkout', true] as NavigationItemEntry]
      : []),
    ['book', 'Plans', 'Plans', false],
    ['menu', 'Settings', 'Settings', false],
  ];
  const activeRoute = state.routes[state.index]?.name as BottomNavigationScreen;
  const currentActiveIndex = items.findIndex(([, , screen]) => screen === activeRoute);

  useEffect(() => {
    const next = Math.max(0, currentActiveIndex);
    activeIndex.value = reducedMotion ? next : withTiming(next, { duration: forgeMotion.state, easing: forgeMotion.easing });
    indicatorOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: forgeMotion.state, easing: forgeMotion.easing });
  }, [activeIndex, currentActiveIndex, indicatorOpacity, reducedMotion]);

  const selectionIndicatorStyle = useAnimatedStyle(() => {
    // A native dock width changes on the UI thread; child onLayout callbacks
    // arrive later on JS. Read the exact flex parent in the same worklet so a
    // pill can never be calculated with mixed old/new geometry.
    const measuredWidth = measure(navigationRef)?.width;
    // Before native measurement (and on web), use DockSurface's explicit
    // 1pt border + 6pt horizontal padding per side as a stable fallback.
    const navigationWidth = measuredWidth ?? (surfaceWidth ? Math.max(0, surfaceWidth.value - 14) : 0);
    const slotWidth = Math.max(0, (navigationWidth - 4) / items.length);
    return {
      opacity: indicatorOpacity.value,
      width: Math.max(0, slotWidth - 4),
      transform: [{ translateX: 4 + activeIndex.value * slotWidth }],
    };
  }, [activeIndex, indicatorOpacity, items.length, navigationRef, surfaceWidth]);

  const goTo = (screen: BottomNavigationScreen): void => {
    const target = state.routes.find((route) => route.name === screen);
    if (!target || activeRoute === screen) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: target.key,
      canPreventDefault: true,
    });
    if (event.defaultPrevented) return;
    selectionHaptic();
    onNavigate?.();
    navigation.navigate(screen);
  };

  return (
    <Animated.View ref={navigationRef} style={[styles.navigation, compact && styles.navigationCompact]}>
      <Animated.View
        testID="dashboard-nav-selection-pill"
        style={[
          styles.selectionPill,
          styles.pointerEventsNone,
          compact && styles.selectionPillCompact,
          selectionIndicatorStyle,
          {
            backgroundColor: theme.dockSelected || theme.slate,
          },
        ]}
      />
      {items.map(([icon, label, screen, emphasis]) => {
        const active = activeRoute === screen;
        const iconSize = compact
          ? active
            ? emphasis
              ? 34
              : 26
            : 22
          : emphasis
            ? 40
            : hasActiveWorkout
              ? 26
              : 28;
        return (
          <View
            key={label}
            style={[styles.itemSlot, compact && styles.itemSlotCompact]}
          >
            <NavigationItem
              icon={icon}
              label={label}
              active={active}
              emphasis={emphasis}
              onPress={() => goTo(screen)}
              theme={theme}
              iconSize={iconSize}
              compact={compact}
              accessibilityLabel={label}
            />
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' },
  navigation: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 2,
    paddingBottom: 4,
    paddingTop: 4,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  navigationCompact: {
    minHeight: 48,
    paddingVertical: 0,
  },
  itemSlot: { flex: 1, alignItems: 'center' },
  itemSlotCompact: { height: 44, justifyContent: 'center' },
  selectionPill: {
    position: 'absolute',
    // Match the former per-item pill: its Pressable had a 3 pt vertical
    // margin inside the 4 pt dock padding, making the visible capsule 50 pt.
    top: 7,
    bottom: 7,
    borderRadius: 1000,
  },
  selectionPillCompact: { top: 2, bottom: 2 },
});
