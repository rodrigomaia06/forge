import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Button, ForgeBottomSheet, ForgeBottomSheetHandle, ForgeText as Text, Icon, SheetCloseButton } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { createActiveWorkoutStyles } from './activeWorkoutStyles';
import { formatRest, formatRestDisplay } from './activeWorkoutFormatters';
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
  onSkip,
}: RestTimerSheetProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  return (
    <ForgeBottomSheet visible={visible} onClose={onClose} accessibilityLabel="Close rest timer" initialOffset={420} closeDistance={520} dismissThreshold={260} backdropTestID="rest-timer-backdrop" style={styles.restTimerSheet}>{(closeSheet) => <>
            <ForgeBottomSheetHandle />
            <View style={styles.sheetDragArea}>
              <View style={styles.restTimerHeader}>
                <View style={styles.restHeaderSide} />
                <Text style={styles.restTimerTitle}>Rest timer</Text>
                <SheetCloseButton
                  accessibilityLabel="Close rest timer"
                  onPress={closeSheet}
                  style={styles.restCloseButton}
                />
              </View>
            </View>
          {running ? (
            <ActiveRestTimer
              remaining={remaining}
              duration={duration}
              onAdjust={onAdjust}
              onSkip={() => {
                onSkip();
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
  onSkip,
}: {
  remaining: number;
  duration: number;
  onAdjust: (amount: number) => void;
  onSkip: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const progress = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const stateColor =
    remaining <= 0 ? '#C85C5C' : remaining <= duration * 0.2 ? '#C58A45' : theme.selectionIndicator;

  return (
    <View style={styles.activeRestTimer}>
      <View style={styles.progressRing}>
        <Svg width={220} height={220} viewBox="0 0 220 220">
          <Circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={theme.surfaceMuted}
            strokeWidth="14"
          />
          <Circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={stateColor}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            rotation="-90"
            origin="110, 110"
          />
        </Svg>
        <View style={styles.progressLabel}>
          <Text style={[styles.progressValue, { color: stateColor }]}>
            {formatRestDisplay(remaining)}
          </Text>
          <Text style={styles.progressCaption}>remaining</Text>
        </View>
      </View>
      <View style={styles.restQuickActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease rest by 15 seconds"
          onPress={() => onAdjust(-15)}
          style={({ pressed }) => [styles.restQuickButton, pressed && styles.restButtonPressed]}
        >
          <Text style={styles.restQuickText}>− 15s</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip rest timer"
          onPress={onSkip}
          style={({ pressed }) => [styles.restQuickButton, pressed && styles.restButtonPressed]}
        >
          <Text style={styles.restQuickText}>Skip</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase rest by 15 seconds"
          onPress={() => onAdjust(15)}
          style={({ pressed }) => [styles.restQuickButton, pressed && styles.restButtonPressed]}
        >
          <Text style={styles.restQuickText}>+ 15s</Text>
        </Pressable>
      </View>
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
  const pickerRef = useRef<React.ElementRef<typeof Animated.ScrollView>>(null);
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
      <View pointerEvents="none" style={styles.durationSelection} />
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
