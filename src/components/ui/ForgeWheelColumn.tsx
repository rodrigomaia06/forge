import { ForgePressable as Pressable } from './ForgePressable';
import { scheduleOnRN } from 'react-native-worklets';
import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
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

// Bounded wheel rows render together; position after content layout because
// FlatList initialScrollIndex is unreliable inside an animating sheet.
export function ForgeWheelColumn({
  options,
  selectedValue,
  onSelect,
  formatValue,
  accessibilityLabel,
  accessibilityRole = 'button',
  label,
  testID,
  visibleRows: requestedRows = WHEEL_VISIBLE_ROWS,
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
  const { height } = useWindowDimensions();
  const [rowHeight, setRowHeight] = useState(WHEEL_ROW_HEIGHT);
  const availableRows = Math.max(1, Math.floor((height - 240) / rowHeight));
  const visibleRows = Math.max(1, Math.min(requestedRows, availableRows % 2 ? availableRows : availableRows - 1));
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, options.indexOf(selectedValue));
  const programmaticScroll = useRef(false);
  const userScrolled = useRef(false);
  // The initial scroll position, captured once. `contentOffset` must NOT be a
  // controlled prop: if it tracked `selectedIndex`, every selection change would
  // re-apply it on iOS and reposition the ScrollView mid-gesture, so a swipe
  // would "stick" until nudged. Later positioning is done imperatively below.
  const initialScrollOffset = useRef(selectedIndex * rowHeight).current;
  // Set when a value change originates from the user's own scroll settle, so the
  // external re-center effect doesn't issue a redundant scrollTo over the gesture.
  const settledFromScroll = useRef(false);
  const scrollOffset = useSharedValue(selectedIndex * rowHeight);
  const hapticIndex = useSharedValue(selectedIndex);
  const padding = rowHeight * ((visibleRows - 1) / 2);

  const scrollToIndex = (index: number, animated: boolean): void => {
    scrollRef.current?.scrollTo({ y: index * rowHeight, animated });
  };

  // The reliable trigger: onLayout fires once the ScrollView has a real frame
  // (its viewport height is known), so a scrollTo here actually lands — unlike a
  // scroll issued while the sheet is still animating in, which is a no-op and
  // left the drum pinned at the top. Keep re-centring on layout until the user
  // scrolls, so an early zero-height layout is corrected by the settled one.
  const handleLayout = (): void => {
    if (userScrolled.current) return;
    scrollToIndex(selectedIndex, false);
  };

  // Re-align when the selection is changed from outside (not by our own scroll).
  useEffect(() => {
    if (programmaticScroll.current) return;
    // The user's own scroll already left the drum in place; don't scrollTo over
    // the gesture (that is what made the next swipe intermittently stick).
    if (settledFromScroll.current) {
      settledFromScroll.current = false;
      return;
    }
    scrollOffset.value = selectedIndex * rowHeight;
    hapticIndex.value = selectedIndex;
    scrollToIndex(selectedIndex, false);
  }, [hapticIndex, scrollOffset, selectedIndex, rowHeight]);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const index = Math.max(0, Math.min(options.length - 1, Math.round(event.contentOffset.y / rowHeight)));
      scrollOffset.value = event.contentOffset.y;
      if (index !== hapticIndex.value) {
        hapticIndex.value = index;
        scheduleOnRN(selectionHaptic);
      }
    },
  });

  const settleAtOffset = (offsetY: number): void => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(offsetY / rowHeight)));
    programmaticScroll.current = false;
    settledFromScroll.current = true;
    onSelect(options[index]);
  };

  const handleTap = (index: number): void => {
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    if (nextIndex === selectedIndex) return;
    programmaticScroll.current = true;
    hapticIndex.value = nextIndex;
    selectionHaptic();
    onSelect(options[nextIndex]);
    scrollOffset.value = nextIndex * rowHeight;
    scrollToIndex(nextIndex, true);
    // An animated scrollTo does not reliably emit onMomentumScrollEnd on Android,
    // which would otherwise leave programmaticScroll latched and freeze external
    // re-centering. Clear it after the animation as a fallback.
    setTimeout(() => { programmaticScroll.current = false; }, 350);
  };

  return (
    <View style={styles.column}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ position: 'absolute', opacity: 0 }}>
        <Text style={typeScale.metricLarge} onLayout={event => setRowHeight(Math.max(WHEEL_ROW_HEIGHT, Math.ceil(event.nativeEvent.layout.height) + 8))}>00:00</Text>
      </View>
      {label ? <Text style={styles.columnLabel}>{label}</Text> : null}
      <View style={[styles.wheel, { height: rowHeight * visibleRows }]}>
        <View style={[styles.selection, { top: padding, height: rowHeight }, styles.pointerEventsNone]} />
        <Animated.ScrollView
          ref={scrollRef}
          testID={testID}
          showsVerticalScrollIndicator={false}
          snapToInterval={rowHeight}
          snapToAlignment="start"
          // The iOS default deceleration ("normal") gives the long, smooth glide
          // of the Clock-app drum rather than the abrupt stop of a fast
          // deceleration; snapToInterval settles it on a row.
          decelerationRate="normal"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: padding }}
          contentOffset={{ x: 0, y: initialScrollOffset }}
          onLayout={handleLayout}
          onScroll={handleScroll}
          onScrollBeginDrag={() => { userScrolled.current = true; }}
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
              style={({ pressed }) => [styles.row, { height: rowHeight }, pressed && styles.rowPressed]}
            >
              <WheelValue
                rowHeight={rowHeight}
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
  rowHeight,
  index,
  selected,
  scrollOffset,
}: {
  text: string;
  rowHeight: number;
  index: number;
  selected: boolean;
  scrollOffset: { value: number };
}) {
  const styles = useThemedStyles(createStyles);
  const center = index * rowHeight;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [center - rowHeight * 2, center - rowHeight, center, center + rowHeight, center + rowHeight * 2],
      [0.24, 0.58, 1, 0.58, 0.24],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollOffset.value,
          [center - rowHeight * 2, center - rowHeight, center, center + rowHeight, center + rowHeight * 2],
          [0.88, 0.94, 1, 0.94, 0.88],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  return (
    <Animated.Text maxFontSizeMultiplier={0} allowFontScaling style={[styles.value, selected && styles.valueSelected, animatedStyle]}>
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
