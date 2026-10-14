import { ForgePressable as Pressable } from './ForgePressable';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useForgeReducedMotion } from '../../theme/motion';
import { useForgeTheme } from '../../theme/ThemeProvider';
import type { IconName } from '../../types';
import { ForgeText as Text } from './ForgeText';
import { typeScale } from '../../theme/tokens';
import { Icon } from './Icon';
import { selectionHaptic } from './haptics';

const PAD = 3;
const SIZE = 34;

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

  if (showLabels)
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={[styles.track, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
      >
        {options.map((option) => (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: option.value === value }}
            aria-checked={option.value === value}
            accessibilityLabel={option.label}
            onPress={() => {
              selectionHaptic();
              onChange(option.value);
            }}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: option.value === value ? theme.actionPrimary : 'transparent',
              paddingHorizontal: 8,
            }}
          >
            <Text
              style={[
                typeScale.controlLabel,
                { color: option.value === value ? theme.onActionPrimary : theme.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
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
  track: {
    flexDirection: 'row',
    padding: PAD,
    borderRadius: 999,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
