import type { FinishRoutineChoice, PlansState, Workout } from '../types';
import { normalizePersistedWorkout } from './workoutNormalization';
import { finishRoutineState } from '../domain/workouts/finishWorkout';
export interface FinishStorage {
  multiGet(keys: string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(values: [string, string][]): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const keys = ['@forge/plans-v1', '@forge/completed-workouts', '@forge/active-workout'];
/** Roll back the whole write if browser storage rejects any part of the save. */
export async function writeWebWorkoutFinish(
  storage: FinishStorage,
  workout: Workout,
  choice: FinishRoutineChoice,
): Promise<Workout> {
  const before = await storage.multiGet(keys);
  const state: PlansState = before[0][1]
    ? JSON.parse(before[0][1])
    : { plans: [], standaloneRoutines: [] };
  const history: Workout[] = before[1][1] ? JSON.parse(before[1][1]) : [];
  const prior = history.find((entry) => entry.id === workout.id);
  if (prior) return normalizePersistedWorkout(prior);
  const finished = normalizePersistedWorkout(workout);
  const next = finishRoutineState(state, finished, choice);
  try {
    const writes: [string, string][] = [
      [keys[1], JSON.stringify([finished, ...history])],
      [keys[2], 'null'],
    ];
    if (next !== state) writes.unshift([keys[0], JSON.stringify(next)]);
    await storage.multiSet(writes);
  } catch (error) {
    for (const [key, value] of before) {
      if (value === null) await storage.removeItem(key);
      else await storage.setItem(key, value);
    }
    throw error;
  }
  return finished;
}
