import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Workout, WorkoutState } from '../types';

const ACTIVE_KEY = '@forge/active-workout';
const COMPLETED_KEY = '@forge/completed-workouts';
const parse = <T,>(value: string | null, fallback: T): T => {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};

/** Browser persistence intentionally bypasses Expo SQLite's OPFS worker. */
export async function loadWorkoutState(): Promise<WorkoutState> {
  const [active, completed] = await AsyncStorage.multiGet([ACTIVE_KEY, COMPLETED_KEY]);
  return {
    activeWorkout: parse<Workout | null>(active[1], null),
    completedWorkouts: parse<Workout[]>(completed[1], []),
  };
}
export async function saveActiveWorkout(workout: Workout | null): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(workout));
}
export async function saveCompletedWorkouts(workouts: Workout[]): Promise<void> {
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(workouts));
}
export async function appendCompletedWorkout(workout: Workout): Promise<void> {
  const current = parse<Workout[]>(await AsyncStorage.getItem(COMPLETED_KEY), []);
  await saveCompletedWorkouts([workout, ...current]);
}
