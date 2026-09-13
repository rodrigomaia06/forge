import React, { useEffect, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DockSurface } from './DockSurface';
import { useWorkouts } from '../state/WorkoutContext';
import { dashboardTheme } from '../theme/dashboardTheme';
import type { ForgeTheme } from '../types';

/** Geometry shared by the floating primary dock and the tab scenes beneath it. */
export const forgeDockGeometry = {
  surfaceHeight: 64,
  compactSurfaceHeight: 48,
  minimumBottomClearance: 12,
  surfaceToContentGap: 12,
} as const;

/**
 * Keeps the floating surface above the home indicator without introducing a
 * separate safe-area band below tab content.
 */
export function useForgeDockBottomOffset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(
    forgeDockGeometry.minimumBottomClearance,
    insets.bottom - forgeDockGeometry.minimumBottomClearance,
  );
}

/**
 * Trailing room needed for a final tab-scene control to clear the floating
 * dock completely. It deliberately includes the dock's actual occupied area,
 * rather than a disconnected tab-bar height.
 */
export function useForgeDockScrollInset(): number {
  const bottomOffset = useForgeDockBottomOffset();
  return forgeDockGeometry.surfaceHeight + bottomOffset + forgeDockGeometry.surfaceToContentGap;
}

interface DockChromeProps {
  theme?: ForgeTheme;
  style?: StyleProp<ViewStyle>;
  slotRef?: Ref<View>;
  onLayout?: (event: LayoutChangeEvent) => void;
  slotTestID?: string;
  cylinderRef?: Ref<View>;
  cylinderOnLayout?: (event: LayoutChangeEvent) => void;
  cylinderTestID?: string;
  vignetteTestID?: string;
  indicatorTestID?: string;
  compact?: boolean;
  onInteract?: () => void;
  tabBarProps: BottomTabBarProps;
  children?: ReactNode;
}

export function DockChrome({
  theme = dashboardTheme,
  style,
  slotRef,
  onLayout,
  slotTestID,
  cylinderRef,
  cylinderOnLayout,
  cylinderTestID,
  vignetteTestID,
  indicatorTestID,
  compact = false,
  onInteract,
  tabBarProps,
}: DockChromeProps) {
  const hasActiveWorkout = Boolean(useWorkouts().activeWorkout);
  const bottomOffset = useForgeDockBottomOffset();
  const gradientId = `dockFade${slotTestID || cylinderTestID || 'shared'}`.replace(
    /[^a-zA-Z0-9]/g,
    '',
  );
  const compactProgress = useSharedValue(compact ? 1 : 0);

  useEffect(() => {
    compactProgress.value = withSpring(compact ? 1 : 0, {
      damping: 22,
      stiffness: 340,
      mass: 0.55,
      overshootClamping: true,
    });
  }, [compact, compactProgress]);

  return (
    <View
      ref={slotRef}
      onLayout={onLayout}
      testID={slotTestID}
      onTouchStart={onInteract}
      style={[styles.slot, styles.pointerEventsBoxNone, style]}
    >
      <Svg testID={vignetteTestID} style={[styles.vignette, styles.pointerEventsNone]}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.background} stopOpacity="0" />
            <Stop offset="0.42" stopColor={theme.background} stopOpacity="0.14" />
            <Stop offset="0.74" stopColor={theme.background} stopOpacity="0.42" />
            <Stop offset="1" stopColor={theme.background} stopOpacity="0.72" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <View style={[styles.dockLayer, styles.pointerEventsBoxNone, { bottom: bottomOffset }]}>
        <DockSurface
          theme={theme}
          compact={compact}
          compactProgress={compactProgress}
          activeWorkout={hasActiveWorkout}
          onNavigate={onInteract}
          tabBarProps={tabBarProps}
          dockRef={cylinderRef}
          onLayout={cylinderOnLayout}
          testID={cylinderTestID}
        />
      </View>
      {(indicatorTestID || !slotTestID) && (
        <View
          testID={indicatorTestID}
          accessibilityLabel="Home indicator"
          style={[
            styles.homeIndicator,
            styles.pointerEventsNone,
            { backgroundColor: theme.dockForeground || theme.ink },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: forgeDockGeometry.surfaceHeight + 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    zIndex: 10,
  },
  pointerEventsNone: { pointerEvents: 'none' },
  pointerEventsBoxNone: { pointerEvents: 'box-none' },
  vignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 104, zIndex: 0 },
  dockLayer: {
    ...StyleSheet.absoluteFill,
    // Float over the lower safe area without turning it into an empty band.
    // The vignette continues underneath the surface to the screen edge.
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 3,
    width: 94,
    height: 4,
    borderRadius: 4,
    opacity: 0,
  },
});
