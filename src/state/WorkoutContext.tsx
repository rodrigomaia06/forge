import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  appendCompletedWorkout,
  loadWorkoutState,
  saveActiveWorkout,
  saveCompletedWorkouts,
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
  updateWorkoutSet,
} from './workoutMutations';

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: ChildrenProps) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<Workout[]>([]);
  const [ready, setReady] = useState(false);
  const activeSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const skipNextActivePersistenceRef = React.useRef(false);
  const activeHydratedRef = React.useRef(false);
  const completedHydratedRef = React.useRef(false);
  const skipNextCompletedPersistenceRef = React.useRef(false);
  const queueActiveSave = useCallback((workout: Workout | null): Promise<void> => {
    activeWriteQueueRef.current = activeWriteQueueRef.current
      .catch(() => undefined)
      .then(() => saveActiveWorkout(workout));
    return activeWriteQueueRef.current;
  }, []);
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

  useEffect(() => {
    if (!ready) return;
    if (!completedHydratedRef.current) {
      completedHydratedRef.current = true;
      return;
    }
    if (skipNextCompletedPersistenceRef.current) {
      skipNextCompletedPersistenceRef.current = false;
      return;
    }
    void saveCompletedWorkouts(completedWorkouts);
  }, [completedWorkouts, ready]);

  const startWorkout = useCallback(
    (options: StartWorkoutOptions = {}): Workout => {
      if (activeWorkout) return activeWorkout;
      const workout = createWorkout(options);
      // Starting is a durable state transition, not an ordinary debounced edit.
      setActiveWorkout(workout);
      void persistActiveWorkoutNow(workout);
      return workout;
    },
    [activeWorkout, persistActiveWorkoutNow],
  );

  const addExercise = useCallback((exercise: WorkoutExerciseInput | string): void => {
    if (!(typeof exercise === 'string' ? exercise : exercise.name).trim()) return;
    setActiveWorkout((current) => addExerciseToWorkout(current, exercise));
  }, []);

  const addExercises = useCallback((exercises: readonly WorkoutExerciseInput[]): void => {
    if (!exercises.length) return;
    setActiveWorkout((current) => addExercisesToWorkout(current, exercises));
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
    if (!activeWorkout) return null;
    const finished = {
      ...activeWorkout,
      completedAt: Date.now(),
      durationSeconds: activeWorkout.automaticTimeTracking === false
        ? Math.max(1, activeWorkout.durationSeconds ?? 0)
        : Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 1000)),
    };
    setCompletedWorkouts((current) => [finished, ...current]);
    persistActiveWorkoutNow(null);
    setActiveWorkout(null);
    return finished;
  }, [activeWorkout, persistActiveWorkoutNow]);

  const createCompletedWorkout = useCallback(async (workout: Workout): Promise<void> => {
    await appendCompletedWorkout(workout);
    skipNextCompletedPersistenceRef.current = true;
    setCompletedWorkouts((current) => [workout, ...current]);
  }, []);

  const updateCompletedWorkout = useCallback(
    (workoutId: string, update: (workout: Workout) => Workout): void => {
      setCompletedWorkouts((current) => {
        const next = current.map((workout) =>
          workout.id === workoutId ? update(workout) : workout,
        );
        void saveCompletedWorkouts(next);
        return next;
      });
    },
    [],
  );

  const deleteCompletedWorkout = useCallback((workoutId: string): void => {
    setCompletedWorkouts((current) => {
      const next = current.filter((workout) => workout.id !== workoutId);
      void saveCompletedWorkouts(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      activeWorkout,
      completedWorkouts,
      startWorkout,
      addExercise,
      addExercises,
      addSet,
      removeSet,
      removeExercise,
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
      activeWorkout,
      completedWorkouts,
      startWorkout,
      addExercise,
      addExercises,
      addSet,
      removeSet,
      removeExercise,
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
  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkouts(): WorkoutContextValue {
  const context = useContext(WorkoutContext);
  if (!context) throw new Error('useWorkouts must be used inside WorkoutProvider');
  return context;
}
