import { centeredPressFeedback, ForgePressable as Pressable } from './ForgePressable';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { useForgeTheme } from '../../theme/ThemeProvider';
import type { IconName } from '../../types';
import { ForgeText as Text } from './ForgeText';
import { typeScale } from '../../theme/tokens';
import { Icon } from './Icon';
import { selectionHaptic } from './haptics';

const PAD = 3;
const SIZE = 44;

export type ForgeSegmentedOption<T> = {
  value: T;
  label: string;
  /** Required for the icon pill; labelled switches (`showLabels`) show only the label. */
  icon?: IconName;
  /** A fuller spoken name when the visible label is terse (e.g. "Left"). */
  accessibilityLabel?: string;
};

/**
 * A compact icon pill whose selection is marked by a ring that springs between
 * options — the sliding-indicator pattern. Each option is a fixed circular
 * button, so the indicator can slide by a constant step without measuring.
 *
 * With `showLabels` it is a text segmented control whose filled pill slides
 * between equal-width segments: `standard` fills its row, `compact` hugs its
 * labels (each segment as wide as the widest label) for card headers while
 * keeping the 15 pt control label and a 44 pt touch target.
 */
export function ForgeSegmentedSwitch<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  showLabels = false,
  size = 'standard',
}: {
  options: readonly ForgeSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  showLabels?: boolean;
  size?: 'standard' | 'compact';
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const translateX = useSharedValue(index * SIZE);
  useEffect(() => {
    const target = index * SIZE;
    translateX.value = reducedMotion
      ? target
      : withSpring(target, forgeMotion.dockSpring);
  }, [index, reducedMotion, translateX]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const labelWidth = useSharedValue(0);
  const labelPosition = useSharedValue(index);
  useEffect(() => {
    labelPosition.set(
      reducedMotion
        ? index
        : withTiming(index, {
            duration: forgeMotion.state,
            easing: forgeMotion.easing,
          }),
    );
  }, [index, labelPosition, reducedMotion]);
  // Compact labelled segments size to the widest label so the pill can slide by an
  // even step; standard segments share the measured row width instead.
  const compactLabels = showLabels && size === 'compact';
  const [segmentWidth, setSegmentWidth] = useState(0);
  const measuredSegments = useRef<number[]>([]);
  const measureSegment = (segment: number, width: number) => {
    measuredSegments.current[segment] = width;
    const widths = measuredSegments.current.slice(0, options.length);
    if (widths.length < options.length || widths.some((w) => !w)) return;
    const widest = Math.ceil(Math.max(...widths));
    if (widest > segmentWidth) {
      setSegmentWidth(widest);
      labelWidth.set(widest);
    }
  };
  const labelIndicatorStyle = useAnimatedStyle(() => ({
    width: labelWidth.get(),
    transform: [{ translateX: labelPosition.get() * labelWidth.get() }],
  }));

  if (showLabels)
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.track,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          compactLabels && styles.compactLabelTrack,
        ]}
      >
        <View
          style={compactLabels ? styles.compactLabelSegments : styles.labelSegments}
          onLayout={
            compactLabels
              ? undefined
              : (event) => labelWidth.set(event.nativeEvent.layout.width / Math.max(1, options.length))
          }
        >
          <Animated.View
            testID="forge-segmented-label-indicator"
            pointerEvents="none"
            style={[
              styles.labelIndicator,
              { backgroundColor: theme.actionPrimary },
              labelIndicatorStyle,
            ]}
          />
          {options.map((option, segment) => (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === value }}
              aria-checked={option.value === value}
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              onPress={() => {
                if (option.value === value) return;
                selectionHaptic();
                onChange(option.value);
              }}
              onLayout={
                compactLabels
                  ? (event) => measureSegment(segment, event.nativeEvent.layout.width)
                  : undefined
              }
              hitSlop={compactLabels ? { top: 6, bottom: 6 } : undefined}
              style={
                compactLabels
                  ? [styles.compactLabelSegment, segmentWidth ? { minWidth: segmentWidth } : null]
                  : styles.labelSegment
              }
            >
              <Text
                numberOfLines={compactLabels ? 1 : undefined}
                style={[
                  typeScale.controlLabel,
                  compactLabels ? styles.compactLabelText : styles.labelText,
                  { color: option.value === value ? theme.onActionPrimary : theme.textPrimary },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        size === 'compact' && styles.compactTrack,
      ]}
    >
      {size === 'compact' ? (
        <View
          pointerEvents="none"
          style={[styles.compactTrackFill, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          indicatorStyle,
          { backgroundColor: theme.surface, borderColor: theme.border },
          size === 'compact' && styles.compactIndicator,
        ]}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            aria-checked={active}
            accessibilityLabel={option.label}
            onPress={() => {
              if (active) return;
              selectionHaptic();
              onChange(option.value);
            }}
            style={styles.segment}
            pressFeedbackStyle={size === 'compact' ? centeredPressFeedback(SIZE, 999, 32) : undefined}
          >
            {option.icon ? (
              <Icon name={option.icon} size={17} color={active ? theme.textPrimary : theme.muted} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  labelText: { alignSelf: 'stretch', textAlign: 'center', minWidth: 0, flexShrink: 1 },
  labelSegments: { flex: 1, flexDirection: 'row', position: 'relative' },
  labelIndicator: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 999 },
  compactLabelTrack: { alignSelf: 'flex-start' },
  // Compact segments hug their label (content-sized, never shrinking — not `flex: 0`,
  // which collapses to a zero basis on web), so each measures its real width and
  // the widest one sets the shared step for the sliding pill.
  compactLabelSegments: { flexDirection: 'row', position: 'relative', flexGrow: 0, flexShrink: 0 },
  compactLabelSegment: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  compactLabelText: { textAlign: 'center', flexShrink: 0 },
  labelSegment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 0,
  },
  track: {
    flexDirection: 'row',
    padding: PAD,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  compactTrack: { paddingVertical: 0, borderWidth: 0, backgroundColor: 'transparent' },
  compactTrackFill: {
    position: 'absolute', top: 3, bottom: 3, left: 0, right: 0,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  compactIndicator: { top: 6, height: 32 },
  indicator: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    width: SIZE,
    height: SIZE,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  segment: {
    width: SIZE,
    height: SIZE,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
