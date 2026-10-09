import type { CsvImportRequest } from './types';
import type { ExerciseCatalogItem } from '../exerciseCatalog';
import type { Workout } from '../../types';
import { prepareCsvCommit } from './review';

export interface CsvStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const JOURNAL = '@forge/csv-import-recovery-v1';
const KEYS = [
  '@forge/completed-workouts',
  '@forge/custom-exercises',
  '@forge/csv-exercise-mappings-v1',
];
export function parseCsvMappings(value: string | null): Record<string, string> {
  if (value === null) return {};
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.values(parsed).some((id) => typeof id !== 'string')
  )
    throw new Error('Saved import exercise matches could not be read.');
  return parsed as Record<string, string>;
}
export async function recoverCsvImport(storage: CsvStorage): Promise<void> {
  const value = await storage.getItem(JOURNAL);
  if (value === null) return;
  const before: unknown = JSON.parse(value);
  if (
    !Array.isArray(before) ||
    before.length !== KEYS.length ||
    before.some(
      (entry, index) =>
        !Array.isArray(entry) ||
        entry[0] !== KEYS[index] ||
        (entry[1] !== null && typeof entry[1] !== 'string'),
    )
  )
    throw new Error(
      'The interrupted CSV import could not be recovered. Saved data has not been changed.',
    );
  for (const [key, original] of before as [string, string | null][]) {
    if (original === null) await storage.removeItem(key);
    else await storage.setItem(key, original);
  }
  await storage.removeItem(JOURNAL);
}
function records<T extends { id: string }>(value: string | null, label: string): T[] {
  const parsed: unknown = value === null ? [] : JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((entry) => !entry || typeof entry.id !== 'string'))
    throw new Error(`Saved ${label} could not be read. No records were imported.`);
  return parsed as T[];
}
/** The journal is removed last; interrupted multi-key writes restore their originals on restart. */
export async function writeCsvImport(
  storage: CsvStorage,
  request: CsvImportRequest,
  catalog: ExerciseCatalogItem[],
) {
  if (request.draft.routines?.length)
    throw new Error('Strive routine imports require the iOS or Android app.');
  await recoverCsvImport(storage);
  const before = await Promise.all(
    KEYS.map(async (key): Promise<[string, string | null]> => [key, await storage.getItem(key)]),
  );
  const workouts = records<Workout>(before[0][1], 'workouts');
  const custom = records<ExerciseCatalogItem>(before[1][1], 'custom exercises');
  const next = prepareCsvCommit(request, workouts, custom, [...catalog, ...custom]);
  const active = await storage.getItem('@forge/active-workout');
  if (active && next.writes.some((workout) => workout.id === JSON.parse(active)?.id))
    throw new Error(
      'An imported session conflicts with the active workout. No records were saved.',
    );
  const values = [
    JSON.stringify(next.workouts),
    JSON.stringify(next.customExercises),
    JSON.stringify({ ...parseCsvMappings(before[2][1]), ...next.mappings }),
  ];
  await storage.setItem(JOURNAL, JSON.stringify(before));
  try {
    for (let index = 0; index < KEYS.length; index++)
      await storage.setItem(KEYS[index], values[index]);
    await storage.removeItem(JOURNAL);
  } catch (error) {
    try {
      await recoverCsvImport(storage);
    } catch {
      throw new Error(
        'Import was interrupted. Your review is kept; retry to recover the previous data before importing.',
      );
    }
    throw error;
  }
  return next.result;
}
