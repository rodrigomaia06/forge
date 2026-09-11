import type { ExerciseCatalogItem } from './exerciseCatalog';
import { database, withDatabaseTransaction } from './database';

export async function loadCustomExercises(): Promise<ExerciseCatalogItem[]> {
  const rows = await (await database()).getAllAsync<{ value_json: string }>('SELECT value_json FROM custom_exercises WHERE archived = 0');
  if (!rows.length) return [];
  try {
    const parsed = rows.map((row) => JSON.parse(row.value_json)) as unknown[];
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const exercise = item as Partial<ExerciseCatalogItem>;
          if (typeof exercise.id !== 'string' || typeof exercise.name !== 'string' || typeof exercise.group !== 'string') return [];
          return [{
            id: exercise.id,
            name: exercise.name,
            group: exercise.group,
            variation: typeof exercise.variation === 'string' ? exercise.variation : undefined,
            equipment: typeof exercise.equipment === 'string' ? exercise.equipment : 'Bodyweight',
            category: typeof exercise.category === 'string' ? exercise.category : 'Accessories',
            aliases: Array.isArray(exercise.aliases) ? exercise.aliases.filter((value): value is string => typeof value === 'string') : [],
            workoutTypeIds: Array.isArray(exercise.workoutTypeIds) ? exercise.workoutTypeIds.filter((value): value is string => typeof value === 'string') : ['strength'],
            primaryMuscle: typeof exercise.primaryMuscle === 'string' ? exercise.primaryMuscle : (typeof exercise.category === 'string' ? exercise.category : 'Accessories'),
            secondaryMuscles: Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles.filter((value): value is string => typeof value === 'string') : [],
            restSeconds: typeof exercise.restSeconds === 'number' && exercise.restSeconds >= 0 ? exercise.restSeconds : undefined,
          } satisfies ExerciseCatalogItem];
        })
      : [];
  } catch { return []; }
}

export async function saveCustomExercises(exercises: ExerciseCatalogItem[]): Promise<void> {
  await withDatabaseTransaction(async (db) => {
    await db.runAsync('DELETE FROM custom_exercises');
    for (const exercise of exercises) await db.runAsync('INSERT INTO custom_exercises (id, archived, value_json) VALUES (?, 0, ?)', exercise.id, JSON.stringify(exercise));
  });
}
