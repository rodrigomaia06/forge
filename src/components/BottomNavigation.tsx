import React, { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Platform, UIManager, View, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { NavigationItem, selectionHaptic } from './ui';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { colors } from '../theme/tokens';
import { useSettings } from '../state/SettingsContext';
import { useWorkouts } from '../state/WorkoutContext';
import { useRestTimer } from '../state/RestTimerContext';
import type { ForgeTheme, IconName, RootTabParamList } from '../types';

interface BottomNavigationProps {
  tabBarProps: BottomTabBarProps;
  theme?: ForgeTheme;
  compact?: boolean;
  onNavigate?: () => void;
}
type BottomNavigationScreen = keyof RootTabParamList;
type NavigationItemEntry = [IconName, string, BottomNavigationScreen, boolean, string?];
type ItemLayout = { x: number; width: number };

let knownWorkoutId: string | null | undefined;

function formatDockRest(seconds: number): string {
  const absolute = Math.abs(seconds);
  return `${seconds < 0 ? '+' : ''}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
}

export function BottomNavigation({
  tabBarProps,
  theme = colors,
  compact = false,
  onNavigate,
}: BottomNavigationProps) {
  const { navigation, state } = tabBarProps;
  const activeWorkout = useWorkouts().activeWorkout;
  const { endAt: restEndAt } = useRestTimer();
  const { preferences } = useSettings();
  const [restNow, setRestNow] = useState(() => Date.now());
  useEffect(() => {
    if (!restEndAt) return undefined;
    setRestNow(Date.now());
    const interval = setInterval(() => setRestNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [restEndAt]);
  const restRemaining = restEndAt ? Math.ceil((restEndAt - restNow) / 1000) : 0;
  const restRunning = Boolean(restEndAt && (restRemaining > 0 || preferences.keepRestTimerRunning));
  const [itemLayouts, setItemLayouts] = useState<
    Partial<Record<BottomNavigationScreen, ItemLayout>>
  >({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const hasActiveWorkout = Boolean(activeWorkout);
  const restBadge = preferences.showRestTimer && restRunning ? formatDockRest(restRemaining) : undefined;
  const activeWorkoutIcon = activeWorkout
    ? getWorkoutTypePresentation(activeWorkout.type, preferences.workoutTypes, theme, 1).icon
    : 'fitness-outline';
  const workoutStartedNow =
    activeWorkout?.id !== undefined &&
    activeWorkout.id !== knownWorkoutId &&
    knownWorkoutId !== undefined;
  knownWorkoutId = activeWorkout?.id ?? null;
  const workoutPresence = useRef(hasActiveWorkout);
  useEffect(() => {
    if (workoutPresence.current === hasActiveWorkout) return;
    if (Platform.OS !== 'web') {
      if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    workoutPresence.current = hasActiveWorkout;
  }, [hasActiveWorkout]);
  const items: NavigationItemEntry[] = [
    ['home-outline', 'Dashboard', 'Dashboard', false],
    ['time-outline', 'History', 'History', false],
    ...(activeWorkout
      ? [[activeWorkoutIcon, 'Workout', 'ActiveWorkout', true, restBadge] as NavigationItemEntry]
      : []),
    ['book', 'Plans', 'Plans', false],
    ['menu', 'Settings', 'Settings', false],
  ];
  const activeRoute = state.routes[state.index]?.name as BottomNavigationScreen;

  useEffect(() => {
    const layout = itemLayouts[activeRoute];
    if (!layout) return;
    const compactWorkoutSelection = compact && activeRoute === 'ActiveWorkout';
    const transition = (next: number) =>
      reducedMotion ? next : withTiming(next, { duration: 150, easing: Easing.out(Easing.cubic) });
    // The compact workout destination keeps a visibly horizontal capsule rather
    // than collapsing into a near-circle around its larger type icon.
    indicatorX.value = transition(layout.x + (compactWorkoutSelection ? -5 : 2));
    indicatorWidth.value = transition(
      Math.max(0, layout.width + (compactWorkoutSelection ? 10 : -4)),
    );
    indicatorOpacity.value = transition(1);
  }, [activeRoute, indicatorOpacity, indicatorWidth, indicatorX, itemLayouts, reducedMotion]);

  const selectionIndicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    width: indicatorWidth.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  const updateItemLayout = (screen: BottomNavigationScreen, event: LayoutChangeEvent): void => {
    const { x, width } = event.nativeEvent.layout;
    setItemLayouts((current) => {
      const previous = current[screen];
      if (previous?.x === x && previous.width === width) return current;
      return { ...current, [screen]: { x, width } };
    });
  };

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
    <View style={[styles.navigation, compact && styles.navigationCompact]}>
      <Animated.View
        testID="dashboard-nav-selection-pill"
        style={[
          styles.selectionPill,
          styles.pointerEventsNone,
          compact && styles.selectionPillCompact,
          selectionIndicatorStyle,
          {
            backgroundColor:
              activeRoute === 'ActiveWorkout'
                ? theme.actionPrimary
                : theme.dockSelected || theme.slate,
          },
        ]}
      />
      {items.map(([icon, label, screen, emphasis, badge]) => {
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
            onLayout={(event) => updateItemLayout(screen, event)}
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
              enterFromBottom={emphasis && workoutStartedNow}
              compact={compact}
              badge={badge}
              accessibilityLabel={badge ? `${label}, rest ${badge} ${restRemaining < 0 ? 'overdue' : 'remaining'}` : label}
            />
          </View>
        );
      })}
    </View>
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
