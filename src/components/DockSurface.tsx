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
          // Solid dock-tone base lives on the OUTER view so iOS casts the shadow from
          // it (an `overflow:hidden` view clips its own shadow) and so the rim reads as
          // one clean surface. Glass is its own surface, so stays transparent there.
          backgroundColor: LIQUID_GLASS ? 'transparent' : (theme.dock ?? theme.dockSurface),
          shadowColor: theme.shadow,
        },
      ]}
    >
      {/* Clip layer: the frosted surface, rounded and clipped — kept separate from the
          outer shadow and from the border overlay. Putting the border + rounded blur +
          overflow all on one view is what left the native "weird edges" (the border
          seams against the clipped corner and the shadow gets clipped). */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dockClip]}>
        {LIQUID_GLASS ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            // Forge has its own theme toggle, so pin the glass appearance to it rather
            // than the device's system scheme.
            colorScheme={theme.colorScheme === 'dark' ? 'dark' : 'light'}
            // Only a whisper of brand tint; let the system glass carry the look.
            tintColor={theme.colorScheme === 'dark' ? 'rgba(23,25,28,0.08)' : 'rgba(255,255,255,0.10)'}
          />
        ) : (
          <>
            <BlurView
              // Light backdrops are low-contrast, so the same blur reads weaker than in Dark —
              // raise the intensity and thin the tint film in Light so the frost actually shows.
              intensity={theme.colorScheme === 'dark' ? 36 : 60}
              tint={theme.colorScheme === 'dark' ? 'dark' : 'light'}
              blurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[StyleSheet.absoluteFill, { opacity: theme.colorScheme === 'dark' ? 0.55 : 0.38, backgroundColor: theme.dock ?? theme.dockSurface }]}
            />
          </>
        )}
      </View>
      {/* Crisp border ring on top of the clipped surface — a plain overlay, so it never
          seams against the blur. None under Liquid Glass (the glass supplies its edge). */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.dockRing,
          { borderColor: LIQUID_GLASS ? 'transparent' : (theme.colorScheme === 'dark' ? theme.border : theme.divider) },
        ]}
      />
      {/* Content is inset here (not via the dock's own padding): on native iOS the
          absolute surface/border layers above are inset by the parent's padding, which
          left the frosted surface short of the rounded ends — the real "weird edges".
          Insetting the content instead lets those layers fill edge-to-edge. The 7pt
          matches the previous 6pt padding + 1pt border, so the tab/pill geometry
          (BottomNavigation's `surfaceWidth - 14`) is unchanged. */}
      <View style={styles.dockContent}>
        {children || (
          <BottomNavigation
            tabBarProps={tabBarProps}
            theme={{ ...theme, surface: theme.surface }}
            compact={compact}
            surfaceWidth={surfaceWidth}
            onNavigate={onNavigate}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    // Outer = shadow caster only: NO overflow (so iOS doesn't clip the shadow), NO
    // border (the ring is a separate overlay) and NO padding (padding would inset the
    // absolute surface layers on native). The solid base + radius come from here.
    alignSelf: 'center',
    borderRadius: 1000,
    shadowColor: '#172431',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  // Rounded clip for the frosted/glass surface — overflow:hidden, no border.
  dockClip: { borderRadius: 1000, overflow: 'hidden' },
  // Crisp 1px border ring drawn over the clipped surface.
  dockRing: { borderRadius: 1000, borderWidth: 1 },
  // Carries the content inset the dock padding used to provide (6pt pad + 1pt border).
  dockContent: { paddingHorizontal: 7 },
});
