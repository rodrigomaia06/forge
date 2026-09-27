import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { useForgeTheme } from '../../theme/ThemeProvider';

interface ForgeSwitchProps {
  value: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const TRACK_PADDING = 2;
const THUMB_SIZE = 24;
// Distance the thumb travels between the off and on positions.
const THUMB_TRAVEL = TRACK_WIDTH - TRACK_PADDING * 2 - THUMB_SIZE;

/**
 * Presentational switch; the containing row owns interaction and accessibility.
 * The thumb slides and the track colour cross-fades on toggle, matching the
 * sliding-indicator motion of the shared segmented switch. Rest states are
 * identical to the static endpoints, so every existing usage just looks
 * smoother.
 */
export function ForgeSwitch({ value, disabled = false, testID, style }: ForgeSwitchProps) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    progress.value = reducedMotion
      ? target
      : withTiming(target, { duration: forgeMotion.state, easing: forgeMotion.easing });
  }, [value, reducedMotion, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.surfaceMuted, theme.selectionIndicator],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRAVEL }],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[styles.track, styles.pointerEventsNone, trackStyle, disabled && styles.disabled, style]}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: theme.surface }, thumbStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 14,
    padding: TRACK_PADDING,
    justifyContent: 'center',
  },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 12 },
  disabled: { opacity: 0.55 },
});
