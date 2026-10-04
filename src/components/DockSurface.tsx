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
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BottomNavigation } from './BottomNavigation';
import { dashboardTheme } from '../theme/dashboardTheme';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../theme/motion';
import type { ForgeTheme } from '../types';

// Native iOS 26 Liquid Glass when available; otherwise the BlurView + tonal film
// fallback below (Android and iOS < 26). Capability is static, so read it once.
const LIQUID_GLASS = isLiquidGlassAvailable();

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
  // A 360 pt dock is the established regular Forge surface on phone widths.
  // Retaining that width also keeps the selection capsule proportional to the
  // original dock while the parent indicator moves between tabs.
  const regularWidth = Math.min(Math.max(viewportWidth * 0.86, 304), 360);
  const activeWorkoutWidth = Math.min(Math.max(viewportWidth * 0.88, 320), 390);
  // Five tabs remain visible while a workout is active. Keep their 56 pt
  // hit targets inside the compact surface so the selection pill stays
  // centred on its measured slot instead of overflowing the dock.
  const compactWidth = Math.min(Math.max(viewportWidth * 0.76, 304), 336);
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

  const surfaceAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: surfaceWidth.value,
      minHeight: interpolate(progress.value, [0, 1], [64, 48]),
    };
  }, [activeWorkoutWidth, compactWidth, regularWidth]);

  return (
    <Animated.View
      ref={dockRef}
      onLayout={onLayout}
      testID={testID}
      style={[
        styles.dock,
        surfaceAnimatedStyle,
        {
          borderColor: theme.border ?? theme.dockBorder,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {/* Frosted translucency: the system blur samples the content behind the
          dock, and a low-opacity dock-coloured film keeps it recognisably Forge
          rather than plain clear glass. Falls back to the tint film alone where
          a platform cannot blur. */}
      {LIQUID_GLASS ? (
        <GlassView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          // Forge has its own theme toggle, so pin the glass appearance to it rather
          // than the device's system scheme.
          colorScheme={theme.colorScheme === 'dark' ? 'dark' : 'light'}
          tintColor={theme.colorScheme === 'dark' ? 'rgba(23,25,28,0.28)' : 'rgba(250,250,248,0.28)'}
        />
      ) : (
        <>
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
            style={[StyleSheet.absoluteFill, { opacity: theme.colorScheme === 'dark' ? 0.55 : 0.38, backgroundColor: theme.dock ?? theme.dockSurface }]}
          />
        </>
      )}
      {children || (
        <BottomNavigation
          tabBarProps={tabBarProps}
          theme={{ ...theme, surface: theme.surface }}
          compact={compact}
          surfaceWidth={surfaceWidth}
          onNavigate={onNavigate}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 1000,
    borderWidth: 1,
    paddingHorizontal: 6,
    shadowColor: '#172431',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
});
