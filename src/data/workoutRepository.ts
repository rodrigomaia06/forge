import type { Workout, WorkoutState } from '../types';
import { database, withDatabaseTransaction } from './database';

const completedWorkoutUpsert = `
  INSERT INTO workouts (id, is_active, completed_at, started_at, value_json)
  VALUES (?, 0, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    is_active = excluded.is_active,
    completed_at = excluded.completed_at,
    started_at = excluded.started_at,
    value_json = excluded.value_json
`;

export async function loadWorkoutState(): Promise<WorkoutState> {
  const db = await database();
  const rows = await db.getAllAsync<{ value_json: string; is_active: number }>('SELECT value_json, is_active FROM workouts ORDER BY completed_at DESC');
  const active = rows.find((row) => row.is_active === 1);
  return { activeWorkout: active ? JSON.parse(active.value_json) as Workout : null, completedWorkouts: rows.filter((row) => row.is_active === 0).map((row) => JSON.parse(row.value_json) as Workout) };
}

export async function saveActiveWorkout(workout: Workout | null): Promise<void> {
  await withDatabaseTransaction(async (db) => {
    await db.runAsync('DELETE FROM workouts WHERE is_active = 1');
    if (workout) await db.runAsync(`
      INSERT INTO workouts (id, is_active, completed_at, started_at, value_json)
      VALUES (?, 1, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        is_active = excluded.is_active,
        completed_at = excluded.completed_at,
        started_at = excluded.started_at,
        value_json = excluded.value_json
    `, workout.id, workout.startedAt, JSON.stringify(workout));
  });
}

export async function saveCompletedWorkouts(workouts: Workout[]): Promise<void> {
  await withDatabaseTransaction(async (db) => {
    await db.runAsync('DELETE FROM workouts WHERE is_active = 0');
    for (const workout of workouts) {
      await db.runAsync(
        completedWorkoutUpsert,
        workout.id,
        workout.completedAt,
        workout.startedAt,
        JSON.stringify(workout),
      );
    }
  });
}

/** Adds one completed workout without replacing the existing history archive. */
export async function appendCompletedWorkout(workout: Workout): Promise<void> {
  await withDatabaseTransaction(async (db) => {
    await db.runAsync(
      completedWorkoutUpsert,
      workout.id,
      workout.completedAt,
      workout.startedAt,
      JSON.stringify(workout),
    );
  });
}
