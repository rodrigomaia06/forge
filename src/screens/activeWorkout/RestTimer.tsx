import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { styles } from './activeWorkoutStyles';
import { formatRest, formatRestDisplay } from './activeWorkoutFormatters';
import { lightHaptic, selectionHaptic } from './activeWorkoutFeedback';
import type { RestTimerSheetProps } from './activeWorkoutTypes';
import type { NativeScrollEvent } from 'react-native';

export function RestTimerIndicator({
  remaining,
  duration,
  running,
}: {
  remaining: number;
  duration: number;
  running: boolean;
}) {
  const contentColor = !running
    ? dashboardTheme.ink
    : remaining <= 0
      ? '#C85C5C'
      : remaining <= duration * 0.2
        ? '#C58A45'
        : remaining <= duration * 0.5
          ? dashboardTheme.accent
          : dashboardTheme.ink;

  return (
    <View style={styles.timerIndicator}>
      <Icon name="stopwatch-outline" size={23} color={contentColor} />
      {running && (
        <Text style={[styles.restValue, { color: contentColor }]}>{formatRest(remaining)}</Text>
      )}
    </View>
  );
}

const REST_DURATIONS = [45, 60, 75, 90, 105, 120, 135, 150, 165];

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
  const translateY = useSharedValue(420);
  const backdropOpacity = useSharedValue(0);
  const onCloseRef = useRef(onClose);
  const closing = useSharedValue(false);
  const dragStartOffset = useSharedValue(0);
  onCloseRef.current = onClose;

  const finishClose = useCallback(() => onCloseRef.current(), []);
  const closeSheet = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    lightHaptic();
    translateY.value = withTiming(520, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 160 });
  }, [backdropOpacity, closing, finishClose, translateY]);

  useEffect(() => {
    if (!visible) return undefined;
    closing.value = false;
    translateY.value = 420;
    backdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, translateY, backdropOpacity, closing]);

  const sheetGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragStartOffset.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragStartOffset.value + event.translationY);
    })
    .onEnd((event) => {
      const projectedOffset = Math.max(
        0,
        dragStartOffset.value + event.translationY + event.velocityY * 0.12,
      );
      if (projectedOffset >= 260 || event.velocityY > 900) {
        closing.value = true;
        translateY.value = withTiming(520, { duration: 200 }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        backdropOpacity.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeSheet}>
      <Animated.View style={[styles.restTimerBackdrop, backdropAnimatedStyle]}>
        <Pressable
          testID="rest-timer-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close rest timer"
          onPress={closeSheet}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.restTimerSheet, sheetAnimatedStyle]}>
          <GestureDetector gesture={sheetGesture}>
            <View style={styles.sheetDragArea}>
              <View style={styles.sheetHandle} />
              <View style={styles.restTimerHeader}>
                <View style={styles.restHeaderSide} />
                <Text style={styles.restTimerTitle}>Rest timer</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close rest timer"
                  onPress={closeSheet}
                  style={({ pressed }) => [
                    styles.restCloseButton,
                    pressed && styles.restClosePressed,
                  ]}
                >
                  <Icon name="close" size={20} color={dashboardTheme.slate} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start rest timer"
                onPress={onStart}
                style={({ pressed }) => [
                  styles.restStartButton,
                  pressed && styles.restButtonPressed,
                ]}
              >
                <Text style={styles.restStartText}>Start</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
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
  const progress = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const stateColor =
    remaining <= 0 ? '#C85C5C' : remaining <= duration * 0.2 ? '#C58A45' : dashboardTheme.accent;

  return (
    <View style={styles.activeRestTimer}>
      <View style={styles.progressRing}>
        <Svg width={220} height={220} viewBox="0 0 220 220">
          <Circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={dashboardTheme.surfaceMuted}
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

function RestDurationPicker({
  selectedDuration,
  onSelect,
}: {
  selectedDuration: number;
  onSelect: (duration: number) => void;
}) {
  const pickerRef = useRef<React.ElementRef<typeof Animated.ScrollView>>(null);
  const selectedIndex = Math.max(0, REST_DURATIONS.indexOf(selectedDuration));
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
    const nextIndex = Math.max(0, Math.min(REST_DURATIONS.length - 1, index));
    if (nextIndex === selectedIndex) return;
    programmaticScroll.current = true;
    onSelect(REST_DURATIONS[nextIndex]);
    pickerRef.current?.scrollTo({ y: nextIndex * rowHeight, animated: true });
  };

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const index = Math.max(
        0,
        Math.min(REST_DURATIONS.length - 1, Math.round(event.contentOffset.y / rowHeight)),
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
      Math.min(REST_DURATIONS.length - 1, Math.round(event.contentOffset.y / rowHeight)),
    );
    programmaticScroll.current = false;
    lastHapticIndex.current = index;
    onSelect(REST_DURATIONS[index]);
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
        {REST_DURATIONS.map((duration, index) => {
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
