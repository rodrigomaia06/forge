import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Button, ForgeBottomSheet, ForgeBottomSheetHandle, ForgeSheetHeader, ForgeText as Text, Icon } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { createActiveWorkoutStyles } from './activeWorkoutStyles';
import { formatRest } from './activeWorkoutFormatters';
import { lightHaptic, selectionHaptic } from './activeWorkoutFeedback';
import type { RestTimerSheetProps } from './activeWorkoutTypes';
import type { NativeScrollEvent } from 'react-native';
import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';

export function RestTimerIndicator({
  remaining,
  duration,
  running,
}: {
  remaining: number;
  duration: number;
  running: boolean;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const contentColor = !running
    ? theme.ink
    : remaining <= 0
      ? '#C85C5C'
      : remaining <= duration * 0.2
        ? '#C58A45'
        : remaining <= duration * 0.5
          ? theme.selectionIndicator
          : theme.ink;

  return (
    <View style={styles.timerIndicator}>
      <Icon name="stopwatch-outline" size={22} color={contentColor} />
      {running && (
        <Text style={[styles.restValue, { color: contentColor }]}>{formatRest(remaining)}</Text>
      )}
    </View>
  );
}


export function RestTimerSheet({
  visible,
  selectedDuration,
  remaining,
  duration,
  running,
  onClose,
  onSelect,
  onStart,
  onAdjust,
  onStop,
}: RestTimerSheetProps) {
  const styles = useThemedStyles(createActiveWorkoutStyles);
  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Close rest timer"
      initialOffset={420}
      closeDistance={520}
      dismissThreshold={260}
      backdropTestID="rest-timer-backdrop"
      surfaceTestID="rest-timer-sheet-surface"
      style={[styles.restTimerSheet, running ? styles.restTimerSheetActive : styles.restTimerSheetPicker]}
    >{(closeSheet) => <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title="Rest timer"
            onClose={closeSheet}
            closeAccessibilityLabel="Close rest timer"
          />
          {running ? (
            <ActiveRestTimer
              remaining={remaining}
              duration={duration}
              onAdjust={onAdjust}
              onStop={() => {
                onStop();
                closeSheet();
              }}
            />
          ) : (
            <>
              <RestDurationPicker selectedDuration={selectedDuration} onSelect={onSelect} />
              <Button
                accessibilityLabel="Start rest timer"
                label="Start"
                haptic="none"
                onPress={onStart}
                style={styles.restStartButton}
              />
            </>
          )}
    </>}</ForgeBottomSheet>
  );
}

function ActiveRestTimer({
  remaining,
  duration,
  onAdjust,
  onStop,
}: {
  remaining: number;
  duration: number;
  onAdjust: (amount: number) => void;
  onStop: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const progress = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
  const isOverdue = remaining < 0;
  const stateColor = isOverdue ? '#C85C5C' : remaining <= duration * 0.2 ? '#C58A45' : theme.selectionIndicator;

  return (
    <View style={styles.activeRestTimer}>
      <View style={styles.restTimeDisplay}>
        <Text testID="rest-timer-value" style={[styles.restTimeValue, { color: stateColor }]}>
          {isOverdue ? `+${formatRest(remaining)}` : formatRest(remaining)}
        </Text>
        <Text style={[styles.restTimeCaption, isOverdue && { color: stateColor }]}>
          {isOverdue ? 'rest exceeded' : 'remaining'}
        </Text>
      </View>
      <View
        testID="rest-timer-progress-track"
        accessibilityRole="progressbar"
        accessibilityLabel="Rest timer progress"
        accessibilityValue={{ min: 0, max: Math.max(duration, 1), now: Math.max(0, remaining) }}
        style={[styles.restProgressTrack, { backgroundColor: theme.surfaceMuted }]}
      >
        <View
          testID="rest-timer-progress-fill"
          style={[styles.restProgressFill, { width: `${progress * 100}%`, backgroundColor: stateColor }]}
        />
      </View>
      <View style={styles.restQuickActions}>
        {isOverdue ? (
          <>
            <Button
              accessibilityLabel="Extend rest by 30 seconds"
              label="+30s"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(30)}
              style={styles.restQuickButton}
            />
            <Button
              accessibilityLabel="Extend rest by 1 minute"
              label="+1 min"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(60)}
              style={styles.restQuickButton}
            />
          </>
        ) : (
          <>
            <Button
              accessibilityLabel="Decrease rest by 15 seconds"
              label="−15s"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(-15)}
              style={styles.restQuickButton}
            />
            <Button
              accessibilityLabel="Increase rest by 15 seconds"
              label="+15s"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(15)}
              style={styles.restQuickButton}
            />
          </>
        )}
      </View>
      <Button
        accessibilityLabel="Stop rest timer"
        label="Stop timer"
        variant="outline"
        tone="destructive"
        haptic="none"
        onPress={onStop}
        style={styles.restStopButton}
      />
    </View>
  );
}

export function RestDurationPicker({
  selectedDuration,
  onSelect,
}: {
  selectedDuration: number;
  onSelect: (duration: number) => void;
}) {
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const pickerRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, REST_DURATION_OPTIONS.indexOf(selectedDuration as typeof REST_DURATION_OPTIONS[number]));
  const lastHapticIndex = useRef(selectedIndex);
  const programmaticScroll = useRef(false);
  const rowHeight = 44;
  const scrollOffset = useSharedValue(selectedIndex * rowHeight);
  const hapticIndex = useSharedValue(selectedIndex);

  useEffect(() => {
    if (programmaticScroll.current) return;
    lastHapticIndex.current = selectedIndex;
    scrollOffset.value = selectedIndex * rowHeight;
    hapticIndex.value = selectedIndex;
    pickerRef.current?.scrollTo({ y: selectedIndex * rowHeight, animated: false });
  }, [hapticIndex, rowHeight, scrollOffset, selectedIndex]);

  const scrollToIndex = (index: number): void => {
    const nextIndex = Math.max(0, Math.min(REST_DURATION_OPTIONS.length - 1, index));
    if (nextIndex === selectedIndex) return;
    programmaticScroll.current = true;
    hapticIndex.value = nextIndex;
    selectionHaptic();
    onSelect(REST_DURATION_OPTIONS[nextIndex]);
    pickerRef.current?.scrollTo({ y: nextIndex * rowHeight, animated: true });
  };

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const index = Math.max(
        0,
        Math.min(REST_DURATION_OPTIONS.length - 1, Math.round(event.contentOffset.y / rowHeight)),
      );
      scrollOffset.value = event.contentOffset.y;
      if (index !== hapticIndex.value) {
        hapticIndex.value = index;
        runOnJS(selectionHaptic)();
      }
    },
  });

  const handleScrollEnd = (event: NativeScrollEvent): void => {
    const index = Math.max(
      0,
      Math.min(REST_DURATION_OPTIONS.length - 1, Math.round(event.contentOffset.y / rowHeight)),
    );
    programmaticScroll.current = false;
    lastHapticIndex.current = index;
    onSelect(REST_DURATION_OPTIONS[index]);
  };

  return (
    <View style={styles.durationPicker}>
      <View style={[styles.durationSelection, styles.pointerEventsNone]} />
      <Animated.ScrollView
        ref={pickerRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={rowHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={styles.durationPickerContent}
        onScroll={handleScroll}
        onMomentumScrollEnd={(event) => handleScrollEnd(event.nativeEvent)}
      >
        {REST_DURATION_OPTIONS.map((duration, index) => {
          return (
            <Pressable
              key={duration}
              accessibilityRole="button"
              accessibilityLabel={`Rest duration ${formatRest(duration)}`}
              onPress={() => scrollToIndex(index)}
              style={({ pressed }) => [styles.durationRow, pressed && styles.durationRowPressed]}
            >
              <DurationText
                duration={duration}
                index={index}
                rowHeight={rowHeight}
                selected={index === selectedIndex}
                scrollOffset={scrollOffset}
              />
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

function DurationText({
  duration,
  index,
  rowHeight,
  selected,
  scrollOffset,
}: {
  duration: number;
  index: number;
  rowHeight: number;
  selected: boolean;
  scrollOffset: { value: number };
}) {
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const center = index * rowHeight;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [
        center - rowHeight * 2,
        center - rowHeight,
        center,
        center + rowHeight,
        center + rowHeight * 2,
      ],
      [0.24, 0.58, 1, 0.58, 0.24],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollOffset.value,
          [
            center - rowHeight * 2,
            center - rowHeight,
            center,
            center + rowHeight,
            center + rowHeight * 2,
          ],
          [0.88, 0.94, 1, 0.94, 0.88],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.Text
      style={[styles.durationText, selected && styles.durationTextSelected, animatedStyle]}
    >
      {formatRest(duration)}
    </Animated.Text>
  );
}
