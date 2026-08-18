import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_WORKOUT_KEY = '@forge/active-workout';
const COMPLETED_WORKOUTS_KEY = '@forge/completed-workouts';

export async function loadWorkoutState() {
  const [activeValue, completedValue] = await Promise.all([
    AsyncStorage.getItem(ACTIVE_WORKOUT_KEY),
    AsyncStorage.getItem(COMPLETED_WORKOUTS_KEY),
  ]);

  return {
    activeWorkout: activeValue ? JSON.parse(activeValue) : null,
    completedWorkouts: completedValue ? JSON.parse(completedValue) : [],
  };
}

export function saveActiveWorkout(workout) {
  return workout
    ? AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout))
    : AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
}

export function saveCompletedWorkouts(workouts) {
  return AsyncStorage.setItem(COMPLETED_WORKOUTS_KEY, JSON.stringify(workouts));
}
