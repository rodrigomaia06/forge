import { scheduleOnRN } from 'react-native-worklets';
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { NavigationItem, selectionHaptic } from './ui';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { colors, radii } from '../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../theme/motion';
import { useSettings } from '../state/SettingsContext';
import { useActiveWorkout } from '../state/WorkoutContext';
import { dockIndexAtPosition, forgeDockGeometry, getDockSlotGeometry } from './dockGeometry';
import type { ForgeTheme, IconName, RootTabParamList } from '../types';

interface BottomNavigationProps {
  tabBarProps: BottomTabBarProps;
  theme?: ForgeTheme;
  compact?: boolean;
  /** UI-thread dock width; required while the surface is animating. */
  surfaceWidth: SharedValue<number>;
  surfaceHeight: SharedValue<number>;
  canvasWidth: number;
  controlWidth: number;
  hasActiveWorkout: boolean;
  onNavigate?: () => void;
}
type BottomNavigationScreen = keyof RootTabParamList;
type NavigationItemEntry = [IconName, string, BottomNavigationScreen, boolean];

export function BottomNavigation({
  tabBarProps,
  theme = colors,
  compact = false,
  surfaceWidth,
  surfaceHeight,
  canvasWidth,
  controlWidth,
  hasActiveWorkout,
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
  const reducedMotion = useForgeReducedMotion();
  const activeWorkoutIcon = activeWorkout
    ? getWorkoutTypePresentation(activeWorkout.type, preferences.workoutTypes, theme, 1).icon
    : 'fitness-outline';
  const items: NavigationItemEntry[] = [
    ['home-outline', 'Dashboard', 'Dashboard', false],
    ['time-outline', 'History', 'History', false],
    ...(hasActiveWorkout
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
    activeIndex.value = reducedMotion
      ? next
      : withTiming(next, { duration: forgeMotion.state, easing: forgeMotion.easing });
    indicatorOpacity.value = reducedMotion
      ? 1
      : withTiming(1, { duration: forgeMotion.state, easing: forgeMotion.easing });
    // Once a navigation lands (from a tap or a committed scrub), the real active
    // tab is authoritative again, so drop any scrub preview.
    setPreviewIndex(null);
  }, [activeIndex, currentActiveIndex, indicatorOpacity, reducedMotion]);

  const selectionIndicatorStyle = useAnimatedStyle(() => {
    const slot = getDockSlotGeometry(
      surfaceWidth.get(),
      surfaceHeight.get(),
      canvasWidth,
      items.length,
      activeIndex.get(),
    );
    return {
      opacity: indicatorOpacity.value,
      width: slot.indicatorWidth,
      height: slot.indicatorHeight,
      transform: [
        { translateX: slot.indicatorLeft },
        { translateY: slot.indicatorTop },
        { scale: dragScale.value },
      ],
    };
  });

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
      dragIndex.value = Math.max(0, currentActiveIndex);
      // Reduce Motion: jump to the final scale/position instead of springing.
      dragScale.value = reducedMotion ? 1.12 : withSpring(1.12, forgeMotion.dockSpring);
    })
    .onUpdate((event) => {
      const index = dockIndexAtPosition(event.x, surfaceWidth.get(), canvasWidth, itemCount);
      // Glide the pill toward the slot under the finger rather than teleporting.
      activeIndex.value = reducedMotion ? index : withSpring(index, forgeMotion.dockSpring);
      if (index !== lastScrubIndex.value) {
        lastScrubIndex.value = index;
        dragIndex.value = index;
        scheduleOnRN(selectionHaptic);
        scheduleOnRN(setPreviewIndex, index);
      }
    })
    .onEnd(() => {
      // Settle on the committed slot; the preview highlight holds there until the
      // navigation lands and the real active tab takes over (see the effect).
      activeIndex.value = reducedMotion
        ? dragIndex.value
        : withSpring(dragIndex.value, forgeMotion.dockSpring);
      scheduleOnRN(commitScrub, dragIndex.value);
    })
    .onFinalize(() => {
      dragScale.value = reducedMotion ? 1 : withSpring(1, forgeMotion.dockSpring);
    });

  return (
    <GestureDetector gesture={scrub}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.navigation,
          {
            width: canvasWidth,
            height: forgeDockGeometry.surfaceHeight,
            position: 'absolute',
            bottom: 0,
          },
        ]}
      >
        <Animated.View
          testID="dashboard-nav-selection-pill"
          style={[
            styles.selectionPill,
            styles.pointerEventsNone,
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
            <DockItemSlot
              key={label}
              index={index}
              itemCount={items.length}
              surfaceWidth={surfaceWidth}
              surfaceHeight={surfaceHeight}
              canvasWidth={canvasWidth}
              controlWidth={controlWidth}
              compact={compact}
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
            </DockItemSlot>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}

/** Keep tab content in a fixed layout; resizing only moves each slot's transform. */
function DockItemSlot({
  index,
  itemCount,
  surfaceWidth,
  surfaceHeight,
  canvasWidth,
  controlWidth,
  compact,
  children,
}: {
  index: number;
  itemCount: number;
  surfaceWidth: SharedValue<number>;
  surfaceHeight: SharedValue<number>;
  canvasWidth: number;
  controlWidth: number;
  compact: boolean;
  children: React.ReactNode;
}) {
  const position = useAnimatedStyle(() => {
    const slot = getDockSlotGeometry(
      surfaceWidth.get(),
      surfaceHeight.get(),
      canvasWidth,
      itemCount,
      index,
    );
    return {
      transform: [
        { translateX: slot.centerX - controlWidth / 2 },
        { translateY: slot.centerY - forgeDockGeometry.surfaceHeight / 2 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: controlWidth,
          height: forgeDockGeometry.surfaceHeight,
          justifyContent: 'center',
        },
        position,
      ]}
    >
      <View style={{ width: '100%', height: compact ? 44 : 58 }}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' },
  navigation: {
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  selectionPill: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radii.capsule,
  },
});
