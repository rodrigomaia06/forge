import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppScreen, Button, Icon } from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useWorkouts } from '../state/WorkoutContext';
import { dashboardTheme } from '../theme/dashboardTheme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Workout } from '../types';
import {
  animateLayout,
  errorHaptic,
  lightHaptic,
  selectionHaptic,
} from './activeWorkout/activeWorkoutFeedback';
import {
  formatElapsed,
  formatRest,
  formatRestDisplay,
} from './activeWorkout/activeWorkoutFormatters';
import { ExerciseSection as ExtractedExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet as ExtractedAddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { RestTimerIndicator, RestTimerSheet } from './activeWorkout/RestTimer';
import { styles } from './activeWorkout/activeWorkoutStyles';

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
              <ExtractedExerciseSection
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
      <ExtractedAddExerciseSheet
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
