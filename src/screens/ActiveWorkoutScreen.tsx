import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import {
  AppScreen,
  Button,
  ForgeText as Text,
  HeaderAction,
  Icon,
  pressedFeedback,
} from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useWorkouts } from '../state/WorkoutContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Workout, WorkoutExercise } from '../types';
import { animateLayout, lightHaptic, successHaptic } from './activeWorkout/activeWorkoutFeedback';
import {
  formatElapsed,
  formatRest,
  formatRestDisplay,
} from './activeWorkout/activeWorkoutFormatters';
import { ExerciseSection as ExtractedExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet as ExtractedAddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { RestTimerIndicator, RestTimerSheet } from './activeWorkout/RestTimer';
import { createActiveWorkoutStyles } from './activeWorkout/activeWorkoutStyles';
import { contrastingIconColor, workoutTypeColor } from './activeWorkout/workoutTypeColor';

type ActiveWorkoutScreenProps = NativeStackScreenProps<RootStackParamList, 'ActiveWorkout'>;
export function ActiveWorkoutScreen({ navigation }: ActiveWorkoutScreenProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const {
    activeWorkout,
    ready,
    addExercise,
    addSet,
    removeSet,
    removeExercise,
    updateSet,
    toggleSet,
    cancelWorkout,
    finishWorkout,
  } = useWorkouts();
  const [now, setNow] = useState(() => Date.now());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restDuration, setRestDuration] = useState(60);
  const [restSelection, setRestSelection] = useState(90);
  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  const [dockCompact, setDockCompact] = useState(false);
  const timerLongPressRef = useRef(false);
  const dockCompactOnUi = useSharedValue(false);

  const restCompletionNotified = useRef(false);

  useEffect(() => {
    if (!activeWorkout) return undefined;
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeWorkout]);

  useEffect(() => {
    if (!restEndsAt || now < restEndsAt) return;
    if (!restCompletionNotified.current) {
      restCompletionNotified.current = true;
      successHaptic();
    }
    setRestEndsAt(null);
  }, [now, restEndsAt]);

  const elapsed = activeWorkout
    ? Math.max(0, Math.floor((now - activeWorkout.startedAt) / 1000))
    : 0;
  const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const restRunning = restEndsAt !== null && restRemaining > 0;

  const startRestTimer = useCallback((duration = 60): void => {
    lightHaptic();
    setRestDuration(duration);
    restCompletionNotified.current = false;
    const startedAt = Date.now();
    setNow(startedAt);
    setRestEndsAt(startedAt + duration * 1000);
  }, []);
  const openRestTimer = () => {
    lightHaptic();
    if (restRunning) setRestSelection(restDuration);
    setRestSheetOpen(true);
  };
  const adjustRestTimer = (amount: number): void => {
    lightHaptic();
    const adjustedAt = Date.now();
    setNow(adjustedAt);
    setRestEndsAt((current) => Math.max(adjustedAt, (current ?? adjustedAt) + amount * 1000));
  };
  const skipRestTimer = () => {
    lightHaptic();
    setRestEndsAt(null);
  };
  const handleDockCompactChange = useCallback((nextCompact: boolean): void => {
    setDockCompact((current) => (current === nextCompact ? current : nextCompact));
  }, []);
  const workoutScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const nextCompact = event.contentOffset.y > 12;
      if (nextCompact !== dockCompactOnUi.value) {
        dockCompactOnUi.value = nextCompact;
        runOnJS(handleDockCompactChange)(nextCompact);
      }
    },
  });
  const handleExerciseDeleteReveal = useCallback((exerciseId: string, revealed: boolean): void => {
    setOpenExerciseId(revealed ? exerciseId : null);
  }, []);
  const handleAddExerciseClose = useCallback(() => setSheetOpen(false), []);
  const handleAddExercises = useCallback(
    (names: string[]) => {
      lightHaptic();
      names.forEach((name) => addExercise(name));
      setSheetOpen(false);
    },
    [addExercise],
  );
  const renderExercise = useCallback(
    ({ item, index }: { item: WorkoutExercise; index: number }) => (
      <ExtractedExerciseSection
        exercise={item}
        index={index}
        addSet={addSet}
        removeSet={removeSet}
        removeExercise={removeExercise}
        updateSet={updateSet}
        toggleSet={toggleSet}
        onSetCompleted={startRestTimer}
        deleteRevealed={openExerciseId === item.id}
        onDeleteRevealChange={handleExerciseDeleteReveal}
      />
    ),
    [
      addSet,
      handleExerciseDeleteReveal,
      openExerciseId,
      removeExercise,
      removeSet,
      startRestTimer,
      toggleSet,
      updateSet,
    ],
  );
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
      <AppScreen backgroundColor={theme.background}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading workout…</Text>
        </View>
      </AppScreen>
    );
  if (!activeWorkout)
    return (
      <AppScreen backgroundColor={theme.background}>
        <View style={styles.center}>
          <Text style={styles.title}>No active workout</Text>
          <Button
            label="Back to Dashboard"
            onPress={() => navigation.goBack()}
            theme={theme}
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

  const handleCancel = (): void => {
    cancelWorkout();
    returnToDashboard(null);
  };

  const workoutColor = workoutTypeColor(activeWorkout.type);
  const finishIconColor = contrastingIconColor(workoutColor);

  return (
    <AppScreen
      backgroundColor={theme.background}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <HeaderAction
            accessibilityLabel="Cancel workout"
            icon="close"
            label="Cancel"
            iconOnly
            onPress={handleCancel}
          />
          <View style={styles.titleBlock}>
            <View
              style={styles.titleWrap}
              accessibilityLabel={`Workout type: ${activeWorkout.type}`}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeWorkout.name}
              </Text>
            </View>
          </View>
          <HeaderAction
            accessibilityLabel="Finish workout"
            icon="check"
            label="Finish"
            labelColor={finishIconColor}
            labelStyle={styles.finishLabel}
            onPress={handleFinish}
            tone="accent"
            accentColor={workoutColor}
          />
        </View>
        <View style={styles.elapsedPanel}>
          <View style={styles.elapsedInfo}>
            <Icon name="time-outline" size={22} color={theme.slate} />
            <Text style={styles.elapsedValue}>{formatElapsed(elapsed)}</Text>
            <Text style={styles.timerLabel}>Elapsed</Text>
          </View>
          <View style={styles.timerDivider} />
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
            style={({ pressed }) => [styles.timerReset, pressed && pressedFeedback]}
          >
            <RestTimerIndicator
              remaining={restRemaining}
              duration={restDuration}
              running={restRunning}
            />
            <Text style={styles.timerLabel}>Rest</Text>
          </Pressable>
        </View>
        <View pointerEvents="none" style={styles.headerSeparator} />
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.FlatList
          data={activeWorkout.exercises}
          renderItem={renderExercise}
          keyExtractor={(exercise) => exercise.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onScroll={workoutScrollHandler}
          scrollEventThrottle={16}
          ListFooterComponent={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
              onPress={() => {
                animateLayout();
                setSheetOpen(true);
              }}
              style={({ pressed }) => [styles.addExercise, pressed && pressedFeedback]}
            >
              <Icon name="add" size={17} color={theme.ink} />
              <Text style={styles.addExerciseText}>Add exercise</Text>
            </Pressable>
          }
        />
      </KeyboardAvoidingView>
      {sheetOpen && (
        <ExtractedAddExerciseSheet
          visible
          onClose={handleAddExerciseClose}
          onSubmit={handleAddExercises}
        />
      )}
      {restSheetOpen && (
        <RestTimerSheet
          visible
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
      )}
      <NavigationFooter compact={dockCompact} onInteract={() => setDockCompact(false)} />
    </AppScreen>
  );
}
