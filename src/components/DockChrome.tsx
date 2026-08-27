import React, { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { DockSurface } from './DockSurface';
import { dashboardTheme } from '../theme/dashboardTheme';
import type { ForgeTheme } from '../types';

let expandFromCompactAfterTabChange = false;

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
}: DockChromeProps) {
  const gradientId = `dockFade${slotTestID || cylinderTestID || 'shared'}`.replace(
    /[^a-zA-Z0-9]/g,
    '',
  );
  const entersCompact = useRef(compact || expandFromCompactAfterTabChange).current;
  expandFromCompactAfterTabChange = false;
  const compactProgress = useSharedValue(entersCompact ? 1 : 0);
  const entranceProgress = useSharedValue(0);

  useEffect(() => {
    compactProgress.value = withSpring(compact ? 1 : 0, {
      damping: 24,
      stiffness: 260,
      mass: 0.7,
      overshootClamping: true,
    });
  }, [compact, compactProgress]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      entranceProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    });
    return () => cancelAnimationFrame(frame);
  }, [entranceProgress]);

  const dockAnimatedStyle = useAnimatedStyle(() => ({
    opacity: entranceProgress.value,
    transform: [{ translateY: 14 * (1 - entranceProgress.value) }],
  }));

  return (
    <View
      ref={slotRef}
      onLayout={onLayout}
      testID={slotTestID}
      pointerEvents="box-none"
      onTouchStart={onInteract}
      style={[styles.slot, style]}
    >
      <Svg pointerEvents="none" testID={vignetteTestID} style={styles.vignette}>
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
      <Animated.View pointerEvents="box-none" style={[styles.dockLayer, dockAnimatedStyle]}>
        <DockSurface
          theme={theme}
          compact={compact}
          compactProgress={compactProgress}
          onNavigate={() => {
            expandFromCompactAfterTabChange = compact;
          }}
          dockRef={cylinderRef}
          onLayout={cylinderOnLayout}
          testID={cylinderTestID}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    zIndex: 10,
  },
  vignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, zIndex: 0 },
  dockLayer: {
    ...StyleSheet.absoluteFillObject,
    bottom: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
