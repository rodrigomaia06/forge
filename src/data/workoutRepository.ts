import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Workout, WorkoutState } from '../types';

const ACTIVE_WORKOUT_KEY = '@forge/active-workout';
const COMPLETED_WORKOUTS_KEY = '@forge/completed-workouts';

export async function loadWorkoutState(): Promise<WorkoutState> {
  const [activeValue, completedValue] = await Promise.all([
    AsyncStorage.getItem(ACTIVE_WORKOUT_KEY),
    AsyncStorage.getItem(COMPLETED_WORKOUTS_KEY),
  ]);

  return {
    activeWorkout: activeValue ? JSON.parse(activeValue) : null,
    completedWorkouts: completedValue ? JSON.parse(completedValue) : [],
  };
}

export function saveActiveWorkout(workout: Workout | null): Promise<void> {
  return workout
    ? AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout))
    : AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
}

export function saveCompletedWorkouts(workouts: Workout[]): Promise<void> {
  return AsyncStorage.setItem(COMPLETED_WORKOUTS_KEY, JSON.stringify(workouts));
}
