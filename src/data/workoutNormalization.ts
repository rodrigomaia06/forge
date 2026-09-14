import type { Workout } from '../types';
import { canonicalizeWorkout } from './exerciseCanonicalization';

/**
 * Older Forge records and interrupted manual imports can omit child arrays.
 * Normalize at the repository boundary so UI consumers always receive the
 * collection shape promised by Workout, without mutating the persisted row.
 */
export function normalizePersistedWorkout(workout: Workout): Workout {
  return canonicalizeWorkout({
    ...workout,
    exercises: Array.isArray(workout.exercises)
      ? workout.exercises.map((exercise) => ({
        ...exercise,
        sets: Array.isArray(exercise.sets) ? exercise.sets : [],
      }))
      : [],
  });
}
