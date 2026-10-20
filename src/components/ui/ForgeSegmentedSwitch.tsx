import { ForgePressable as Pressable } from './ForgePressable';
import React, { useEffect } from 'react';
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
  icon: IconName;
};

/**
 * A compact icon pill whose selection is marked by a ring that springs between
 * options — the sliding-indicator pattern. Each option is a fixed circular
 * button, so the indicator can slide by a constant step without measuring.
 */
export function ForgeSegmentedSwitch<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  showLabels = false,
}: {
  options: readonly ForgeSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  showLabels?: boolean;
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
      : withSpring(target, { damping: 18, stiffness: 220, mass: 0.7 });
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
  const labelIndicatorStyle = useAnimatedStyle(() => ({
    width: labelWidth.get(),
    transform: [{ translateX: labelPosition.get() * labelWidth.get() }],
  }));

  if (showLabels)
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={[styles.track, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
      >
        <View
          style={styles.labelSegments}
          onLayout={(event) =>
            labelWidth.set(event.nativeEvent.layout.width / Math.max(1, options.length))
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
          {options.map((option) => (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === value }}
              aria-checked={option.value === value}
              accessibilityLabel={option.label}
              onPress={() => {
                if (option.value === value) return;
                selectionHaptic();
                onChange(option.value);
              }}
              style={styles.labelSegment}
            >
              <Text
                style={[
                  typeScale.controlLabel,
                  styles.labelText,
                  { color: option.value === value ? theme.onActionPrimary : theme.textSecondary },
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
      style={[styles.track, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          indicatorStyle,
          { backgroundColor: theme.surface, borderColor: theme.border },
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
          >
            <Icon name={option.icon} size={17} color={active ? theme.textPrimary : theme.muted} />
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
