import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  appendCompletedWorkout,
  deleteCompletedWorkoutRecord,
  loadWorkoutState,
  saveActiveWorkout,
  updateCompletedWorkoutRecord,
} from '../data/workoutRepository';
import type {
  ChildrenProps,
  StartWorkoutOptions,
  Workout,
  WorkoutContextValue,
  WorkoutExerciseInput,
  WorkoutSetChanges,
} from '../types';
import {
  addExerciseToWorkout,
  addExercisesToWorkout,
  addSetToWorkout,
  createWorkout,
  removeExerciseFromWorkout,
  removeSetFromWorkout,
  toggleWorkoutSet,
  addWarmupSetsToWorkout,
  updateWorkoutExercise,
  updateWorkoutSet,
  recordRestTimerSample,
} from './workoutMutations';
import { exercisesWithAddedPrevious } from '../domain/workouts/nextSessionTargets';

const WorkoutContext = createContext<WorkoutContextValue | null>(null);
const ActiveWorkoutContext = createContext<Workout | null>(null);

export function WorkoutProvider({ children }: ChildrenProps) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<Workout[]>([]);
  const [ready, setReady] = useState(false);
  const activeSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextActivePersistenceRef = React.useRef(false);
  const activeHydratedRef = React.useRef(false);
  const activeWorkoutRef = React.useRef<Workout | null>(null);
  activeWorkoutRef.current = activeWorkout;
  // Refs let the action creators stay referentially stable (empty deps) while
  // still reading the latest state, so a per-keystroke activeWorkout change never
  // changes the identity of the shared actions/data context value.
  const completedWorkoutsRef = React.useRef<Workout[]>(completedWorkouts);
  completedWorkoutsRef.current = completedWorkouts;
  // Coalescing writer. While one full-workout write is in flight, further save
  // requests only replace the pending snapshot, so rapid input persists just the
  // newest state instead of queueing every intermediate full-workout write.
  const pendingActiveRef = React.useRef<{ value: Workout | null } | null>(null);
  const activeWriteInFlightRef = React.useRef<Promise<void> | null>(null);
  const drainActiveWrites = useCallback((): Promise<void> => {
    if (activeWriteInFlightRef.current) return activeWriteInFlightRef.current;
    const run = async (): Promise<void> => {
      while (pendingActiveRef.current) {
        const next = pendingActiveRef.current;
        pendingActiveRef.current = null;
        await saveActiveWorkout(next.value).catch(() => undefined);
      }
    };
    const promise = run().finally(() => {
      activeWriteInFlightRef.current = null;
    });
    activeWriteInFlightRef.current = promise;
    return promise;
  }, []);
  const queueActiveSave = useCallback((workout: Workout | null): Promise<void> => {
    pendingActiveRef.current = { value: workout };
    return drainActiveWrites();
  }, [drainActiveWrites]);
  const persistActiveWorkoutNow = useCallback(
    (workout: Workout | null): Promise<void> => {
      if (activeSaveTimerRef.current) {
        clearTimeout(activeSaveTimerRef.current);
        activeSaveTimerRef.current = null;
      }
      skipNextActivePersistenceRef.current = true;
      return queueActiveSave(workout);
    },
    [queueActiveSave],
  );
  const reload = useCallback(async (): Promise<void> => {
    if (activeSaveTimerRef.current) {
      clearTimeout(activeSaveTimerRef.current);
      activeSaveTimerRef.current = null;
    }
    const state = await loadWorkoutState();
    skipNextActivePersistenceRef.current = true;
    setActiveWorkout(state.activeWorkout);
    setCompletedWorkouts(state.completedWorkouts);
    setReady(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    loadWorkoutState()
      .then((state) => {
        if (!mounted) return;
        setActiveWorkout(state.activeWorkout);
        setCompletedWorkouts(state.completedWorkouts);
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    if (!activeHydratedRef.current) {
      activeHydratedRef.current = true;
      return undefined;
    }
    if (activeSaveTimerRef.current) clearTimeout(activeSaveTimerRef.current);
    if (skipNextActivePersistenceRef.current) {
      skipNextActivePersistenceRef.current = false;
      return undefined;
    }
    if (!activeWorkout) {
      queueActiveSave(null);
      return undefined;
    }
    activeSaveTimerRef.current = setTimeout(() => {
      queueActiveSave(activeWorkout);
      activeSaveTimerRef.current = null;
    }, 300);
    return () => {
      if (activeSaveTimerRef.current) clearTimeout(activeSaveTimerRef.current);
    };
  }, [activeWorkout, queueActiveSave, ready]);

  // Flush the latest active-workout snapshot before the OS can suspend us, so a
  // pending debounced edit is never lost when the app is backgrounded.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      if (!activeSaveTimerRef.current) return;
      clearTimeout(activeSaveTimerRef.current);
      activeSaveTimerRef.current = null;
      void queueActiveSave(activeWorkoutRef.current);
    });
    return () => subscription.remove();
  }, [queueActiveSave]);

  const startWorkout = useCallback(
    (options: StartWorkoutOptions = {}): Workout => {
      if (activeWorkoutRef.current) return activeWorkoutRef.current;
      const workout = createWorkout(options);
      // Starting is a durable state transition, not an ordinary debounced edit.
      setActiveWorkout(workout);
      void persistActiveWorkoutNow(workout);
      return workout;
    },
    [persistActiveWorkoutNow],
  );

  // Fill "previous" for the exercises just appended, from prior history — so an
  // ad-hoc add shows last-session values like a routine-started exercise does.
  const withAddedPrevious = (previous: Workout | null, next: Workout | null): Workout | null => {
    if (!next) return next;
    const added = next.exercises.length - (previous?.exercises.length ?? 0);
    if (added <= 0) return next;
    const head = next.exercises.slice(0, next.exercises.length - added);
    const filled = exercisesWithAddedPrevious(next.exercises.slice(-added), completedWorkoutsRef.current);
    return { ...next, exercises: [...head, ...filled] };
  };

  const addExercise = useCallback((exercise: WorkoutExerciseInput | string): void => {
    if (!(typeof exercise === 'string' ? exercise : exercise.name).trim()) return;
    setActiveWorkout((current) => withAddedPrevious(current, addExerciseToWorkout(current, exercise)));
  }, []);

  const addExercises = useCallback((exercises: readonly WorkoutExerciseInput[]): void => {
    if (!exercises.length) return;
    setActiveWorkout((current) => withAddedPrevious(current, addExercisesToWorkout(current, exercises)));
  }, []);

  const addSet = useCallback((exerciseId: string): void => {
    setActiveWorkout((current) => addSetToWorkout(current, exerciseId));
  }, []);

  const removeSet = useCallback((exerciseId: string, setId: string): void => {
    setActiveWorkout((current) => removeSetFromWorkout(current, exerciseId, setId));
  }, []);

  const removeExercise = useCallback((exerciseId: string): void => {
    setActiveWorkout((current) => removeExerciseFromWorkout(current, exerciseId));
  }, []);

  const updateExercise = useCallback((exerciseId: string, changes: import('../types').WorkoutExerciseChanges): void => {
    setActiveWorkout((current) => updateWorkoutExercise(current, exerciseId, changes));
  }, []);

  const addWarmupSets = useCallback((exerciseId: string, sets: readonly { weight: string; reps: string }[]): void => {
    if (!sets.length) return;
    setActiveWorkout((current) => addWarmupSetsToWorkout(current, exerciseId, sets));
  }, []);

  const updateSet = useCallback(
    (exerciseId: string, setId: string, changes: WorkoutSetChanges): void => {
      setActiveWorkout((current) => updateWorkoutSet(current, exerciseId, setId, changes));
    },
    [],
  );

  const toggleSet = useCallback((exerciseId: string, setId: string): void => {
    setActiveWorkout((current) => toggleWorkoutSet(current, exerciseId, setId));
  }, []);

  const updateActiveWorkout = useCallback((update: (workout: Workout) => Workout): void => {
    setActiveWorkout((current) => current ? update(current) : current);
  }, []);

  const cancelWorkout = useCallback((): void => {
    persistActiveWorkoutNow(null);
    setActiveWorkout(null);
  }, [persistActiveWorkoutNow]);

  const finishWorkout = useCallback((): Workout | null => {
    const current = activeWorkoutRef.current;
    if (!current) return null;
    // Recompute the rest-average from the final completed sets so an uncheck or a
    // set/exercise removal after the last completion can't leave a stale stat.
    const finished = recordRestTimerSample({
      ...current,
      completedAt: Date.now(),
      durationSeconds: current.automaticTimeTracking === false
        ? Math.max(1, current.durationSeconds ?? 0)
        : Math.max(1, Math.round((Date.now() - current.startedAt) / 1000)),
    }, 0);
    // Finishing appends one row to the archive rather than rewriting all of it.
    void appendCompletedWorkout(finished);
    setCompletedWorkouts((workouts) => [finished, ...workouts]);
    persistActiveWorkoutNow(null);
    setActiveWorkout(null);
    return finished;
  }, [persistActiveWorkoutNow]);

  const createCompletedWorkout = useCallback(async (workout: Workout): Promise<void> => {
    await appendCompletedWorkout(workout);
    setCompletedWorkouts((current) => [workout, ...current]);
  }, []);

  const updateCompletedWorkout = useCallback(
    async (workoutId: string, update: (workout: Workout) => Workout): Promise<void> => {
      const existing = completedWorkoutsRef.current.find((workout) => workout.id === workoutId);
      if (!existing) return;
      const updated = update(existing);
      setCompletedWorkouts((current) =>
        current.map((workout) => (workout.id === workoutId ? updated : workout)),
      );
      // A History editor navigates away directly after Save. Persist this single
      // record before navigation so a provider remount cannot restore the prior
      // snapshot — and without rewriting the rest of the archive.
      await updateCompletedWorkoutRecord(updated);
    },
    [],
  );

  const deleteCompletedWorkout = useCallback((workoutId: string): void => {
    setCompletedWorkouts((current) => current.filter((workout) => workout.id !== workoutId));
    void deleteCompletedWorkoutRecord(workoutId);
  }, []);

  // The live workout is delivered through its own context so that a per-keystroke
  // edit only re-renders the screen actually showing it (ActiveWorkoutScreen).
  // Everything else — the archive, ready flag, stable actions, and the workout's
  // identity/start-time scalars — lives in a value whose identity does NOT change
  // on a keystroke, so idle tabs and rows stop re-rendering during set entry.
  const activeWorkoutId = activeWorkout?.id ?? null;
  const activeWorkoutStartedAt = activeWorkout?.startedAt ?? null;
  const activeWorkoutSetCount = activeWorkout
    ? activeWorkout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
    : 0;
  const value = useMemo(
    () => ({
      ready,
      reload,
      activeWorkoutId,
      activeWorkoutStartedAt,
      activeWorkoutSetCount,
      completedWorkouts,
      startWorkout,
      addExercise,
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
      createCompletedWorkout,
      deleteCompletedWorkout,
      updateCompletedWorkout,
    }),
    [
      ready,
      reload,
      activeWorkoutId,
      activeWorkoutStartedAt,
      activeWorkoutSetCount,
      completedWorkouts,
      startWorkout,
      addExercise,
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
      createCompletedWorkout,
      deleteCompletedWorkout,
      updateCompletedWorkout,
    ],
  );
  return (
    <WorkoutContext.Provider value={value}>
      <ActiveWorkoutContext.Provider value={activeWorkout}>{children}</ActiveWorkoutContext.Provider>
    </WorkoutContext.Provider>
  );
}

export function useWorkouts(): WorkoutContextValue {
  const context = useContext(WorkoutContext);
  if (!context) throw new Error('useWorkouts must be used inside WorkoutProvider');
  return context;
}

/**
 * The live active workout. Isolated from useWorkouts so that consumers reading
 * only the archive/actions never re-render while a set is being typed.
 */
export function useActiveWorkout(): Workout | null {
  return useContext(ActiveWorkoutContext);
}
