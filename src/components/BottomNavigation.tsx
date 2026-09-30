import React, { useEffect, useRef } from 'react';
import { LayoutAnimation, Platform, UIManager, View, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { NavigationItem, selectionHaptic } from './ui';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { colors } from '../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../theme/motion';
import { useSettings } from '../state/SettingsContext';
import { useActiveWorkout } from '../state/WorkoutContext';
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
  const activeWorkout = useActiveWorkout();
  const { preferences } = useSettings();
  const indicatorOpacity = useSharedValue(0);
  const activeIndex = useSharedValue(0);
  const dragIndex = useSharedValue(0);
  const lastScrubIndex = useSharedValue(-1);
  // Grows the selection pill a touch while scrubbing, easing back on release.
  const dragScale = useSharedValue(1);
  // The tab the scrub is previewing, so its icon lights up before commit.
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
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

  const pillInitialized = useRef(false);
  useEffect(() => {
    const next = Math.max(0, currentActiveIndex);
    // On first mount, place the pill on the active tab without animating — otherwise
    // a cold launch onto a non-Dashboard tab (e.g. a workout in progress) shows the
    // pill sliding in from the Dashboard slot.
    if (!pillInitialized.current) {
      pillInitialized.current = true;
      activeIndex.value = next;
      indicatorOpacity.value = 1;
      setPreviewIndex(null);
      return;
    }
    activeIndex.value = reducedMotion ? next : withTiming(next, { duration: forgeMotion.state, easing: forgeMotion.easing });
    indicatorOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: forgeMotion.state, easing: forgeMotion.easing });
    // Once a navigation lands (from a tap or a committed scrub), the real active
    // tab is authoritative again, so drop any scrub preview.
    setPreviewIndex(null);
  }, [activeIndex, currentActiveIndex, indicatorOpacity, reducedMotion]);

  const selectionIndicatorStyle = useAnimatedStyle(() => {
    // Drive the pill from the SAME shared value that animates the dock width
    // (surfaceWidth) rather than measure(): measuring the laid-out parent lags
    // the width spring by a frame on native, so the pill trails the dock and
    // appears to "bounce" to catch up during compact/expand. Reading surfaceWidth
    // in this worklet keeps the pill in perfect lockstep. DockSurface's own 6pt
    // horizontal padding + 1pt border per side give the navigation its width.
    const navigationWidth = surfaceWidth
      ? Math.max(0, surfaceWidth.value - 14)
      : (measure(navigationRef)?.width ?? 0);
    // `navigation` has no horizontal padding, so the pill's absolute-left origin
    // and the flex slots share the same origin on every platform (no border-box
    // vs padding-box ambiguity between native and web). Each slot is an equal
    // share of the full width; the pill is inset 2pt and centered on its slot:
    // start = i*slotWidth + inset. This holds for any tab count.
    const slotWidth = Math.max(0, navigationWidth / items.length);
    // activeIndex is spring-driven in both phases — the resting position and the
    // scrub glide — so the pill always eases rather than teleports. dragScale
    // gives it a subtle lift while the finger is down.
    return {
      opacity: indicatorOpacity.value,
      width: Math.max(0, slotWidth - 4),
      transform: [
        { translateX: 2 + activeIndex.value * slotWidth },
        { scale: dragScale.value },
      ],
    };
  }, [activeIndex, dragScale, indicatorOpacity, items.length, navigationRef, surfaceWidth]);

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

  const itemCount = items.length;
  const screens = items.map(([, , screen]) => screen);
  const commitScrub = (index: number): void => {
    const screen = screens[index];
    if (screen) goTo(screen);
  };
  // Tap a tab, or press-and-drag across the dock and the highlight scrubs to the
  // slot under the finger as a live preview, committing on release (iOS-26 dock
  // feel). activeOffsetX lets a plain tap flow through to the tab buttons.
  const scrub = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onStart(() => {
      lastScrubIndex.value = -1;
      // Reduce Motion: jump to the final scale/position instead of springing.
      dragScale.value = reducedMotion ? 1.12 : withSpring(1.12, forgeMotion.dockSpring);
    })
    .onUpdate((event) => {
      if (!surfaceWidth) return;
      const navigationWidth = Math.max(0, surfaceWidth.value - 14);
      const slotWidth = itemCount > 0 ? navigationWidth / itemCount : 0;
      if (slotWidth <= 0) return;
      const index = Math.min(itemCount - 1, Math.max(0, Math.floor(event.x / slotWidth)));
      // Glide the pill toward the slot under the finger rather than teleporting.
      activeIndex.value = reducedMotion ? index : withSpring(index, forgeMotion.dockSpring);
      if (index !== lastScrubIndex.value) {
        lastScrubIndex.value = index;
        dragIndex.value = index;
        runOnJS(selectionHaptic)();
        runOnJS(setPreviewIndex)(index);
      }
    })
    .onEnd(() => {
      // Settle on the committed slot; the preview highlight holds there until the
      // navigation lands and the real active tab takes over (see the effect).
      activeIndex.value = reducedMotion ? dragIndex.value : withSpring(dragIndex.value, forgeMotion.dockSpring);
      runOnJS(commitScrub)(dragIndex.value);
    })
    .onFinalize(() => {
      dragScale.value = reducedMotion ? 1 : withSpring(1, forgeMotion.dockSpring);
    });

  return (
    <GestureDetector gesture={scrub}>
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
      {items.map(([icon, label, screen, emphasis], index) => {
        const active = activeRoute === screen;
        // While scrubbing, the previewed tab reads as selected so the icon
        // matches the pill under the finger; icon size stays keyed to the real
        // active tab so the row never resizes mid-scrub.
        const highlighted = previewIndex != null ? index === previewIndex : active;
        // The live-workout (emphasis) icon is larger (40) but wears the muted
        // slate tint, so it stands out by size without the loud accent colour.
        const iconSize = compact
          ? active
            ? emphasis
              ? 34
              : 27
            : 23
          : emphasis
            ? 40
            : hasActiveWorkout
              ? 27
              : 29;
        return (
          <View
            key={label}
            style={[styles.itemSlot, compact && styles.itemSlotCompact]}
          >
            <NavigationItem
              icon={icon}
              label={label}
              active={highlighted}
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
    </GestureDetector>
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
    paddingHorizontal: 0,
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
