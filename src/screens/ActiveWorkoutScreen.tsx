import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
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
  HeaderEdge,
  ForgeBottomSheet,
  ForgeFloatingCta,
  ForgeSheetHeader,
  ForgeTextInput,
  Icon,
  pressedFeedback,
} from '../components/ui';
import { usePrimaryDock } from '../navigation/PrimaryDockContext';
import { useWorkouts } from '../state/WorkoutContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootTabScreenProps, Workout, WorkoutExercise } from '../types';
import { lightHaptic, successHaptic } from './activeWorkout/activeWorkoutFeedback';
import {
  formatElapsed,
  formatRest,
  formatRestDisplay,
} from './activeWorkout/activeWorkoutFormatters';
import { ExerciseSection as ExtractedExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet as ExtractedAddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { RestTimerIndicator, RestTimerSheet } from './activeWorkout/RestTimer';
import { createActiveWorkoutStyles } from './activeWorkout/activeWorkoutStyles';
import { useFocusedSetKeyboardLift } from './activeWorkout/useFocusedSetKeyboardLift';

type ActiveWorkoutScreenProps = RootTabScreenProps<'ActiveWorkout'>;
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
    updateActiveWorkout,
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
  const [headerElevated, setHeaderElevated] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [workoutNameDraft, setWorkoutNameDraft] = useState('');
  const [workoutNoteDraft, setWorkoutNoteDraft] = useState('');
  const timerLongPressRef = useRef(false);
  const workoutListRef = useRef<FlatList<WorkoutExercise>>(null);
  const dockCompactOnUi = useSharedValue(false);
  const { setCompact: setDockCompact } = usePrimaryDock();
  const { onSetInputFocus, onScrollOffsetChange } = useFocusedSetKeyboardLift(workoutListRef);

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
  const handleDockCompactChange = useCallback(
    (nextCompact: boolean): void => setDockCompact(nextCompact),
    [setDockCompact],
  );
  const handleWorkoutScrollOffset = useCallback((offset: number) => {
    onScrollOffsetChange(offset);
    setHeaderElevated((current) => {
      const next = offset > 1;
      return current === next ? current : next;
    });
  }, [onScrollOffsetChange]);
  useEffect(() => () => setDockCompact(false), [setDockCompact]);
  const workoutScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      runOnJS(handleWorkoutScrollOffset)(event.contentOffset.y);
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
    (exercises: import('../data/exerciseCatalog').ExerciseCatalogItem[]) => {
      lightHaptic();
      exercises.forEach((exercise) => addExercise({ exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: { id: exercise.id, name: exercise.name, catalogueVersion: 3, trackingType: exercise.trackingType ?? 'weight-reps', familyId: exercise.familyId, equipment: exercise.equipmentIds, workoutTypeIds: exercise.workoutTypeIds, category: exercise.category, bodyRegion: exercise.bodyRegion, primaryMuscle: exercise.primaryMuscle, secondaryMuscles: exercise.secondaryMuscles, aliases: exercise.aliases, searchTerms: exercise.searchTerms, movementPattern: exercise.movementPattern } }));
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
        onSetInputFocus={onSetInputFocus}
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
      onSetInputFocus,
      updateSet,
    ],
  );
  const returnToDashboard = (finished: Workout | null): void =>
    navigation.navigate(
      'Dashboard',
      finished?.completedAt ? { selectedDay: new Date(finished.completedAt).getDate() } : undefined,
    );

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
            onPress={() => navigation.navigate('Dashboard')}
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
            successHaptic();
            returnToDashboard(null);
          },
        },
      ]);
      return;
    }
    successHaptic();
    const finished = finishWorkout();
    returnToDashboard(finished);
  };

  const handleCancel = (): void => {
    cancelWorkout();
    returnToDashboard(null);
  };
  const openWorkoutEditor = (): void => {
    setWorkoutNameDraft(activeWorkout.name);
    setWorkoutNoteDraft(activeWorkout.note);
    setEditingWorkout(true);
  };
  const saveWorkoutEditor = (): void => {
    const name = workoutNameDraft.trim();
    if (!name) return;
    updateActiveWorkout((current) => ({ ...current, name, note: workoutNoteDraft.trim() }));
    setEditingWorkout(false);
  };

  return (
    <AppScreen
      backgroundColor={theme.background}
      edges={['top']}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeadingActions}>
            <HeaderAction
              accessibilityLabel="Cancel workout"
              icon="close"
              label="Cancel"
              iconOnly
              onPress={handleCancel}
            />
            <HeaderAction
              accessibilityLabel="Edit live workout"
              icon="note"
              iconOnly
              onPress={openWorkoutEditor}
            />
          </View>
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
            onPress={handleFinish}
            variant="primary"
            haptic="none"
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
        {headerElevated ? <HeaderEdge /> : null}
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        enabled={Platform.OS !== 'ios'}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
      >
        <Animated.FlatList
          ref={workoutListRef}
          testID="active-workout-list"
          data={activeWorkout.exercises}
          renderItem={renderExercise}
          keyExtractor={(exercise) => exercise.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          scrollsChildToFocus
          nestedScrollEnabled
          onScroll={workoutScrollHandler}
          scrollEventThrottle={16}
          ListFooterComponent={
            <Button
              accessibilityLabel="Add exercise"
              label="Add exercise"
              icon="add"
              iconSize={17}
              variant="outline"
              onPress={() => {
                setSheetOpen(true);
              }}
              style={styles.addExercise}
            />
          }
        />
      </KeyboardAvoidingView>
      <ExtractedAddExerciseSheet
        visible={sheetOpen}
        onClose={handleAddExerciseClose}
        onSubmit={handleAddExercises}
      />
      <ForgeBottomSheet
        visible={editingWorkout}
        onClose={() => setEditingWorkout(false)}
        accessibilityLabel="Close edit live workout"
        initialOffset={360}
        closeDistance={360}
        style={{ paddingHorizontal: 20, paddingBottom: 12 }}
      >
        <ForgeSheetHeader title="Edit workout" onClose={() => setEditingWorkout(false)} />
        <Text style={styles.timerLabel}>Name</Text>
        <ForgeTextInput value={workoutNameDraft} onChangeText={setWorkoutNameDraft} accessibilityLabel="Workout name" style={{ marginTop: 6 }} />
        <Text style={[styles.timerLabel, { marginTop: 16 }]}>Note</Text>
        <ForgeTextInput value={workoutNoteDraft} onChangeText={setWorkoutNoteDraft} accessibilityLabel="Workout note" multiline style={{ marginTop: 6, minHeight: 78 }} />
        <ForgeFloatingCta label="Save changes" accessibilityLabel="Save live workout changes" onPress={saveWorkoutEditor} disabled={!workoutNameDraft.trim()} tone="success" />
      </ForgeBottomSheet>
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
    </AppScreen>
  );
}
