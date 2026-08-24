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
    if (ready) saveActiveWorkout(activeWorkout);
  }, [activeWorkout, ready]);

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

  const finishWorkout = useCallback((): Workout | null => {
    if (!activeWorkout) return null;
    const finished = {
      ...activeWorkout,
      completedAt: Date.now(),
      durationSeconds: Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 1000)),
    };
    setCompletedWorkouts((current) => [finished, ...current]);
    setActiveWorkout(null);
    return finished;
  }, [activeWorkout]);

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
      finishWorkout,
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
      finishWorkout,
    ],
  );
  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkouts(): WorkoutContextValue {
  const context = useContext(WorkoutContext);
  if (!context) throw new Error('useWorkouts must be used inside WorkoutProvider');
  return context;
}
