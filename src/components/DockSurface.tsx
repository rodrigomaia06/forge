import React, { useEffect, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BottomNavigation } from './BottomNavigation';
import { dashboardTheme } from '../theme/dashboardTheme';
import type { ForgeTheme } from '../types';

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
}: DockSurfaceProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const internalProgress = useSharedValue(compact ? 1 : 0);
  const progress = compactProgress ?? internalProgress;
  const regularWidth = Math.min(Math.max(viewportWidth * 0.82, 304), 360);
  const activeWorkoutWidth = Math.min(Math.max(viewportWidth * 0.88, 320), 390);
  const compactWidth = Math.min(Math.max(viewportWidth * 0.62, 244), 270);
  const activeWorkoutProgress = useSharedValue(activeWorkout ? 1 : 0);

  useEffect(() => {
    if (compactProgress) return;
    internalProgress.value = withTiming(compact ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [compact, compactProgress, internalProgress]);

  useEffect(() => {
    activeWorkoutProgress.value = withTiming(activeWorkout ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeWorkout, activeWorkoutProgress]);

  const surfaceAnimatedStyle = useAnimatedStyle(
    () => {
      const expandedWidth = interpolate(
        activeWorkoutProgress.value,
        [0, 1],
        [regularWidth, activeWorkoutWidth],
      );
      return {
        width: interpolate(progress.value, [0, 1], [expandedWidth, compactWidth]),
        minHeight: interpolate(progress.value, [0, 1], [64, 48]),
      };
    },
    [activeWorkoutWidth, compactWidth, regularWidth],
  );

  return (
    <Animated.View
      ref={dockRef}
      onLayout={onLayout}
      testID={testID}
      style={[
        styles.dock,
        surfaceAnimatedStyle,
        { backgroundColor: theme.dock ?? theme.dockSurface, borderColor: theme.border ?? theme.dockBorder, shadowColor: theme.shadow },
      ]}
    >
      {children || (
        <BottomNavigation
          theme={{ ...theme, surface: theme.surface }}
          compact={compact}
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
