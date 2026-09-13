import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Workout, WorkoutState } from '../types';
import { uniqueById } from './uniqueById';
import { normalizePersistedWorkout } from './workoutNormalization';

const ACTIVE_KEY = '@forge/active-workout';
const COMPLETED_KEY = '@forge/completed-workouts';
const parse = <T,>(value: string | null, fallback: T): T => {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const isWorkoutRecord = (value: unknown): value is Workout =>
  Boolean(value)
  && typeof value === 'object'
  && typeof (value as Partial<Workout>).id === 'string';

/** Browser persistence intentionally bypasses Expo SQLite's OPFS worker. */
export async function loadWorkoutState(): Promise<WorkoutState> {
  const [active, completed] = await AsyncStorage.multiGet([ACTIVE_KEY, COMPLETED_KEY]);
  const completedValue = parse<unknown>(completed[1], []);
  const completedWorkouts = uniqueById(
    (Array.isArray(completedValue) ? completedValue : [])
      .filter(isWorkoutRecord)
      .map(normalizePersistedWorkout),
  );
  const activeValue = parse<unknown>(active[1], null);
  const activeWorkout = isWorkoutRecord(activeValue) ? activeValue : null;
  return {
    activeWorkout: activeWorkout && !completedWorkouts.some((workout) => workout.id === activeWorkout.id)
      ? normalizePersistedWorkout(activeWorkout)
      : null,
    completedWorkouts,
  };
}
export async function saveActiveWorkout(workout: Workout | null): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(workout));
}
export async function saveCompletedWorkouts(workouts: Workout[]): Promise<void> {
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(uniqueById(workouts)));
}
export async function appendCompletedWorkout(workout: Workout): Promise<void> {
  const current = parse<Workout[]>(await AsyncStorage.getItem(COMPLETED_KEY), []);
  await saveCompletedWorkouts([workout, ...current.filter((item) => item.id !== workout.id)]);
}
