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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { ForgeTheme } from '../../types';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { selectionHaptic } from './haptics';

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 7;

/** mm:ss for a duration in seconds. */
export function formatDurationValue(seconds: number): string {
  const absolute = Math.abs(seconds);
  return `${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

/**
 * The single Forge wheel picker: a snapping, fading column of values with the
 * Clock-app feel. Shared by the rest-timer overlay, the rest override sheets,
 * and the rest-time settings sheet so every duration is picked one way.
 */
export function ForgeDurationWheel({
  selectedDuration,
  onSelect,
  options = REST_DURATION_OPTIONS as readonly number[],
}: {
  selectedDuration: number;
  onSelect: (duration: number) => void;
  options?: readonly number[];
}) {
  const styles = useThemedStyles(createStyles);
  const pickerRef = useRef<FlatList<number>>(null);
  const selectedIndex = Math.max(0, options.indexOf(selectedDuration));
  const programmaticScroll = useRef(false);
  const scrollOffset = useSharedValue(selectedIndex * ROW_HEIGHT);
  const hapticIndex = useSharedValue(selectedIndex);

  useEffect(() => {
    if (programmaticScroll.current) return;
    scrollOffset.value = selectedIndex * ROW_HEIGHT;
    hapticIndex.value = selectedIndex;
    pickerRef.current?.scrollToOffset({ offset: selectedIndex * ROW_HEIGHT, animated: false });
  }, [hapticIndex, scrollOffset, selectedIndex]);

  const scrollToIndex = (index: number): void => {
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    if (nextIndex === selectedIndex) return;
    programmaticScroll.current = true;
    hapticIndex.value = nextIndex;
    selectionHaptic();
    onSelect(options[nextIndex]);
    pickerRef.current?.scrollToOffset({ offset: nextIndex * ROW_HEIGHT, animated: true });
  };

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const index = Math.max(0, Math.min(options.length - 1, Math.round(event.contentOffset.y / ROW_HEIGHT)));
      scrollOffset.value = event.contentOffset.y;
      if (index !== hapticIndex.value) {
        hapticIndex.value = index;
        runOnJS(selectionHaptic)();
      }
    },
  });

  const handleScrollEnd = (event: NativeScrollEvent): void => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(event.contentOffset.y / ROW_HEIGHT)));
    programmaticScroll.current = false;
    onSelect(options[index]);
  };

  const renderRow = ({ item: duration, index }: ListRenderItemInfo<number>) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rest duration ${formatDurationValue(duration)}`}
      unstable_pressDelay={110}
      onPress={() => scrollToIndex(index)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <WheelValue
        duration={duration}
        index={index}
        selected={index === selectedIndex}
        scrollOffset={scrollOffset}
      />
    </Pressable>
  );

  return (
    <View style={styles.wheel}>
      <View style={[styles.selection, styles.pointerEventsNone]} />
      <Animated.FlatList
        ref={pickerRef}
        data={options as number[]}
        keyExtractor={(duration) => String(duration)}
        renderItem={renderRow}
        extraData={selectedIndex}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialScrollIndex={selectedIndex}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={9}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        snapToOffsets={options.map((_, index) => index * ROW_HEIGHT)}
        snapToAlignment="start"
        // The iOS default deceleration ("normal") gives the long, smooth glide of
        // the Clock-app drum (matching @quidone's wheel), rather than the abrupt
        // stop of a fast deceleration; snapToOffsets settles it on an item.
        decelerationRate="normal"
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.08) handleScrollEnd(event.nativeEvent);
        }}
        onMomentumScrollEnd={(event) => handleScrollEnd(event.nativeEvent)}
      />
    </View>
  );
}

function WheelValue({
  duration,
  index,
  selected,
  scrollOffset,
}: {
  duration: number;
  index: number;
  selected: boolean;
  scrollOffset: { value: number };
}) {
  const styles = useThemedStyles(createStyles);
  const center = index * ROW_HEIGHT;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [center - ROW_HEIGHT * 2, center - ROW_HEIGHT, center, center + ROW_HEIGHT, center + ROW_HEIGHT * 2],
      [0.24, 0.58, 1, 0.58, 0.24],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollOffset.value,
          [center - ROW_HEIGHT * 2, center - ROW_HEIGHT, center, center + ROW_HEIGHT, center + ROW_HEIGHT * 2],
          [0.88, 0.94, 1, 0.94, 0.88],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  return (
    <Animated.Text style={[styles.value, selected && styles.valueSelected, animatedStyle]}>
      {formatDurationValue(duration)}
    </Animated.Text>
  );
}

/** A Forge bottom sheet that presents the duration wheel as a standalone picker. */
export function ForgeRestDurationSheet({
  visible,
  onClose,
  title,
  selectedDuration,
  onSelect,
  testID = 'rest-duration-sheet',
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  selectedDuration: number;
  onSelect: (duration: number) => void;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={`Dismiss ${title.toLowerCase()} picker`}
      testID={testID}
      dragEnabled={false}
    >
      {(close) => (
        <View testID={`${testID}-surface`} style={[sheetStyles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title={title} onClose={close} closeAccessibilityLabel={`Close ${title.toLowerCase()} picker`} />
          <ForgeDurationWheel selectedDuration={selectedDuration} onSelect={onSelect} />
        </View>
      )}
    </ForgeBottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: { paddingHorizontal: 16 },
});

const createStyles = (theme: ForgeTheme) =>
  StyleSheet.create({
    pointerEventsNone: { pointerEvents: 'none' },
    wheel: { height: ROW_HEIGHT * VISIBLE_ROWS, position: 'relative', overflow: 'hidden', marginTop: 8, marginHorizontal: 20 },
    content: { paddingVertical: ROW_HEIGHT * ((VISIBLE_ROWS - 1) / 2) },
    row: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
    rowPressed: { backgroundColor: theme.surfaceMuted, borderRadius: 12 },
    selection: {
      position: 'absolute',
      top: ROW_HEIGHT * ((VISIBLE_ROWS - 1) / 2),
      left: 0,
      right: 0,
      height: ROW_HEIGHT,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
    },
    value: { color: theme.slate, ...typeScale.metricMedium, opacity: 0.58 },
    valueSelected: { color: theme.ink, ...typeScale.metricLarge, opacity: 1 },
  });
