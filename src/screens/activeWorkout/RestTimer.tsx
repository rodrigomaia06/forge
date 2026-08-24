import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { styles } from './activeWorkoutStyles';
import { formatRest, formatRestDisplay } from './activeWorkoutFormatters';
import { lightHaptic, selectionHaptic } from './activeWorkoutFeedback';
import type { RestTimerSheetProps } from './activeWorkoutTypes';

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
      <Icon name="time-outline" size={23} color={contentColor} />
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
  const translateY = useRef(new Animated.Value(420)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  onCloseRef.current = onClose;

  const closeSheet = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    lightHaptic();
    Animated.timing(translateY, {
      toValue: 520,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => onCloseRef.current());
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  useEffect(() => {
    if (!visible) return undefined;
    closingRef.current = false;
    translateY.setValue(420);
    backdropOpacity.setValue(0);
    const frame = requestAnimationFrame(() =>
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 240,
          mass: 0.8,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(),
    );
    return () => cancelAnimationFrame(frame);
  }, [visible, translateY, backdropOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderGrant: () => lightHaptic(),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || gesture.vy > 0.8) closeSheet();
        else {
          lightHaptic();
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeSheet}>
      <Animated.View style={[styles.restTimerBackdrop, { opacity: backdropOpacity }]}>
        <Pressable
          testID="rest-timer-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close rest timer"
          onPress={closeSheet}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.restTimerSheet, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={styles.sheetDragArea}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.restTimerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close rest timer"
              onPress={closeSheet}
              style={styles.restCloseButton}
            >
              <Text style={styles.restCloseText}>Close</Text>
            </Pressable>
            <Text style={styles.restTimerTitle}>Rest timer</Text>
            <View style={styles.restHeaderBalance} />
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start rest timer"
                onPress={onStart}
                style={styles.restStartButton}
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
          <Text style={styles.progressCaption}>Rest</Text>
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
          style={styles.restQuickButton}
        >
          <Text style={styles.restQuickText}>− 15s</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip rest timer"
          onPress={onSkip}
          style={styles.restQuickButton}
        >
          <Text style={styles.restQuickText}>Skip</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase rest by 15 seconds"
          onPress={() => onAdjust(15)}
          style={styles.restQuickButton}
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
  const pickerRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, REST_DURATIONS.indexOf(selectedDuration));
  const lastHapticIndex = useRef(selectedIndex);
  const rowHeight = 44;

  useEffect(() => {
    lastHapticIndex.current = selectedIndex;
    pickerRef.current?.scrollTo({ y: selectedIndex * rowHeight, animated: false });
  }, [selectedIndex]);

  const selectIndex = (index: number, animated = true): void => {
    const nextIndex = Math.max(0, Math.min(REST_DURATIONS.length - 1, index));
    onSelect(REST_DURATIONS[nextIndex]);
    pickerRef.current?.scrollTo({ y: nextIndex * rowHeight, animated });
  };

  return (
    <View style={styles.durationPicker}>
      <View pointerEvents="none" style={styles.durationSelection} />
      <ScrollView
        ref={pickerRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={rowHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={styles.durationPickerContent}
        onScroll={(event) => {
          const index = Math.max(
            0,
            Math.min(
              REST_DURATIONS.length - 1,
              Math.round(event.nativeEvent.contentOffset.y / rowHeight),
            ),
          );
          if (index !== lastHapticIndex.current) {
            lastHapticIndex.current = index;
            selectionHaptic();
          }
        }}
        onMomentumScrollEnd={(event) =>
          selectIndex(Math.round(event.nativeEvent.contentOffset.y / rowHeight), false)
        }
      >
        {REST_DURATIONS.map((duration, index) => {
          const distance = Math.abs(index - selectedIndex);
          return (
            <Pressable
              key={duration}
              accessibilityRole="button"
              accessibilityLabel={`Rest duration ${formatRest(duration)}`}
              onPress={() => selectIndex(index)}
              style={styles.durationRow}
            >
              <Text
                style={[
                  styles.durationText,
                  distance === 0 && styles.durationTextSelected,
                  distance > 2 && styles.durationTextFaded,
                ]}
              >
                {formatRest(duration)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
