import React, { useEffect, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { ForgeTheme } from '../../types';
import { ForgeText as Text } from './ForgeText';
import { selectionHaptic } from './haptics';

export const WHEEL_ROW_HEIGHT = 48;
export const WHEEL_VISIBLE_ROWS = 7;

/**
 * The single Forge wheel: a snapping, fading column of values with the Clock-app
 * feel. Every duration and time in the app is picked on this one implementation
 * so the momentum, haptics, and fade read identically everywhere.
 */
export function ForgeWheelColumn({
  options,
  selectedValue,
  onSelect,
  formatValue,
  accessibilityLabel,
  accessibilityRole = 'button',
  label,
  testID,
  visibleRows = WHEEL_VISIBLE_ROWS,
  fullyRendered = false,
}: {
  options: readonly number[];
  selectedValue: number;
  onSelect: (value: number) => void;
  formatValue: (value: number) => string;
  accessibilityLabel: (value: number) => string;
  accessibilityRole?: 'button' | 'radio';
  /** Optional heading above the wheel (e.g. "Hours"). */
  label?: string;
  testID?: string;
  visibleRows?: number;
  /** Render every row up front (small fixed lists), so no blank drum rows appear on a fling. */
  fullyRendered?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const pickerRef = useRef<FlatList<number>>(null);
  const selectedIndex = Math.max(0, options.indexOf(selectedValue));
  const programmaticScroll = useRef(false);
  const scrollOffset = useSharedValue(selectedIndex * WHEEL_ROW_HEIGHT);
  const hapticIndex = useSharedValue(selectedIndex);
  const padding = WHEEL_ROW_HEIGHT * ((visibleRows - 1) / 2);

  useEffect(() => {
    if (programmaticScroll.current) return;
    scrollOffset.value = selectedIndex * WHEEL_ROW_HEIGHT;
    hapticIndex.value = selectedIndex;
    pickerRef.current?.scrollToOffset({ offset: selectedIndex * WHEEL_ROW_HEIGHT, animated: false });
  }, [hapticIndex, scrollOffset, selectedIndex]);

  const scrollToIndex = (index: number): void => {
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    if (nextIndex === selectedIndex) return;
    programmaticScroll.current = true;
    hapticIndex.value = nextIndex;
    selectionHaptic();
    onSelect(options[nextIndex]);
    pickerRef.current?.scrollToOffset({ offset: nextIndex * WHEEL_ROW_HEIGHT, animated: true });
  };

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const index = Math.max(0, Math.min(options.length - 1, Math.round(event.contentOffset.y / WHEEL_ROW_HEIGHT)));
      scrollOffset.value = event.contentOffset.y;
      if (index !== hapticIndex.value) {
        hapticIndex.value = index;
        runOnJS(selectionHaptic)();
      }
    },
  });

  const handleScrollEnd = (event: NativeScrollEvent): void => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(event.contentOffset.y / WHEEL_ROW_HEIGHT)));
    programmaticScroll.current = false;
    onSelect(options[index]);
  };

  const renderRow = ({ item, index }: ListRenderItemInfo<number>) => (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel(item)}
      accessibilityState={accessibilityRole === 'radio' ? { checked: index === selectedIndex } : undefined}
      unstable_pressDelay={110}
      onPress={() => scrollToIndex(index)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <WheelValue
        text={formatValue(item)}
        index={index}
        selected={index === selectedIndex}
        scrollOffset={scrollOffset}
      />
    </Pressable>
  );

  return (
    <View style={styles.column}>
      {label ? <Text style={styles.columnLabel}>{label}</Text> : null}
      <View style={[styles.wheel, { height: WHEEL_ROW_HEIGHT * visibleRows }]}>
        <View style={[styles.selection, { top: padding }, styles.pointerEventsNone]} />
        <Animated.FlatList
          ref={pickerRef}
          testID={testID}
          data={options as number[]}
          keyExtractor={(value) => String(value)}
          renderItem={renderRow}
          extraData={selectedIndex}
          getItemLayout={(_, index) => ({ length: WHEEL_ROW_HEIGHT, offset: WHEEL_ROW_HEIGHT * index, index })}
          initialScrollIndex={selectedIndex}
          initialNumToRender={fullyRendered ? options.length : 20}
          maxToRenderPerBatch={fullyRendered ? options.length : 20}
          windowSize={fullyRendered ? Math.max(9, options.length) : 9}
          removeClippedSubviews={!fullyRendered}
          showsVerticalScrollIndicator={false}
          snapToOffsets={options.map((_, index) => index * WHEEL_ROW_HEIGHT)}
          snapToAlignment="start"
          // The iOS default deceleration ("normal") gives the long, smooth glide of
          // the Clock-app drum (matching @quidone's wheel), rather than the abrupt
          // stop of a fast deceleration; snapToOffsets settles it on an item.
          decelerationRate="normal"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: padding }}
          onScroll={handleScroll}
          onScrollEndDrag={(event) => {
            if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.08) handleScrollEnd(event.nativeEvent);
          }}
          onMomentumScrollEnd={(event) => handleScrollEnd(event.nativeEvent)}
        />
      </View>
    </View>
  );
}

function WheelValue({
  text,
  index,
  selected,
  scrollOffset,
}: {
  text: string;
  index: number;
  selected: boolean;
  scrollOffset: { value: number };
}) {
  const styles = useThemedStyles(createStyles);
  const center = index * WHEEL_ROW_HEIGHT;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [center - WHEEL_ROW_HEIGHT * 2, center - WHEEL_ROW_HEIGHT, center, center + WHEEL_ROW_HEIGHT, center + WHEEL_ROW_HEIGHT * 2],
      [0.24, 0.58, 1, 0.58, 0.24],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollOffset.value,
          [center - WHEEL_ROW_HEIGHT * 2, center - WHEEL_ROW_HEIGHT, center, center + WHEEL_ROW_HEIGHT, center + WHEEL_ROW_HEIGHT * 2],
          [0.88, 0.94, 1, 0.94, 0.88],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  return (
    <Animated.Text style={[styles.value, selected && styles.valueSelected, animatedStyle]}>
      {text}
    </Animated.Text>
  );
}

const createStyles = (theme: ForgeTheme) =>
  StyleSheet.create({
    pointerEventsNone: { pointerEvents: 'none' },
    column: { flex: 1, minWidth: 0 },
    columnLabel: { textAlign: 'center', marginBottom: 8, color: theme.textSecondary, ...typeScale.label },
    wheel: { position: 'relative', overflow: 'hidden' },
    row: { height: WHEEL_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
    rowPressed: { backgroundColor: theme.surfaceMuted, borderRadius: 12 },
    selection: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: WHEEL_ROW_HEIGHT,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
    },
    value: { color: theme.slate, ...typeScale.metricMedium, opacity: 0.58 },
    valueSelected: { color: theme.ink, ...typeScale.metricLarge, opacity: 1 },
  });
