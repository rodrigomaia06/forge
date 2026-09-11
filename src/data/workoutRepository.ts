import type { Workout, WorkoutState } from '../types';
import { database } from './database';

export async function loadWorkoutState(): Promise<WorkoutState> {
  const db = await database();
  const rows = await db.getAllAsync<{ value_json: string; is_active: number }>('SELECT value_json, is_active FROM workouts ORDER BY completed_at DESC');
  const active = rows.find((row) => row.is_active === 1);
  return { activeWorkout: active ? JSON.parse(active.value_json) as Workout : null, completedWorkouts: rows.filter((row) => row.is_active === 0).map((row) => JSON.parse(row.value_json) as Workout) };
}

export async function saveActiveWorkout(workout: Workout | null): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workouts WHERE is_active = 1');
    if (workout) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 1, NULL, ?, ?)', workout.id, workout.startedAt, JSON.stringify(workout));
  });
}

export async function saveCompletedWorkouts(workouts: Workout[]): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workouts WHERE is_active = 0');
    for (const workout of workouts) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 0, ?, ?, ?)', workout.id, workout.completedAt, workout.startedAt, JSON.stringify(workout));
  });
}
