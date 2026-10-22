import { useForgeDetailHeading } from '../components/ui';
import { ForgePressable as Pressable } from '../components/ui/ForgePressable';
import { FinishWorkoutSheet } from './activeWorkout/FinishWorkoutSheet';
import { workoutNeedsFinishReview } from '../domain/workouts/finishWorkout';
import { scheduleOnRN } from 'react-native-worklets';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import {
  AppScreen,
  Button,
  ForgeText as Text,
  ForgeTextInput,
  ForgeAttributeEditorSheet,
  ForgeBottomSheet,
  HeaderAction,
  HeaderActionGroup,
  ForgeWorkoutFinishAction,
  HeaderEdge,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeSwipeableAttributeRow,
  Icon,
  pressedFeedback,
} from '../components/ui';
import { usePrimaryDock } from '../navigation/PrimaryDockContext';
import { useForgeDockScrollInset } from '../components/DockChrome';
import { useActiveWorkout, useWorkouts } from '../state/WorkoutContext';
import { usePlans } from '../state/PlansContext';
import { useRestTimer } from '../state/RestTimerContext';
import { useSettings } from '../state/SettingsContext';
import { useExerciseCatalog } from '../state/ExerciseCatalogContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ForgeAttributeDraft } from '../components/ui';
import type { RootTabScreenProps, Workout, WorkoutExercise, WorkoutSetChanges } from '../types';
import { animateLayout, lightHaptic, successHaptic } from './activeWorkout/activeWorkoutFeedback';
import { useForgeReducedMotion } from '../theme/motion';
import {
  formatElapsed,
  formatRest,
  formatRestDisplay,
} from './activeWorkout/activeWorkoutFormatters';
import { ExerciseOptionsController } from './activeWorkout/ExerciseOptionsController';
import { ExerciseSection as ExtractedExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet as ExtractedAddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { RestTimerIndicator, RestTimerSheet } from './activeWorkout/RestTimer';
import { WorkoutDurationSheet } from './activeWorkout/WorkoutDurationSheet';
import { createActiveWorkoutStyles } from './activeWorkout/activeWorkoutStyles';
import { useFocusedSetKeyboardLift } from './activeWorkout/useFocusedSetKeyboardLift';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import { createExerciseSnapshot } from '../domain/exercises/exerciseSnapshot';
import { recordRestTimerSample } from '../state/workoutMutations';
import { useSynchronizedNow } from '../domain/rest/synchronizedClock';

type ActiveWorkoutScreenProps = RootTabScreenProps<'ActiveWorkout'>;
const exerciseKeyExtractor = (exercise: WorkoutExercise): string => exercise.id;
export function ActiveWorkoutScreen({ navigation, route }: ActiveWorkoutScreenProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const reducedMotion = useForgeReducedMotion();
  const dockScrollInset = useForgeDockScrollInset();
  const currentWorkout = useActiveWorkout();
  const [finishSnapshot, setFinishSnapshot] = useState<Workout | null>(null);
  const activeWorkout = currentWorkout ?? finishSnapshot;
  const {
    ready,
    addExercises,
    addSet,
    removeSet,
    removeExercise,
    updateExercise,
    addWarmupSets,
    updateSet,
    toggleSet,
    updateActiveWorkout,
    cancelWorkout,
    finishWorkout,
  } = useWorkouts();
  const { exercises: catalogExercises } = useExerciseCatalog();
  const [restSelection, setRestSelection] = useState(90);
  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [durationSheetOpen, setDurationSheetOpen] = useState(false);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishingDirect, setFinishingDirect] = useState(false);
  const [finishError, setFinishError] = useState('');
  const directFinishLocked = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [addExerciseSession, setAddExerciseSession] = useState(0);
  const [headerElevated, setHeaderElevated] = useState(false);
  const { preferences } = useSettings();
  const { findRoutine, plans, reload: reloadPlans } = usePlans();
  const restTimer = useRestTimer();
  const { headerTitle: recordHeaderTitle, contentTitle } = useForgeDetailHeading(activeWorkout?.name ?? 'Workout', 'live-workout-header-title', styles.headerTitle);


  useEffect(
    () =>
      navigation.addListener('focus', () => {
        setFinishSnapshot(null);
        setFinishError('');
      }),
    [navigation],
  );

  const restRemaining = restTimer.remaining;
  const restRunning = restTimer.running;
  const restEndAt = restTimer.endAt;
  const restDuration = restTimer.duration || preferences.defaultRestSeconds;

  const startRestTimer = useCallback((duration: number): void => {
    lightHaptic();
    restTimer.start(duration);
  }, [restTimer]);
  const restDurationForExercise = useCallback((exercise: WorkoutExercise): number => {
    const exerciseId = exercise.exerciseId ?? exercise.exerciseSnapshot?.id;
    const override = exerciseId ? preferences.exerciseRestSeconds[exerciseId] : undefined;
    const snapshotRest = exercise.exerciseSnapshot?.restSeconds;
    const catalogRest = exerciseId ? catalogExercises.find((item) => item.id === exerciseId)?.restSeconds : undefined;
    return override ?? snapshotRest ?? catalogRest ?? preferences.defaultRestSeconds;
  }, [catalogExercises, preferences.defaultRestSeconds, preferences.exerciseRestSeconds]);
  const unilateralRestForExercise = useCallback((exercise: WorkoutExercise): number => {
    const exerciseId = exercise.exerciseId ?? exercise.exerciseSnapshot?.id;
    const override = exerciseId ? preferences.exerciseUnilateralRestSeconds[exerciseId] : undefined;
    return override ?? preferences.defaultUnilateralRestSeconds;
  }, [preferences.defaultUnilateralRestSeconds, preferences.exerciseUnilateralRestSeconds]);
  const handleSetCompleted = useCallback((exercise: WorkoutExercise): void => {
    const duration = restDurationForExercise(exercise);
    // Completion timestamps, not the configured countdown, own the actual
    // rest metric. Keep collecting them when the visible rest timer is off.
    updateActiveWorkout((current) => recordRestTimerSample(current, duration));
    // Completing a set is real activity — defer the unfinished-workout reminder
    // from here even when the rest timer display (and thus start()) is off.
    restTimer.noteActivity();
    if (!preferences.showRestTimer) return;
    startRestTimer(duration);
  }, [preferences.showRestTimer, restDurationForExercise, restTimer, startRestTimer, updateActiveWorkout]);
  const handleSetSideCompleted = useCallback((exercise: WorkoutExercise): void => {
    // The first side of a unilateral set is done: rest between sides before the
    // other. This is a shorter, separate countdown from the between-sets rest,
    // and it deliberately does not record a rest-stats sample (that measures
    // between-set rest, which lands only once both sides finish).
    if (!preferences.showRestTimer || preferences.disableUnilateralBetweenSidesRest) return;
    startRestTimer(unilateralRestForExercise(exercise));
  }, [preferences.disableUnilateralBetweenSidesRest, preferences.showRestTimer, startRestTimer, unilateralRestForExercise]);
  const openRestTimer = () => {
    lightHaptic();
    if (restRunning) setRestSelection(restDuration);
    setRestSheetOpen(true);
  };
  useEffect(() => {
    if (!restRunning) setRestSelection(preferences.defaultRestSeconds);
  }, [preferences.defaultRestSeconds, restRunning]);
  useEffect(() => {
    if (!preferences.showRestTimer) setRestSheetOpen(false);
  }, [preferences.showRestTimer]);
  useEffect(() => {
    if (route.params?.openRestTimer == null) return;
    // Always clear the param (even a non-"open" deep-link segment), and only open
    // the timer when there is a live workout with the rest timer enabled — never
    // over the "No active workout" state.
    const shouldOpen =
      route.params.openRestTimer === 'open' && Boolean(activeWorkout) && preferences.showRestTimer;
    navigation.setParams({ openRestTimer: undefined });
    if (shouldOpen) openRestTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, route.params?.openRestTimer]);
  useEffect(() => {
    if (route.params?.openAddExercises !== 'open') return;
    // Keep the picker present from the destination's first visible frame. This
    // avoids flashing an empty Live Workout between Dashboard's start action
    // and the mandatory Add exercises decision.
    setAddExerciseSession((current) => current + 1);
    setSheetOpen(true);
    navigation.setParams({ openAddExercises: undefined });
  }, [navigation, route.params?.openAddExercises]);
  // This screen stays mounted across sessions, so an Add-exercise picker left
  // open by one workout would otherwise reappear on the next one. When a
  // different workout becomes live, close any leftover picker — unless this
  // navigation explicitly asked to open it (the blank-start flow above).
  const activeWorkoutId = activeWorkout?.id;
  const lastWorkoutIdRef = useRef(activeWorkoutId);
  useEffect(() => {
    if (lastWorkoutIdRef.current === activeWorkoutId) return;
    lastWorkoutIdRef.current = activeWorkoutId;
    if (route.params?.openAddExercises === 'open') return;
    setSheetOpen(false);
    setReplacingExerciseId(null);
  }, [activeWorkoutId, route.params?.openAddExercises]);
  const adjustRestTimer = (amount: number): void => {
    lightHaptic();
    restTimer.adjust(amount);
  };
  const stopRestTimer = () => {
    lightHaptic();
    restTimer.stop();
  };
  const setAutomaticTimeTracking = (enabled: boolean): void => {
    lightHaptic();
    const changedAt = Date.now();
    updateActiveWorkout((current) => {
      const frozenSeconds = current.automaticTimeTracking === false
        ? current.durationSeconds ?? 0
        : Math.max(0, Math.floor((changedAt - current.startedAt) / 1000));
      return enabled
        ? { ...current, automaticTimeTracking: true, startedAt: changedAt - frozenSeconds * 1000, durationSeconds: undefined }
        : { ...current, automaticTimeTracking: false, durationSeconds: frozenSeconds };
    });
  };
  const resetWorkoutStartTime = (): void => {
    const resetAt = Date.now();
    updateActiveWorkout((current) => ({
      ...current,
      startedAt: resetAt,
      durationSeconds: current.automaticTimeTracking === false ? 0 : undefined,
    }));
  };
  const setWorkoutStartTime = (startedAt: number): void => {
    updateActiveWorkout((current) => ({ ...current, startedAt }));
  };
  const handleAddExerciseClose = useCallback(() => setSheetOpen(false), []);
  const openAddExercise = useCallback(() => {
    // Dismiss any open set-entry keyboard first so the picker opens against a
    // settled layout (a keyboard up at open time could otherwise stall the
    // sheet's content-measured entrance).
    Keyboard.dismiss();
    // Each presentation gets fresh picker state. This releases any interrupted
    // sheet gesture/focus state before the next Add exercise tap.
    setAddExerciseSession((current) => current + 1);
    // Open on the next frame rather than in the same tick as the keyboard
    // dismissal. Toggling `visible` inside that dismiss layout pass is what made
    // the picker intermittently fail to appear; a one-frame defer lets the
    // dismissal flush so the entrance always runs.
    requestAnimationFrame(() => setSheetOpen(true));
  }, []);
  const handleWorkoutScrollOffset = useCallback((offset: number) => {
    setHeaderElevated(offset > 1);
  }, []);
  const handleAddExercises = useCallback(
    (exercises: import('../data/exerciseCatalog').ExerciseCatalogItem[]) => {
      lightHaptic();
      animateLayout(reducedMotion);
      addExercises(exercises.map((exercise) => ({ exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: createExerciseSnapshot(exercise) })));
      setSheetOpen(false);
    },
    [addExercises, reducedMotion],
  );
  const replaceExercise = useCallback((exercises: import('../data/exerciseCatalog').ExerciseCatalogItem[]) => {
    const replacement = exercises[0];
    const exerciseId = replacingExerciseId;
    if (!replacement || !exerciseId) return;
    updateActiveWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? {
        ...exercise,
        exerciseId: replacement.id,
        name: replacement.name,
        trackingType: replacement.trackingType,
        exerciseSnapshot: createExerciseSnapshot(replacement),
      } : exercise),
    }));
    setReplacingExerciseId(null);
  }, [replacingExerciseId, updateActiveWorkout]);
  const returnToDashboard = (finished: Workout | null): void =>
    navigation.navigate(
      'Dashboard',
      finished?.completedAt ? { selectedDate: calendarDateKey(finished.completedAt) } : undefined,
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

  const completeWorkout = async (
    choice: import('../types').FinishRoutineChoice,
  ): Promise<boolean> => {
    // Retain the outgoing scene while persistence clears the active slot.
    setFinishSnapshot(activeWorkout);
    let finished: Workout | null;
    try {
      finished = await finishWorkout(choice);
    } catch (error) {
      setFinishSnapshot(null);
      throw error;
    }
    if (!finished) {
      setFinishSnapshot(null);
      return false;
    }
    setFinishOpen(false);
    successHaptic();
    returnToDashboard(finished);
    void reloadPlans().catch(() => undefined);
    return true;
  };
  const handleFinish = async (): Promise<void> => {
    if (directFinishLocked.current || finishSnapshot) return;
    setFinishError('');
    const source = activeWorkout.routineId ? findRoutine(activeWorkout.routineId) : undefined;
    if (workoutNeedsFinishReview(activeWorkout, source)) {
      setFinishOpen(true);
      return;
    }
    directFinishLocked.current = true;
    setFinishingDirect(true);
    setFinishError('');
    try {
      if (!(await completeWorkout({ kind: 'keep' }))) {
        setFinishError('The workout could not be saved. Try again.');
      }
    } catch {
      setFinishError('The workout could not be saved. Try again.');
    } finally {
      directFinishLocked.current = false;
      setFinishingDirect(false);
    }
  };

  const discardWorkout = (): void => {
    cancelWorkout();
    returnToDashboard(null);
  };
  // A workout the user opened but never logged into — whether blank or started
  // from a routine (which pre-fills empty exercises) — has nothing to lose, so
  // cancelling it closes straight away instead of prompting. Any logged work
  // (a completed set, an entered value, a set note/tag) or a workout note keeps
  // the discard confirmation.
  const workoutUntouched =
    !activeWorkout.note?.trim() &&
    !activeWorkout.exercises.some((exercise) =>
      exercise.sets.some((set) =>
        set.completed ||
        set.weight.trim() !== '' ||
        set.reps.trim() !== '' ||
        (set.measurements?.length ?? 0) > 0 ||
        Boolean(set.comment?.trim()) ||
        Boolean(set.tag),
      ),
    );
  const handleCancel = (): void => {
    if (finishSnapshot || directFinishLocked.current) return;
    if (workoutUntouched) {
      discardWorkout();
      return;
    }
    setDiscardConfirmationOpen(true);
  };
  const openWorkoutEditor = (): void =>
    navigation.navigate('HistoryWorkoutEditor', { mode: 'active' });
  return (
    <AppScreen
      backgroundColor={theme.background}
      edges={['top']}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View testID="live-workout-header" style={styles.headerTop}>
          <View style={{ width: 90 }}>
            <HeaderActionGroup testID="live-workout-leading-actions">
              <HeaderAction
                accessibilityLabel="Cancel workout"
                icon="close"
                label="Cancel"
                iconOnly
                onPress={handleCancel}
                disabled={Boolean(finishSnapshot)}
                variant="ghost"
                style={styles.joinedHeaderAction}
              />
              <HeaderAction
                accessibilityLabel="Edit live workout"
                icon="note"
                iconOnly
                onPress={openWorkoutEditor}
                disabled={Boolean(finishSnapshot)}
                variant="ghost"
                style={styles.joinedHeaderAction}
              />
            </HeaderActionGroup>
          </View>
          {recordHeaderTitle}
          <View style={{ width: 90, alignItems: 'flex-end' }}>
            <ForgeWorkoutFinishAction onPress={() => void handleFinish()} loading={finishingDirect} />
          </View>
        </View>
        {finishError ? (
          <Text accessibilityRole="alert" style={{ ...styles.muted, color: theme.textDestructive }}>
            {finishError}
          </Text>
        ) : null}
        <View testID="workout-timer-strip" style={styles.elapsedPanel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open workout duration"
          onPress={() => {
            lightHaptic();
            setDurationSheetOpen(true);
          }}
          style={({ pressed }) => [styles.elapsedInfo, pressed && pressedFeedback]}
        >
            <Icon name="clock" size={22} color={theme.slate} />
            <ElapsedTimer workout={activeWorkout} style={styles.elapsedValue} />
            <Text style={styles.timerLabel}>Elapsed</Text>
          </Pressable>
          {preferences.showRestTimer ? <>
            <View style={styles.timerDivider} />
            <RestTimerHeaderAction
              endAt={restEndAt}
              fallbackRemaining={restRemaining}
              duration={restDuration}
              running={restRunning}
              style={styles.timerReset}
              labelStyle={styles.timerLabel}
              onOpen={openRestTimer}
              onRestart={() => startRestTimer(preferences.defaultRestSeconds)}
            />
          </> : null}
        </View>
        {headerElevated ? <HeaderEdge /> : null}
      </View>
      <LiveWorkoutExerciseList
        contentTitle={contentTitle}
        workout={activeWorkout}
        addSet={addSet}
        removeSet={removeSet}
        removeExercise={removeExercise}
        updateExercise={updateExercise}
        addWarmupSets={addWarmupSets}
        updateSet={updateSet}
        toggleSet={toggleSet}
        updateActiveWorkout={updateActiveWorkout}
        onSetCompleted={handleSetCompleted}
        onSetSideCompleted={handleSetSideCompleted}
        onReplaceExercise={setReplacingExerciseId}
        onOpenAddExercise={openAddExercise}
        onScrollOffsetChange={handleWorkoutScrollOffset}
        dockScrollInset={dockScrollInset}
      />
      <ExtractedAddExerciseSheet
        // The route effect increments the picker session before making this
        // surface visible. Rendering directly from the route parameter briefly
        // mounted a session-0 picker, then reset a selection as session 1
        // arrived (most visible when starting a brand-new workout).
        visible={sheetOpen}
        session={addExerciseSession}
        workoutType={activeWorkout.type}
        onClose={handleAddExerciseClose}
        onSubmit={handleAddExercises}
      />
      <ExtractedAddExerciseSheet
        visible={Boolean(replacingExerciseId)}
        session={addExerciseSession + 1000}
        workoutType={activeWorkout.type}
        selectionLimit={1}
        onClose={() => setReplacingExerciseId(null)}
        onSubmit={replaceExercise}
      />
      <WorkoutDurationSheet
        visible={durationSheetOpen}
        startedAt={activeWorkout.startedAt}
        automaticTracking={activeWorkout.automaticTimeTracking !== false}
        weekStartsOn={preferences.weekStartsOn}
        onClose={() => setDurationSheetOpen(false)}
        onAutomaticTrackingChange={setAutomaticTimeTracking}
        onStartedAtChange={setWorkoutStartTime}
        onResetStartTime={resetWorkoutStartTime}
      />
      <FinishWorkoutSheet
        visible={finishOpen}
        workout={activeWorkout}
        source={activeWorkout.routineId ? findRoutine(activeWorkout.routineId) : undefined}
        plans={plans}
        onClose={() => setFinishOpen(false)}
        onFinish={completeWorkout}
      />
      <ForgeConfirmationDialog
        visible={discardConfirmationOpen}
        title="Discard workout?"
        message="Your active workout and its progress will be discarded."
        cancelLabel="Keep working out"
        confirmLabel="Discard workout"
        onCancel={() => setDiscardConfirmationOpen(false)}
        onConfirm={() => {
          setDiscardConfirmationOpen(false);
          discardWorkout();
        }}
        testID="discard-live-workout-confirmation"
      />
      {preferences.showRestTimer && restSheetOpen && (
        <RestTimerSheet
          visible
          selectedDuration={restSelection}
          endAt={restEndAt}
          remaining={restRemaining}
          duration={restDuration}
          running={restRunning}
          onClose={() => {
            // Closing the rest timer must never hand focus back to a set input
            // and pop the keyboard — especially when it was opened from the
            // lock-screen notification with no field previously focused.
            Keyboard.dismiss();
            setRestSheetOpen(false);
          }}
          onSelect={setRestSelection}
          onStart={() => startRestTimer(restSelection)}
          onAdjust={adjustRestTimer}
          onStop={stopRestTimer}
        />
      )}
    </AppScreen>
  );
}

/** Keeps the per-second clock out of the editing screen and its mounted sheets. */
const ElapsedTimer = React.memo(function ElapsedTimer({
  workout,
  style,
}: {
  workout: Workout;
  style: import('react-native').StyleProp<import('react-native').TextStyle>;
}) {
  const now = useSynchronizedNow();
  const elapsed = workout.automaticTimeTracking === false
    ? workout.durationSeconds ?? 0
    : Math.max(0, Math.floor((now - workout.startedAt) / 1000));
  return <Text style={style}>{formatElapsed(elapsed)}</Text>;
});

/** Owns the rest clock so the editable workout screen never renders per second. */
const RestTimerHeaderAction = React.memo(function RestTimerHeaderAction({
  endAt, fallbackRemaining, duration, running, style, labelStyle, onOpen, onRestart,
}: {
  endAt: number | null;
  fallbackRemaining: number;
  duration: number;
  running: boolean;
  style: import('react-native').StyleProp<import('react-native').ViewStyle>;
  labelStyle: import('react-native').StyleProp<import('react-native').TextStyle>;
  onOpen: () => void;
  onRestart: () => void;
}) {
  const now = useSynchronizedNow();
  const [displayRemaining, setDisplayRemaining] = useState(fallbackRemaining);
  const longPress = useRef(false);
  const remaining = endAt ? Math.ceil((endAt - now) / 1000) : fallbackRemaining;
  useEffect(() => { setDisplayRemaining(remaining); }, [remaining]);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={running ? `Rest timer, ${Math.abs(displayRemaining)} seconds remaining` : 'Start rest timer'}
    onPress={() => { if (longPress.current) return; onOpen(); }}
    onLongPress={() => { longPress.current = true; onRestart(); }}
    // RN does not fire onPress after a long-press, so reset the guard on release
    // instead — otherwise the next genuine tap is swallowed.
    onPressOut={() => { longPress.current = false; }}
    delayLongPress={450}
    accessibilityHint="Tap to open the rest timer or hold to restart it"
    style={({ pressed }) => [style, pressed && pressedFeedback]}
  >
    <RestTimerIndicator remaining={remaining} duration={duration} running={running} endAt={endAt} onRemainingChange={setDisplayRemaining} />
    <Text style={labelStyle}>Rest</Text>
  </Pressable>;
});

const LiveWorkoutExerciseList = React.memo(function LiveWorkoutExerciseList({
  contentTitle,
  workout,
  addSet,
  removeSet,
  removeExercise,
  updateExercise,
  addWarmupSets,
  updateSet,
  toggleSet,
  updateActiveWorkout,
  onSetCompleted,
  onSetSideCompleted,
  onReplaceExercise,
  onOpenAddExercise,
  onScrollOffsetChange,
  dockScrollInset,
}: {
  contentTitle?: React.ReactNode;
  workout: Workout;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise: (exerciseId: string, changes: import('../types').WorkoutExerciseChanges) => void;
  addWarmupSets: (exerciseId: string, sets: readonly { weight: string; reps: string }[]) => void;
  updateSet: (exerciseId: string, setId: string, changes: WorkoutSetChanges) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  updateActiveWorkout: (update: (workout: Workout) => Workout) => void;
  onSetCompleted: (exercise: WorkoutExercise) => void;
  onSetSideCompleted: (exercise: WorkoutExercise) => void;
  onReplaceExercise: (exerciseId: string) => void;
  onOpenAddExercise: () => void;
  onScrollOffsetChange: (offset: number) => void;
  dockScrollInset: number;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  // Keep modal state outside recycled rows: keyboard restoration can move the
  // selected exercise out of the render window while a request is pending.
  const [optionsSelection, setOptionsSelection] = useState<{
    exercise: WorkoutExercise;
    request: number;
  } | null>(null);
  const openExerciseOptions = useCallback((exercise: WorkoutExercise): void => {
    setOptionsSelection((current) => ({ exercise, request: (current?.request ?? 0) + 1 }));
  }, []);
  const optionsExercise = optionsSelection
    ? workout.exercises.find((item) => item.id === optionsSelection.exercise.id) ??
      optionsSelection.exercise
    : null;
  const [attributeDraft, setAttributeDraft] = useState<ForgeAttributeDraft | null>(null);
  const workoutListRef = useRef<FlatList<WorkoutExercise>>(null);
  const dockCompactOnUi = useSharedValue(false);
  const dockLastOffsetOnUi = useSharedValue(0);
  const dockDirectionDistanceOnUi = useSharedValue(0);
  const { setCompact: setDockCompact } = usePrimaryDock();
  const scrollOffset = useSharedValue(0);
  const { onSetInputFocus, keyboardSpacer } = useFocusedSetKeyboardLift(workoutListRef, scrollOffset);
  const handleDockCompactChange = useCallback((nextCompact: boolean): void => setDockCompact(nextCompact), [setDockCompact]);
  useEffect(() => () => setDockCompact(false), [setDockCompact]);
  const workoutScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offset = event.contentOffset.y;
      const wasElevated = scrollOffset.get() > 1;
      scrollOffset.set(offset);
      if ((offset > 1) !== wasElevated) scheduleOnRN(onScrollOffsetChange, offset);
      const nextOffset = Math.max(0, event.contentOffset.y);
      const delta = nextOffset - dockLastOffsetOnUi.value;
      dockLastOffsetOnUi.value = nextOffset;
      if (Math.abs(delta) < 1) return;
      const movingDown = delta > 0;
      dockDirectionDistanceOnUi.value = (dockDirectionDistanceOnUi.value * (Math.sign(dockDirectionDistanceOnUi.value) === Math.sign(delta) ? 1 : 0)) + delta;
      // Directional hysteresis deliberately does not inspect the absolute
      // offset: arriving at the top cannot enlarge the dock by itself.
      if (movingDown && !dockCompactOnUi.value && dockDirectionDistanceOnUi.value >= 18) {
        dockCompactOnUi.value = true;
        dockDirectionDistanceOnUi.value = 0;
        scheduleOnRN(handleDockCompactChange, true);
      } else if (!movingDown && dockCompactOnUi.value && dockDirectionDistanceOnUi.value <= -18) {
        dockCompactOnUi.value = false;
        dockDirectionDistanceOnUi.value = 0;
        scheduleOnRN(handleDockCompactChange, false);
      }
    },
  });
  const handleExerciseDeleteReveal = useCallback((exerciseId: string, revealed: boolean): void => {
    setOpenExerciseId(revealed ? exerciseId : null);
  }, []);
  const saveLiveAttribute = useCallback((next: ForgeAttributeDraft): void => {
    const label = next.label.trim();
    if (!label) return;
    updateActiveWorkout((current) => {
      const attributes = { ...(current.attributes ?? {}) };
      const attributeIcons = { ...(current.attributeIcons ?? {}) };
      if (next.original && next.original !== label) {
        delete attributes[next.original];
        delete attributeIcons[next.original];
      }
      attributes[label] = next.value;
      attributeIcons[label] = next.icon;
      return { ...current, attributes, attributeIcons };
    });
    setAttributeDraft(null);
  }, [updateActiveWorkout]);
  const deleteLiveAttribute = useCallback((label: string): void => {
    updateActiveWorkout((current) => {
      const attributes = { ...(current.attributes ?? {}) };
      const attributeIcons = { ...(current.attributeIcons ?? {}) };
      delete attributes[label];
      delete attributeIcons[label];
      return {
        ...current,
        attributes: Object.keys(attributes).length ? attributes : undefined,
        attributeIcons: Object.keys(attributeIcons).length ? attributeIcons : undefined,
      };
    });
    setAttributeDraft(null);
  }, [updateActiveWorkout]);
  const updateLiveAttributeValue = useCallback((label: string, value: string): void => {
    updateActiveWorkout((current) => ({
      ...current,
      attributes: { ...(current.attributes ?? {}), [label]: value },
    }));
  }, [updateActiveWorkout]);
  const { changeTracking } = useWorkouts();
  const renderExercise = useCallback(
    ({ item, index }: { item: WorkoutExercise; index: number }) => (
      <ExtractedExerciseSection
        exercise={item}
        onTrackingChange={changeTracking}
        resolveTrackingSelection
        onOpenExerciseOptions={openExerciseOptions}
        index={index}
        addSet={addSet}
        removeSet={removeSet}
        removeExercise={removeExercise}
        updateExercise={updateExercise}
        addWarmupSets={addWarmupSets}
        updateSet={updateSet}
        toggleSet={toggleSet}
        onSetCompleted={onSetCompleted}
        onSetSideCompleted={onSetSideCompleted}
        onReplaceExercise={onReplaceExercise}
        showCatalogMetadata
        showWarmupSets
        onSetInputFocus={onSetInputFocus}
        deleteRevealed={openExerciseId === item.id}
        onDeleteRevealChange={handleExerciseDeleteReveal}
      />
    ),
    [
      addSet,
      addWarmupSets,
      handleExerciseDeleteReveal,
      onReplaceExercise,
      onSetCompleted,
      onSetSideCompleted,
      onSetInputFocus,
      openExerciseId,
      removeExercise,
      removeSet,
      toggleSet,
      updateExercise,
      updateSet,
      changeTracking,
      openExerciseOptions,
    ],
  );
  const liveAttributeEntries = Object.entries(workout.attributes ?? {});

  return (
    <KeyboardAvoidingView
      style={styles.keyboardArea}
      enabled={Platform.OS !== 'ios'}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <Animated.FlatList
        ref={workoutListRef}
        testID="active-workout-list"
        data={workout.exercises}
        renderItem={renderExercise}
        keyExtractor={exerciseKeyExtractor}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        contentContainerStyle={[styles.content, { paddingBottom: dockScrollInset + keyboardSpacer }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // The focused-set keyboard lift already scrolls the field into view;
        // letting iOS also adjust insets made the two fight and scroll stick
        // while the keyboard was up.
        automaticallyAdjustKeyboardInsets={false}
        scrollsChildToFocus
        nestedScrollEnabled
        onScroll={workoutScrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={
          contentTitle || liveAttributeEntries.length || workout.exercises.length ? (
            <View style={styles.listSectionHeader}>{contentTitle}
              {liveAttributeEntries.length ? (
                <View style={styles.liveAttributesSection}>
                  <Text style={styles.listSectionTitle}>Attributes</Text>
                  <ForgeCard variant="base" size="compact">
                    {liveAttributeEntries.map(([label, value], index) => (
                      <ForgeSwipeableAttributeRow
                        key={label}
                        label={label}
                        value={value}
                        icon={workout.attributeIcons?.[label] ?? 'note'}
                        divider={index > 0}
                        compact
                        onDelete={() => deleteLiveAttribute(label)}
                        valueInput={
                          <ForgeTextInput
                            accessibilityLabel={`${label} value`}
                            value={value}
                            onChangeText={(nextValue) => updateLiveAttributeValue(label, nextValue)}
                            placeholder="Add value"
                            placeholderTextColor={theme.textDisabled}
                            style={styles.liveAttributeInput}
                          />
                        }
                      />
                    ))}
                  </ForgeCard>
                </View>
              ) : null}
              {workout.exercises.length ? <Text style={styles.listSectionTitle}>Exercises</Text> : null}
            </View>
          ) : null
        }
        ListFooterComponent={
          <Button
            accessibilityLabel="Add exercise"
            label="Add exercise"
            icon="add"
            iconSize={17}
            variant="outline"
            onPress={onOpenAddExercise}
            style={styles.addExercise}
          />
        }
      />
      {optionsSelection && optionsExercise ? (
        <ExerciseOptionsController
          key={optionsExercise.id}
          exercise={optionsExercise}
          openRequest={optionsSelection.request}
          onTrackingChange={changeTracking}
          resolveTrackingSelection
          updateExercise={updateExercise}
          removeExercise={removeExercise}
          addWarmupSets={addWarmupSets}
          onReplaceExercise={onReplaceExercise}
        />
      ) : null}
      {attributeDraft ? (
        <ForgeBottomSheet visible onClose={() => setAttributeDraft(null)} accessibilityLabel="Close attribute editor" animateContentLayout={false}>
          {() => <ForgeAttributeEditorSheet value={attributeDraft} onClose={() => setAttributeDraft(null)} onSave={saveLiveAttribute} onDelete={() => deleteLiveAttribute(attributeDraft.original ?? attributeDraft.label)} />}
        </ForgeBottomSheet>
      ) : null}
    </KeyboardAvoidingView>
  );
});
