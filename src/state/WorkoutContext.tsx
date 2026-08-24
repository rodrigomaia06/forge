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

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

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
      const plannedExercises = options.exercises || [];
      const workout = {
        id: makeId('workout'),
        name: options.name || 'Workout',
        type: options.type || 'Strength',
        startedAt: Date.now(),
        completedAt: null,
        exercises: plannedExercises.map((exercise) => ({
          id: exercise.id || makeId('exercise'),
          name: exercise.name,
          sets: (exercise.sets || []).map((set) => ({
            id: set.id || makeId('set'),
            weight: set.weight || '',
            reps: set.reps || '',
            previous: set.previous,
            targetReps: set.targetReps,
            completed: false,
          })),
        })),
      };
      setActiveWorkout(workout);
      return workout;
    },
    [activeWorkout],
  );

  const addExercise = useCallback((name: string): void => {
    if (!name.trim()) return;
    setActiveWorkout(
      (current) =>
        current && {
          ...current,
          exercises: [
            ...current.exercises,
            {
              id: makeId('exercise'),
              name: name.trim(),
              sets: [{ id: makeId('set'), weight: '', reps: '', completed: false }],
            },
          ],
        },
    );
  }, []);

  const addSet = useCallback((exerciseId: string): void => {
    setActiveWorkout(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  sets: [
                    ...exercise.sets,
                    { id: makeId('set'), weight: '', reps: '', completed: false },
                  ],
                }
              : exercise,
          ),
        },
    );
  }, []);

  const removeSet = useCallback((exerciseId: string, setId: string): void => {
    setActiveWorkout(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
              : exercise,
          ),
        },
    );
  }, []);

  const removeExercise = useCallback((exerciseId: string): void => {
    setActiveWorkout(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId),
        },
    );
  }, []);

  const updateSet = useCallback(
    (exerciseId: string, setId: string, changes: WorkoutSetChanges): void => {
      setActiveWorkout(
        (current) =>
          current && {
            ...current,
            exercises: current.exercises.map((exercise) =>
              exercise.id === exerciseId
                ? {
                    ...exercise,
                    sets: exercise.sets.map((set) =>
                      set.id === setId ? { ...set, ...changes } : set,
                    ),
                  }
                : exercise,
            ),
          },
      );
    },
    [],
  );

  const toggleSet = useCallback((exerciseId: string, setId: string): void => {
    setActiveWorkout(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  sets: exercise.sets.map((set) =>
                    set.id === setId ? { ...set, completed: !set.completed } : set,
                  ),
                }
              : exercise,
          ),
        },
    );
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
