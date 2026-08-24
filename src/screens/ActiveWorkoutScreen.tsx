import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  type GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { AppScreen, Button, Icon } from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useWorkouts } from '../state/WorkoutContext';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typography } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  RootStackParamList,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetChanges,
} from '../types';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function lightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function selectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

function errorHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

function animateLayout() {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      140,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );
}

function workoutTypePresentation(type: string): { color: string } {
  if (type === 'Court sport') return { color: dashboardTheme.iconSport || dashboardTheme.ink };
  if (type === 'Mobility') return { color: '#AA7CE8' };
  if (type === 'Cardio') return { color: dashboardTheme.iconActivity || dashboardTheme.ink };
  return { color: dashboardTheme.iconStrength || dashboardTheme.ink };
}

type ActiveWorkoutScreenProps = NativeStackScreenProps<RootStackParamList, 'ActiveWorkout'>;
export function ActiveWorkoutScreen({ navigation }: ActiveWorkoutScreenProps) {
  const {
    activeWorkout,
    ready,
    addExercise,
    addSet,
    removeSet,
    removeExercise,
    updateSet,
    toggleSet,
    finishWorkout,
  } = useWorkouts();
  const [elapsed, setElapsed] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restDuration, setRestDuration] = useState(60);
  const [restRunning, setRestRunning] = useState(false);
  const [restSelection, setRestSelection] = useState(90);
  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const timerLongPressRef = useRef(false);

  useEffect(() => {
    if (!activeWorkout) return undefined;
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - activeWorkout.startedAt) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeWorkout]);

  useEffect(() => {
    if (!restRunning) return undefined;
    const timer = setInterval(() => {
      setRestRemaining((current) => {
        if (current === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return -1;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [restRunning]);

  const startRestTimer = (duration = 60): void => {
    lightHaptic();
    setRestDuration(duration);
    setRestRemaining(duration);
    setRestRunning(true);
  };
  const openRestTimer = () => {
    lightHaptic();
    if (restRunning || restRemaining > 0) setRestSelection(restDuration);
    setRestSheetOpen(true);
  };
  const adjustRestTimer = (amount: number): void => {
    lightHaptic();
    setRestRemaining((current) => current + amount);
  };
  const skipRestTimer = () => {
    lightHaptic();
    setRestRunning(false);
    setRestRemaining(0);
  };
  const returnToDashboard = (finished: Workout | null): void =>
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Dashboard',
          params: finished?.completedAt
            ? { selectedDay: new Date(finished.completedAt).getDate() }
            : undefined,
        },
      ],
    });

  if (!ready)
    return (
      <AppScreen backgroundColor={dashboardTheme.background}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading workout…</Text>
        </View>
      </AppScreen>
    );
  if (!activeWorkout)
    return (
      <AppScreen backgroundColor={dashboardTheme.background}>
        <View style={styles.center}>
          <Text style={styles.title}>No active workout</Text>
          <Button
            label="Back to Dashboard"
            onPress={() => navigation.goBack()}
            theme={dashboardTheme}
          />
        </View>
      </AppScreen>
    );

  const handleFinish = () => {
    if (!activeWorkout.exercises.length) {
      Alert.alert('Finish empty workout?', 'No workout will be saved.', [
        { text: 'Keep working out', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            finishWorkout();
            returnToDashboard(null);
          },
        },
      ]);
      return;
    }
    lightHaptic();
    const finished = finishWorkout();
    returnToDashboard(finished);
  };

  const typePresentation = workoutTypePresentation(activeWorkout.type);

  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Button
            label="Cancel"
            variant="secondary"
            labelColor={dashboardTheme.slate}
            onPress={() => navigation.goBack()}
            theme={dashboardTheme}
            style={styles.cancelButton}
          />
          <View style={styles.titleBlock}>
            <View
              style={[styles.nameUnderlineWrap, { borderBottomColor: typePresentation.color }]}
              accessibilityLabel={`Workout type: ${activeWorkout.type}`}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeWorkout.name}
              </Text>
            </View>
          </View>
          <Button
            label="Finish"
            labelColor={dashboardTheme.accent}
            labelStyle={styles.finishLabel}
            onPress={handleFinish}
            variant="secondary"
            theme={dashboardTheme}
            style={styles.finishButton}
          />
        </View>
        <View style={styles.elapsedRow}>
          <View style={styles.elapsedInfo}>
            <Icon name="stopwatch-outline" size={23} color={dashboardTheme.ink} />
            <Text style={styles.elapsedValue}>{formatElapsed(elapsed)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              restRunning
                ? `Rest timer, ${Math.abs(restRemaining)} seconds remaining`
                : 'Start rest timer'
            }
            onPress={() => {
              if (timerLongPressRef.current) {
                timerLongPressRef.current = false;
                return;
              }
              openRestTimer();
            }}
            onLongPress={() => {
              timerLongPressRef.current = true;
              startRestTimer(restDuration);
            }}
            delayLongPress={450}
            accessibilityHint="Tap to open the rest timer or hold to restart it"
            style={styles.timerReset}
          >
            <RestTimerIndicator
              remaining={restRemaining}
              duration={restDuration}
              running={restRunning}
            />
          </Pressable>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {activeWorkout.exercises.length > 0 &&
            activeWorkout.exercises.map((exercise, index) => (
              <ExerciseSection
                key={exercise.id}
                exercise={exercise}
                index={index}
                addSet={addSet}
                removeSet={removeSet}
                removeExercise={removeExercise}
                updateSet={updateSet}
                toggleSet={toggleSet}
                onSetCompleted={startRestTimer}
              />
            ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
            onPress={() => {
              animateLayout();
              setSheetOpen(true);
            }}
            style={styles.addExercise}
          >
            <Icon name="add" size={17} color={dashboardTheme.ink} />
            <Text style={styles.addExerciseText}>Add exercise</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <AddExerciseSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={(name) => {
          lightHaptic();
          addExercise(name);
          setSheetOpen(false);
        }}
      />
      <RestTimerSheet
        visible={restSheetOpen}
        selectedDuration={restSelection}
        remaining={restRemaining}
        duration={restDuration}
        running={restRunning}
        onClose={() => setRestSheetOpen(false)}
        onSelect={setRestSelection}
        onStart={() => startRestTimer(restSelection)}
        onAdjust={adjustRestTimer}
        onSkip={skipRestTimer}
      />
      <NavigationFooter />
    </AppScreen>
  );
}

interface ExerciseSectionProps {
  exercise: WorkoutExercise;
  index: number;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, changes: WorkoutSetChanges) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  onSetCompleted: (duration?: number) => void;
}
function ExerciseSection({
  exercise,
  index: _index,
  addSet,
  removeSet,
  removeExercise,
  updateSet,
  toggleSet,
  onSetCompleted,
}: ExerciseSectionProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${exercise.name}`}
          onPress={() => setOptionsOpen(true)}
          style={styles.moreButton}
        >
          <Icon name="ellipsis-horizontal" size={20} color={dashboardTheme.ink} />
        </Pressable>
      </View>
      <View style={styles.setHeader}>
        <Text style={[styles.setHeaderText, styles.setColumn]}>Set</Text>
        <Text style={[styles.setHeaderText, styles.previousColumn]}>Previous</Text>
        <Text style={[styles.setHeaderText, styles.inputColumn]}>kg</Text>
        <Text style={[styles.setHeaderText, styles.inputColumn]}>Reps</Text>
        <View style={styles.checkColumn} />
      </View>
      {exercise.sets.map((set, setIndex) => (
        <SwipeableSetRow
          key={set.id}
          set={set}
          index={setIndex}
          onChange={(changes) => updateSet(exercise.id, set.id, changes)}
          onToggle={() => {
            lightHaptic();
            if (!set.completed) onSetCompleted();
            toggleSet(exercise.id, set.id);
          }}
          onDelete={() => {
            lightHaptic();
            removeSet(exercise.id, set.id);
          }}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${exercise.name}`}
        onPress={() => {
          lightHaptic();
          addSet(exercise.id);
        }}
        style={styles.addSet}
      >
        <Icon name="add" size={16} color={dashboardTheme.accent} />
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
      <ExerciseOptionsSheet
        visible={optionsOpen}
        exercise={exercise}
        onClose={() => setOptionsOpen(false)}
        onRemove={() => {
          animateLayout();
          removeExercise(exercise.id);
          setOptionsOpen(false);
        }}
      />
    </View>
  );
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatRest(seconds: number): string {
  const absolute = Math.abs(seconds);
  return `${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function formatRestDisplay(seconds: number): string {
  return seconds < 0 ? `+${formatRest(seconds)}` : formatRest(seconds);
}

function RestTimerIndicator({
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

interface RestTimerSheetProps {
  visible: boolean;
  selectedDuration: number;
  remaining: number;
  duration: number;
  running: boolean;
  onClose: () => void;
  onSelect: (duration: number) => void;
  onStart: () => void;
  onAdjust: (amount: number) => void;
  onSkip: () => void;
}
function RestTimerSheet({
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

interface SwipeableSetRowProps {
  set: WorkoutSet;
  index: number;
  onChange: (changes: WorkoutSetChanges) => void;
  onToggle: () => void;
  onDelete: () => void;
}
function SwipeableSetRow({ set, index, onChange, onToggle, onDelete }: SwipeableSetRowProps) {
  const deleteProgress = useRef(new Animated.Value(0)).current;
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const deleteFractionRef = useRef(0);
  const openRef = useRef(false);
  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const touchActiveRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    Animated.timing(entranceProgress, {
      toValue: 1,
      duration: 120,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    return () => entranceProgress.stopAnimation();
  }, [entranceProgress]);
  const settleDelete = (shouldOpen: boolean): void => {
    const wasOpen = openRef.current;
    openRef.current = shouldOpen;
    setIsOpen(shouldOpen);
    if (wasOpen !== shouldOpen) selectionHaptic();
    Animated.timing(deleteProgress, {
      toValue: shouldOpen ? 1 : 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  const updateDeleteFromDelta = (dx: number, dy = 0): boolean => {
    if (Math.abs(dx) <= Math.abs(dy) * 0.9 || (!openRef.current && dx >= 0)) return false;
    const base = openRef.current ? -60 : 0;
    const next = Math.max(-60, Math.min(0, base + dx));
    deleteFractionRef.current = Math.min(1, Math.max(0, Math.abs(next) / 60));
    deleteProgress.setValue(deleteFractionRef.current);
    if (!openRef.current && next <= -30) setIsOpen(true);
    return true;
  };
  const onInputTouchStart = (event: GestureResponderEvent): void => {
    const { pageX, pageY } = event.nativeEvent;
    touchStartRef.current = { pageX, pageY };
    touchActiveRef.current = false;
  };
  const onInputTouchMove = (event: GestureResponderEvent): void => {
    if (!touchStartRef.current) return;
    const { pageX, pageY } = event.nativeEvent;
    const dx = pageX - touchStartRef.current.pageX;
    const dy = pageY - touchStartRef.current.pageY;
    if (updateDeleteFromDelta(dx, dy)) touchActiveRef.current = true;
  };
  const onInputTouchEnd = () => {
    if (touchActiveRef.current) settleDelete(deleteFractionRef.current >= 0.5);
    touchStartRef.current = null;
    touchActiveRef.current = false;
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 3 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.65 &&
        (openRef.current || gesture.dx < 0),
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 3 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.65 &&
        (openRef.current || gesture.dx < 0),
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => updateDeleteFromDelta(gesture.dx, gesture.dy),
      onPanResponderRelease: (_, gesture) =>
        settleDelete(Math.max(-60, Math.min(0, (openRef.current ? -60 : 0) + gesture.dx)) < -30),
    }),
  ).current;
  const setRowContent = (
    <Animated.View
      style={{
        opacity: entranceProgress,
        transform: [
          { translateY: entranceProgress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
        ],
      }}
    >
      <SetRow
        set={set}
        index={index}
        onChange={onChange}
        onToggle={onToggle}
        onDelete={onDelete}
        onInputTouchStart={onInputTouchStart}
        onInputTouchMove={onInputTouchMove}
        onInputTouchEnd={onInputTouchEnd}
      />
    </Animated.View>
  );

  return (
    <View {...panResponder.panHandlers} style={styles.swipeRow}>
      <View pointerEvents={isOpen ? 'auto' : 'none'} style={styles.deleteActionLayer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete set ${index + 1}`}
          onPress={onDelete}
          style={styles.deleteSetInline}
        >
          <Icon name="trash" size={21} color={dashboardTheme.surface} weight="regular" />
        </Pressable>
      </View>
      <Animated.View
        pointerEvents="auto"
        accessibilityLabel={`Set ${index + 1}`}
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}
        style={[
          styles.swipeContent,
          {
            transform: [
              {
                translateX: deleteProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -60],
                }),
              },
            ],
          },
        ]}
      >
        {setRowContent}
      </Animated.View>
    </View>
  );
}

interface SetRowProps extends SwipeableSetRowProps {
  onInputTouchStart: (event: GestureResponderEvent) => void;
  onInputTouchMove: (event: GestureResponderEvent) => void;
  onInputTouchEnd: () => void;
}
function SetRow({
  set,
  index,
  onChange,
  onToggle,
  onDelete,
  onInputTouchStart,
  onInputTouchMove,
  onInputTouchEnd,
}: SetRowProps) {
  const weightInvalidProgress = useRef(new Animated.Value(0)).current;
  const repsInvalidProgress = useRef(new Animated.Value(0)).current;
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = set.previous || '—';
  useEffect(
    () => () => {
      if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
      weightInvalidProgress.stopAnimation();
      repsInvalidProgress.stopAnimation();
    },
    [],
  );
  const animateInvalidField = (field: 'weight' | 'reps', value: number, duration = 150): void => {
    Animated.timing(field === 'weight' ? weightInvalidProgress : repsInvalidProgress, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
  };
  const updateField = (field: 'weight' | 'reps', value: string): void => {
    animateInvalidField(field, 0, 300);
    onChange({ [field]: value });
  };
  const handleToggle = (): void => {
    if (!set.completed) {
      const missingWeight = !String(set.weight || '').trim();
      const missingReps = !String(set.reps || '').trim();
      if (missingWeight || missingReps) {
        animateInvalidField('weight', missingWeight ? 1 : 0);
        animateInvalidField('reps', missingReps ? 1 : 0);
        if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
        invalidTimerRef.current = setTimeout(() => {
          animateInvalidField('weight', 0, 300);
          animateInvalidField('reps', 0, 300);
          invalidTimerRef.current = null;
        }, 1200);
        errorHaptic();
        return;
      }
    }
    onToggle();
  };
  const invalidStyle = (progress: Animated.Value) => ({
    borderColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [dashboardTheme.divider, '#FF3B30'],
    }),
    borderWidth: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }),
    borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [9, 8] }),
  });
  return (
    <View style={[styles.setRow, set.completed && styles.setCompleted]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Set ${index + 1} options`}
        accessibilityHint="Use the accessibility actions to delete this set"
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}
        style={styles.setNumberWrap}
      >
        <Text style={styles.setNumber}>{index + 1}</Text>
      </Pressable>
      <Text style={styles.previous} numberOfLines={1}>
        {previous}
      </Text>
      <AnimatedTextInput
        accessibilityLabel={`Weight for set ${index + 1}`}
        value={String(set.weight)}
        onChangeText={(weight) => updateField('weight', weight)}
        onTouchStart={onInputTouchStart}
        onTouchMove={onInputTouchMove}
        onTouchEnd={onInputTouchEnd}
        keyboardType="decimal-pad"
        placeholder={set.targetWeight || '—'}
        style={[styles.input, styles.inputColumn, invalidStyle(weightInvalidProgress)]}
      />
      <AnimatedTextInput
        accessibilityLabel={`Reps for set ${index + 1}`}
        value={String(set.reps)}
        onChangeText={(reps) => updateField('reps', reps)}
        onTouchStart={onInputTouchStart}
        onTouchMove={onInputTouchMove}
        onTouchEnd={onInputTouchEnd}
        keyboardType="number-pad"
        placeholder={set.targetReps || '—'}
        style={[styles.input, styles.inputColumn, invalidStyle(repsInvalidProgress)]}
      />
      <View style={styles.check}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.completed }}
          accessibilityLabel={
            set.completed ? `Set ${index + 1} completed` : `Complete set ${index + 1}`
          }
          onPress={handleToggle}
          style={styles.checkPressable}
        >
          <View style={[styles.checkVisual, set.completed && styles.checkActive]}>
            {set.completed && <Icon name="check" size={15} color={dashboardTheme.surface} />}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function AddExerciseSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add exercise</Text>
          <TextInput
            autoFocus
            accessibilityLabel="Exercise name"
            placeholder="Exercise name"
            value={name}
            onChangeText={setName}
            style={styles.nameInput}
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onSubmit(name)}
          />
          <View style={styles.sheetActions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} theme={dashboardTheme} />
            <Button
              label="Add exercise"
              disabled={!name.trim()}
              onPress={() => onSubmit(name)}
              theme={dashboardTheme}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ExerciseOptionsSheet({
  visible,
  exercise,
  onClose,
  onRemove,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Options</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close options"
              onPress={onClose}
              style={styles.sheetClose}
            >
              <Text style={styles.sheetCloseText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.sheetExerciseName}>{exercise.name}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${exercise.name}`}
            onPress={onRemove}
            style={styles.destructiveAction}
          >
            <Text style={styles.destructiveText}>Remove exercise</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29,37,45,0.24)',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    maxWidth: '100%',
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(23,25,28,0.08)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.2,
  },
  titleBlock: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  nameUnderlineWrap: {
    maxWidth: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
    borderBottomWidth: 1,
  },
  cancelButton: {
    minWidth: 82,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(85,88,92,0.24)',
    backgroundColor: 'rgba(85,88,92,0.08)',
  },
  finishButton: {
    minWidth: 82,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(29,37,45,0.22)',
    backgroundColor: 'rgba(29,37,45,0.10)',
  },
  finishLabel: { fontFamily: typography.bold, fontWeight: '700' },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  elapsedInfo: { minWidth: 92, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerReset: {
    minWidth: 92,
    height: 48,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: 14,
  },
  timerIndicator: {
    minHeight: 32,
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  restValue: {
    minWidth: 34,
    marginLeft: 0,
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'right',
  },
  elapsedValue: {
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 17,
    lineHeight: 22,
  },
  keyboardArea: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 18 },
  exerciseCard: {
    backgroundColor: dashboardTheme.surface,
    borderRadius: 16,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(226,227,224,0.72)',
    shadowColor: dashboardTheme.ink,
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  exerciseHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  exerciseName: {
    flex: 1,
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginRight: -6,
  },
  setHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: dashboardTheme.divider,
  },
  setHeaderText: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 11.5 },
  setRow: {
    position: 'relative',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setCompleted: {},
  setColumn: { width: 46 },
  previousColumn: { flex: 1 },
  inputColumn: { width: 58 },
  checkColumn: { width: 44 },
  setNumberWrap: { width: 46, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  setNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    backgroundColor: dashboardTheme.surfaceMuted,
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  previous: {
    flex: 1,
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 13,
    paddingRight: 2,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 9,
    backgroundColor: dashboardTheme.surfaceMuted,
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 3,
  },
  check: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  checkPressable: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkVisual: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    borderRadius: 12,
  },
  checkActive: { backgroundColor: dashboardTheme.iconSport, borderColor: dashboardTheme.iconSport },
  addSet: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: dashboardTheme.divider,
  },
  addSetText: { color: dashboardTheme.accent, fontFamily: typography.medium, fontSize: 13 },
  addExercise: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 12,
    backgroundColor: dashboardTheme.surface,
  },
  addExerciseText: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 13,
    fontWeight: '600',
  },
  muted: {
    color: dashboardTheme.slate,
    fontFamily: typography.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 20 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.22)' },
  sheet: {
    backgroundColor: dashboardTheme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: dashboardTheme.divider,
  },
  restTimerBackdrop: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23,25,28,0.12)',
  },
  restTimerSheet: {
    width: '100%',
    minHeight: 410,
    maxHeight: '78%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 8,
    backgroundColor: dashboardTheme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  restTimerHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restCloseButton: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  restCloseText: { color: dashboardTheme.ink, fontFamily: typography.medium, fontSize: 14 },
  restTimerTitle: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 16,
    fontWeight: '600',
  },
  restHeaderBalance: { width: 64, height: 44 },
  activeRestTimer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 4,
  },
  progressRing: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  progressLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2 },
  progressCaption: {
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 15,
    lineHeight: 21,
  },
  progressValue: {
    color: dashboardTheme.accent,
    fontFamily: typography.semibold,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600',
  },
  restQuickActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  restQuickButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(111,127,242,0.10)',
  },
  restQuickText: {
    color: dashboardTheme.accent,
    fontFamily: typography.semibold,
    fontSize: 14,
    fontWeight: '600',
  },
  durationPicker: { height: 282, position: 'relative', overflow: 'hidden' },
  durationPickerContent: { paddingVertical: 119 },
  durationRow: { height: 44, alignItems: 'center', justifyContent: 'center' },
  durationText: {
    color: dashboardTheme.slate,
    fontFamily: typography.regular,
    fontSize: 22,
    lineHeight: 30,
    opacity: 0.58,
  },
  durationTextSelected: {
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 24,
    opacity: 1,
  },
  durationTextFaded: { opacity: 0.24 },
  durationSelection: {
    position: 'absolute',
    top: 119,
    left: 0,
    right: 0,
    height: 44,
    borderRadius: 12,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  restStartButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: dashboardTheme.accent,
  },
  restStartText: {
    color: dashboardTheme.surface,
    fontFamily: typography.semibold,
    fontSize: 14,
    fontWeight: '600',
  },
  sheetDragArea: { minHeight: 24, alignItems: 'center', justifyContent: 'center' },
  swipeRow: { position: 'relative', overflow: 'hidden' },
  swipeContent: { zIndex: 1, backgroundColor: dashboardTheme.surface },
  deleteActionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 60,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  deleteSetInline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C54848',
  },
  sheetTitle: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 20,
    fontWeight: '600',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: {
    color: dashboardTheme.ink,
    fontFamily: typography.regular,
    fontSize: 28,
    lineHeight: 30,
  },
  sheetExerciseName: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 13 },
  destructiveAction: {
    minHeight: 48,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: dashboardTheme.divider,
  },
  destructiveText: {
    color: '#C54848',
    fontFamily: typography.semibold,
    fontSize: 14,
    fontWeight: '600',
  },
  nameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: dashboardTheme.ink,
    fontFamily: typography.regular,
    fontSize: 16,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
