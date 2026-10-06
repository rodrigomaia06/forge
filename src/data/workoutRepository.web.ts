import { queueWebWrite } from './webWriteQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Workout, WorkoutState } from '../types';
import { uniqueById } from './uniqueById';
import { normalizePersistedWorkout } from './workoutNormalization';

const ACTIVE_KEY = '@forge/active-workout';
const COMPLETED_KEY = '@forge/completed-workouts';
const parse = <T>(value: string | null, fallback: T): T => {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};
const isWorkoutRecord = (value: unknown): value is Workout =>
  Boolean(value) && typeof value === 'object' && typeof (value as Partial<Workout>).id === 'string';

/** Browser persistence intentionally bypasses Expo SQLite's OPFS worker. */
export async function loadWorkoutState(): Promise<WorkoutState> {
  return queueWebWrite(async () => {
    const [active, completed] = await AsyncStorage.multiGet([ACTIVE_KEY, COMPLETED_KEY]);
    const completedValue = parse<unknown>(completed[1], []);
    const completedWorkouts = uniqueById(
      (Array.isArray(completedValue) ? completedValue : [])
        .filter(isWorkoutRecord)
        .map(normalizePersistedWorkout),
    );
    const activeValue = parse<unknown>(active[1], null);
    const activeWorkout = isWorkoutRecord(activeValue) ? activeValue : null;
    const canonical = {
      activeWorkout:
        activeWorkout && !completedWorkouts.some((workout) => workout.id === activeWorkout.id)
          ? normalizePersistedWorkout(activeWorkout)
          : null,
      completedWorkouts,
    };
    if (canonical.activeWorkout && JSON.stringify(canonical.activeWorkout) !== active[1]) {
      await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(canonical.activeWorkout));
    }
    if (JSON.stringify(canonical.completedWorkouts) !== completed[1]) {
      await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(canonical.completedWorkouts));
    }
    return canonical;
  });
}
export async function saveActiveWorkout(workout: Workout | null): Promise<void> {
  await queueWebWrite(() =>
    AsyncStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify(workout ? normalizePersistedWorkout(workout) : null),
    ),
  );
}
// The completed archive is one AsyncStorage blob, so every write (full replace or
// an incremental read-modify-write) must be serialized — otherwise two operations
// issued close together (e.g. finishing then deleting) both read the same blob and
// the last write silently drops the other. Native gets this ordering for free from
// SQLite; here a single in-flight promise chain provides it.
async function writeCompleted(workouts: Workout[]): Promise<void> {
  await AsyncStorage.setItem(
    COMPLETED_KEY,
    JSON.stringify(uniqueById(workouts.map(normalizePersistedWorkout))),
  );
}
export function saveCompletedWorkouts(workouts: Workout[]): Promise<void> {
  return queueWebWrite(() => writeCompleted(workouts));
}
export function appendCompletedWorkout(workout: Workout): Promise<void> {
  return queueWebWrite(async () => {
    const current = parse<Workout[]>(await AsyncStorage.getItem(COMPLETED_KEY), []);
    await writeCompleted([workout, ...current.filter((item) => item.id !== workout.id)]);
  });
}
// A read-modify-write of the single archive key that preserves order for edits.
export function updateCompletedWorkoutRecord(workout: Workout): Promise<void> {
  return queueWebWrite(async () => {
    const current = parse<Workout[]>(await AsyncStorage.getItem(COMPLETED_KEY), []);
    const next = current.some((item) => item.id === workout.id)
      ? current.map((item) => (item.id === workout.id ? workout : item))
      : [workout, ...current];
    await writeCompleted(next);
  });
}
export function deleteCompletedWorkoutRecord(workoutId: string): Promise<void> {
  return queueWebWrite(async () => {
    const current = parse<Workout[]>(await AsyncStorage.getItem(COMPLETED_KEY), []);
    await writeCompleted(current.filter((item) => item.id !== workoutId));
  });
}
