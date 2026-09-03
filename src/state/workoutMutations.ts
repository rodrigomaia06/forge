import type { StartWorkoutOptions, Workout, WorkoutSetChanges } from '../types';

export function makeWorkoutId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createWorkout(options: StartWorkoutOptions): Workout {
  return {
    id: makeWorkoutId('workout'),
    name: options.name || 'Workout',
    type: options.type || 'Strength',
    startedAt: Date.now(),
    completedAt: null,
    note: options.note || '',
    location: options.location,
    mood: options.mood,
    averageRestSeconds: options.averageRestSeconds,
    routineId: options.routineId,
    planId: options.planId,
    attributes: options.attributes,
    exercises: (options.exercises || []).map((exercise) => ({
      id: exercise.id || makeWorkoutId('exercise'),
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      note: exercise.note,
      supersetId: exercise.supersetId,
      sets: (exercise.sets || []).map((set) => ({
        id: set.id || makeWorkoutId('set'),
        weight: set.weight || '',
        reps: set.reps || '',
        previous: set.previous,
        targetWeight: set.targetWeight,
        targetReps: set.targetReps,
        completed: false,
      })),
    })),
  };
}

export function addExerciseToWorkout(workout: Workout | null, name: string): Workout | null {
  if (!workout || !name.trim()) return workout;
  return {
    ...workout,
    exercises: [
      ...workout.exercises,
      {
        id: makeWorkoutId('exercise'),
        name: name.trim(),
        sets: Array.from({ length: 3 }, () => ({
          id: makeWorkoutId('set'),
          weight: '',
          reps: '',
          completed: false,
        })),
      },
    ],
  };
}

export function addSetToWorkout(workout: Workout | null, exerciseId: string): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: [
              ...exercise.sets,
              { id: makeWorkoutId('set'), weight: '', reps: '', completed: false },
            ],
          }
        : exercise,
    ),
  };
}

export function removeSetFromWorkout(
  workout: Workout | null,
  exerciseId: string,
  setId: string,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises
      .map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      )
      .filter((exercise) => exercise.sets.length > 0),
  };
}

export function removeExerciseFromWorkout(
  workout: Workout | null,
  exerciseId: string,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId),
  };
}

export function updateWorkoutSet(
  workout: Workout | null,
  exerciseId: string,
  setId: string,
  changes: WorkoutSetChanges,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...changes } : set)),
          }
        : exercise,
    ),
  };
}

export function toggleWorkoutSet(
  workout: Workout | null,
  exerciseId: string,
  setId: string,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.id === setId ? { ...set, completed: !set.completed } : set,
            ),
          }
        : exercise,
    ),
  };
}
