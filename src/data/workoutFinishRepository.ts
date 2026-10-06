import type { FinishRoutineChoice, Workout } from '../types';
import { withDatabaseTransaction } from './database';
import { completedWorkoutUpsert } from './workoutRepository';
import { loadPlansState, writePlansState } from './plansRepository';
import { normalizePersistedWorkout } from './workoutNormalization';
import { finishRoutineState } from '../domain/workouts/finishWorkout';

export async function persistWorkoutFinish(
  workout: Workout,
  choice: FinishRoutineChoice,
): Promise<Workout> {
  let result = normalizePersistedWorkout(workout);
  await withDatabaseTransaction(async (db) => {
    const prior = await db.getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM workouts WHERE id = ? AND is_active = 0',
      workout.id,
    );
    if (prior) {
      result = normalizePersistedWorkout(JSON.parse(prior.value_json));
      return;
    }
    const state = await loadPlansState();
    const next = finishRoutineState(state, result, choice);
    if (next !== state) await writePlansState(db, next);
    await db.runAsync(
      completedWorkoutUpsert,
      result.id,
      result.completedAt,
      result.startedAt,
      JSON.stringify(result),
    );
  });
  return result;
}
