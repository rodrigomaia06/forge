import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

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
 *
 * It is a plain ScrollView with every row rendered up front (the lists are
 * bounded, ≤115 rows) and positioned imperatively from `onContentSizeChange`.
 * FlatList's `initialScrollIndex` is unreliable inside an animating bottom sheet
 * — it leaves the list pinned at the top, so the wheel showed a lone faded value
 * with no selection band. Setting the offset once the content is laid out works
 * regardless of the sheet's entrance transform.
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
}) {
  const styles = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, options.indexOf(selectedValue));
  const programmaticScroll = useRef(false);
  const scrollOffset = useSharedValue(selectedIndex * WHEEL_ROW_HEIGHT);
  const hapticIndex = useSharedValue(selectedIndex);
  const padding = WHEEL_ROW_HEIGHT * ((visibleRows - 1) / 2);

  const scrollToIndex = (index: number, animated: boolean): void => {
    scrollRef.current?.scrollTo({ y: index * WHEEL_ROW_HEIGHT, animated });
  };

  // Land on the selected row on mount and whenever the selection changes from
  // outside. The parent sheet is still animating its height when we mount, and a
  // scrollTo against a not-yet-settled ScrollView is a no-op — so retry across a
  // few frames. `contentOffset` (below) sets the position declaratively too;
  // between the two the drum is centred from the first frame on native, where
  // FlatList's initialScrollIndex used to leave it pinned at the top.
  useEffect(() => {
    if (programmaticScroll.current) return;
    scrollOffset.value = selectedIndex * WHEEL_ROW_HEIGHT;
    hapticIndex.value = selectedIndex;
    let frame = 0;
    let raf = requestAnimationFrame(function tick() {
      scrollToIndex(selectedIndex, false);
      frame += 1;
      if (frame < 4) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [hapticIndex, scrollOffset, selectedIndex]);

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

  const settleAtOffset = (offsetY: number): void => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(offsetY / WHEEL_ROW_HEIGHT)));
    programmaticScroll.current = false;
    onSelect(options[index]);
  };

  const handleTap = (index: number): void => {
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    if (nextIndex === selectedIndex) return;
    programmaticScroll.current = true;
    hapticIndex.value = nextIndex;
    selectionHaptic();
    onSelect(options[nextIndex]);
    scrollOffset.value = nextIndex * WHEEL_ROW_HEIGHT;
    scrollToIndex(nextIndex, true);
  };

  return (
    <View style={styles.column}>
      {label ? <Text style={styles.columnLabel}>{label}</Text> : null}
      <View style={[styles.wheel, { height: WHEEL_ROW_HEIGHT * visibleRows }]}>
        <View style={[styles.selection, { top: padding }, styles.pointerEventsNone]} />
        <Animated.ScrollView
          ref={scrollRef}
          testID={testID}
          showsVerticalScrollIndicator={false}
          snapToInterval={WHEEL_ROW_HEIGHT}
          snapToAlignment="start"
          // The iOS default deceleration ("normal") gives the long, smooth glide
          // of the Clock-app drum rather than the abrupt stop of a fast
          // deceleration; snapToInterval settles it on a row.
          decelerationRate="normal"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: padding }}
          contentOffset={{ x: 0, y: selectedIndex * WHEEL_ROW_HEIGHT }}
          onScroll={handleScroll}
          onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.08) settleAtOffset(event.nativeEvent.contentOffset.y);
          }}
          onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => settleAtOffset(event.nativeEvent.contentOffset.y)}
        >
          {options.map((item, index) => (
            <Pressable
              key={item}
              accessibilityRole={accessibilityRole}
              accessibilityLabel={accessibilityLabel(item)}
              accessibilityState={accessibilityRole === 'radio' ? { checked: index === selectedIndex } : undefined}
              unstable_pressDelay={110}
              onPress={() => handleTap(index)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <WheelValue
                text={formatValue(item)}
                index={index}
                selected={index === selectedIndex}
                scrollOffset={scrollOffset}
              />
            </Pressable>
          ))}
        </Animated.ScrollView>
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
