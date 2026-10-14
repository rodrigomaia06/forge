import React, { useEffect, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolate,
  useDerivedValue,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { BottomNavigation } from './BottomNavigation';
import { dashboardTheme } from '../theme/dashboardTheme';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../theme/motion';
import type { ForgeTheme } from '../types';
import { radii, shadows } from '../theme/tokens';
import { forgeDockGeometry, getDockWidths } from './dockGeometry';

interface DockSurfaceProps {
  theme?: ForgeTheme;
  testID?: string;
  dockRef?: Ref<View>;
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: ReactNode;
  compact?: boolean;
  compactProgress?: SharedValue<number>;
  activeWorkout?: boolean;
  onNavigate?: () => void;
  tabBarProps: BottomTabBarProps;
}
export function DockSurface({
  theme = dashboardTheme,
  testID,
  dockRef,
  onLayout,
  children,
  compact = false,
  compactProgress,
  activeWorkout = false,
  onNavigate,
  tabBarProps,
}: DockSurfaceProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const internalProgress = useSharedValue(compact ? 1 : 0);
  const progress = compactProgress ?? internalProgress;
  const widths = getDockWidths(viewportWidth);
  const regularWidth = widths.regular;
  const activeWorkoutWidth = widths.activeWorkout;
  const compactWidth = widths.compact;
  const activeWorkoutProgress = useSharedValue(activeWorkout ? 1 : 0);
  const reducedMotion = useForgeReducedMotion();
  const surfaceWidth = useDerivedValue(() => {
    const expandedWidth = interpolate(
      activeWorkoutProgress.value,
      [0, 1],
      [regularWidth, activeWorkoutWidth],
    );
    return interpolate(progress.value, [0, 1], [expandedWidth, compactWidth]);
  }, [activeWorkoutWidth, compactWidth, regularWidth]);

  useEffect(() => {
    if (compactProgress) return;
    internalProgress.value = withTiming(compact ? 1 : 0, {
      duration: forgeMotionDuration(reducedMotion, forgeMotion.transition),
      easing: forgeMotion.easing,
    });
  }, [compact, compactProgress, internalProgress, reducedMotion]);

  useEffect(() => {
    activeWorkoutProgress.value = withTiming(activeWorkout ? 1 : 0, {
      duration: forgeMotionDuration(reducedMotion, forgeMotion.transition),
      easing: forgeMotion.easing,
    });
  }, [activeWorkout, activeWorkoutProgress, reducedMotion]);

  // Preserve the established intrinsic sizes (navigation, padding and border)
  // while keeping tab children outside the resizing background.
  const surfaceHeight = useDerivedValue(() =>
    interpolate(
      progress.get(),
      [0, 1],
      [forgeDockGeometry.surfaceHeight, forgeDockGeometry.compactSurfaceHeight],
    ),
  );
  const surfaceAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: surfaceWidth.value,
      height: surfaceHeight.get(),
      transform: [{ translateX: (activeWorkoutWidth - surfaceWidth.get()) / 2 }],
    };
  }, [activeWorkoutWidth, compactWidth, regularWidth]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        width: activeWorkoutWidth,
        height: forgeDockGeometry.surfaceHeight,
        alignSelf: 'center',
      }}
    >
      <Animated.View
        ref={dockRef}
        onLayout={onLayout}
        testID={testID}
        style={[
          styles.dock,
          surfaceAnimatedStyle,
          {
            borderColor:
              theme.colorScheme === 'light' ? theme.divider : (theme.dockBorder ?? theme.border),
            shadowColor: theme.shadow,
          },
        ]}
      >
        {/* Frosted translucency (same treatment on every device — no native Liquid
          Glass): the system blur samples the content behind the dock, and a
          low-opacity dock-coloured film keeps it recognisably Forge. */}
        <BlurView
          // Light backdrops are low-contrast, so the same blur reads weaker than in Dark —
          // raise the intensity and thin the tint film in Light so the frost actually shows.
          intensity={theme.colorScheme === 'dark' ? 36 : 60}
          tint={theme.colorScheme === 'dark' ? 'dark' : 'light'}
          blurMethod="dimezisBlurView"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: theme.colorScheme === 'dark' ? 0.55 : 0.38,
              backgroundColor: theme.dock ?? theme.dockSurface,
            },
          ]}
        />
      </Animated.View>
      {children || (
        <BottomNavigation
          tabBarProps={tabBarProps}
          theme={{ ...theme, surface: theme.surface }}
          compact={compact}
          surfaceWidth={surfaceWidth}
          surfaceHeight={surfaceHeight}
          canvasWidth={activeWorkoutWidth}
          controlWidth={
            (Math.min(regularWidth, compactWidth) - forgeDockGeometry.horizontalInset * 2) /
            (activeWorkout ? 5 : 4)
          }
          hasActiveWorkout={activeWorkout}
          onNavigate={onNavigate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    borderRadius: radii.capsule,
    borderWidth: 1,
    paddingHorizontal: 6,
    ...shadows.dock,
  },
});
