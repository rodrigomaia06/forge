import { database, withDatabaseTransaction } from './database';
import { exerciseCatalog } from './exerciseCatalog';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import type { Workout } from '../types';
import { completedWorkoutUpsert } from './workoutRepository';
import { normalizePersistedWorkout } from './workoutNormalization';
import { prepareCsvCommit } from './csvImport/review';
import type { CsvImportRequest, CsvImportResult, CsvMappings } from './csvImport/types';

const MAPPINGS_KEY = 'csv-exercise-mappings-v1';
export async function loadCsvMappings(): Promise<CsvMappings> {
  const row = await (
    await database()
  ).getFirstAsync<{ value: string }>('SELECT value FROM forge_meta WHERE key = ?', MAPPINGS_KEY);
  return parseCsvMappings(row?.value ?? null);
}
export function parseCsvMappings(value: string | null): CsvMappings {
  if (value === null) return {};
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.values(parsed).some((id) => typeof id !== 'string')
  )
    throw new Error('Saved import exercise matches could not be read.');
  return parsed as CsvMappings;
}
export async function commitCsvImport(request: CsvImportRequest): Promise<CsvImportResult> {
  let result: CsvImportResult | undefined;
  await withDatabaseTransaction(async (db) => {
    const workoutRows = await db.getAllAsync<{ value_json: string }>(
      'SELECT value_json FROM workouts WHERE is_active = 0',
    );
    const customRows = await db.getAllAsync<{ value_json: string }>(
      'SELECT value_json FROM custom_exercises WHERE archived = 0',
    );
    const custom = customRows.map((row) => JSON.parse(row.value_json) as ExerciseCatalogItem);
    const workouts = workoutRows.map((row) =>
      normalizePersistedWorkout(JSON.parse(row.value_json) as Workout),
    );
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM forge_meta WHERE key = ?',
      MAPPINGS_KEY,
    );
    const next = prepareCsvCommit(request, workouts, custom, [...exerciseCatalog, ...custom]);
    const active = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM workouts WHERE is_active = 1',
    );
    if (next.writes.some((workout) => active.some((entry) => entry.id === workout.id)))
      throw new Error(
        'An imported session conflicts with the active workout. No records were saved.',
      );
    for (const exercise of next.additions)
      await db.runAsync(
        'INSERT INTO custom_exercises (id, archived, value_json) VALUES (?, 0, ?)',
        exercise.id,
        JSON.stringify(exercise),
      );
    for (const workout of next.writes)
      await db.runAsync(
        completedWorkoutUpsert,
        workout.id,
        workout.completedAt,
        workout.startedAt,
        JSON.stringify(workout),
      );
    await db.runAsync(
      'INSERT OR REPLACE INTO forge_meta (key, value) VALUES (?, ?)',
      MAPPINGS_KEY,
      JSON.stringify({ ...parseCsvMappings(row?.value ?? null), ...next.mappings }),
    );
    result = next.result;
  });
  return result!;
}
