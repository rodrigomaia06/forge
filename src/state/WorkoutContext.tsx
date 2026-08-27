import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  loadWorkoutState,
  saveActiveWorkout,
  saveCompletedWorkouts,
} from '../data/workoutRepository';
import type {
  ChildrenProps,
  StartWorkoutOptions,
  Workout,
  WorkoutContextValue,
  WorkoutSetChanges,
} from '../types';
import {
  addExerciseToWorkout,
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
  const queueActiveSave = useCallback((workout: Workout | null): void => {
    activeWriteQueueRef.current = activeWriteQueueRef.current
      .catch(() => undefined)
      .then(() => saveActiveWorkout(workout));
  }, []);
  const persistActiveWorkoutNow = useCallback(
    (workout: Workout | null): void => {
      if (activeSaveTimerRef.current) {
        clearTimeout(activeSaveTimerRef.current);
        activeSaveTimerRef.current = null;
      }
      skipNextActivePersistenceRef.current = true;
      queueActiveSave(workout);
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
    if (ready) saveCompletedWorkouts(completedWorkouts);
  }, [completedWorkouts, ready]);

  const startWorkout = useCallback(
    (options: StartWorkoutOptions = {}): Workout => {
      if (activeWorkout) return activeWorkout;
      const workout = createWorkout(options);
      setActiveWorkout(workout);
      return workout;
    },
    [activeWorkout],
  );

  const addExercise = useCallback((name: string): void => {
    if (!name.trim()) return;
    setActiveWorkout((current) => addExerciseToWorkout(current, name));
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

  const cancelWorkout = useCallback((): void => {
    persistActiveWorkoutNow(null);
    setActiveWorkout(null);
  }, [persistActiveWorkoutNow]);

  const finishWorkout = useCallback((): Workout | null => {
    if (!activeWorkout) return null;
    const finished = {
      ...activeWorkout,
      completedAt: Date.now(),
      durationSeconds: Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 1000)),
    };
    setCompletedWorkouts((current) => [finished, ...current]);
    persistActiveWorkoutNow(null);
    setActiveWorkout(null);
    return finished;
  }, [activeWorkout, persistActiveWorkoutNow]);

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
      addSet,
      removeSet,
      removeExercise,
      updateSet,
      toggleSet,
      cancelWorkout,
      finishWorkout,
      deleteCompletedWorkout,
      updateCompletedWorkout,
    }),
    [
      ready,
      activeWorkout,
      completedWorkouts,
      startWorkout,
      addExercise,
      addSet,
      removeSet,
      removeExercise,
      updateSet,
      toggleSet,
      cancelWorkout,
      finishWorkout,
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
