import type { ExerciseCatalogItem } from './exerciseCatalog';
import { database, withDatabaseTransaction } from './database';
import { uniqueById } from './uniqueById';
import type { ExerciseVariationFacets, TrackingType } from '../types';

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
          const equipmentIds = Array.isArray(exercise.equipmentIds)
            ? exercise.equipmentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            : (typeof exercise.equipment === 'string' ? exercise.equipment.split('&').map((value) => value.trim()).filter(Boolean) : ['Bodyweight']);
          const equipment = equipmentIds.join(' & ') || 'Bodyweight';
          return [{
            id: exercise.id,
            name: exercise.name,
            familyId: typeof exercise.familyId === 'string' ? exercise.familyId : undefined,
            group: exercise.group,
            variation: typeof exercise.variation === 'string' ? exercise.variation : undefined,
            variationFacets: variationFacets(exercise.variationFacets),
            equipment,
            equipmentIds,
            primaryEquipment: typeof exercise.primaryEquipment === 'string' && equipmentIds.includes(exercise.primaryEquipment)
              ? exercise.primaryEquipment
              : equipmentIds[0] ?? 'Bodyweight',
            category: typeof exercise.category === 'string' ? exercise.category : 'Accessories',
            aliases: Array.isArray(exercise.aliases) ? exercise.aliases.filter((value): value is string => typeof value === 'string') : [],
            searchTerms: stringList(exercise.searchTerms),
            workoutTypeIds: Array.isArray(exercise.workoutTypeIds) ? exercise.workoutTypeIds.filter((value): value is string => typeof value === 'string') : ['strength'],
            primaryMuscle: typeof exercise.primaryMuscle === 'string' ? exercise.primaryMuscle : (typeof exercise.category === 'string' ? exercise.category : 'Accessories'),
            secondaryMuscles: Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles.filter((value): value is string => typeof value === 'string') : [],
            trackingType: trackingType(exercise.trackingType),
            bodyRegion: typeof exercise.bodyRegion === 'string' ? exercise.bodyRegion : undefined,
            movementPattern: typeof exercise.movementPattern === 'string' ? exercise.movementPattern : undefined,
            mechanics: typeof exercise.mechanics === 'string' ? exercise.mechanics : undefined,
            laterality: typeof exercise.laterality === 'string' ? exercise.laterality : undefined,
            restSeconds: typeof exercise.restSeconds === 'number' && exercise.restSeconds >= 0 ? exercise.restSeconds : undefined,
          } satisfies ExerciseCatalogItem];
        })
      : [];
  } catch { return []; }
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : undefined;
}

function variationFacets(value: unknown): ExerciseVariationFacets | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ExerciseVariationFacets>;
  const facets: ExerciseVariationFacets = {};
  if (typeof candidate.load === 'string') facets.load = candidate.load;
  if (typeof candidate.assistance === 'string') facets.assistance = candidate.assistance;
  if (typeof candidate.grip === 'string') facets.grip = candidate.grip;
  if (typeof candidate.stance === 'string') facets.stance = candidate.stance;
  if (typeof candidate.setup === 'string') facets.setup = candidate.setup;
  if (typeof candidate.laterality === 'string') facets.laterality = candidate.laterality;
  const other = stringList(candidate.other);
  if (other?.length) facets.other = other;
  return Object.keys(facets).length ? facets : undefined;
}

function trackingType(value: unknown): TrackingType | undefined {
  const types: TrackingType[] = ['weight-reps', 'bodyweight-reps', 'weighted-bodyweight', 'assisted-bodyweight', 'reps-only', 'duration', 'duration-weight', 'distance-duration', 'weight-distance'];
  return typeof value === 'string' && types.includes(value as TrackingType) ? value as TrackingType : undefined;
}

export async function saveCustomExercises(exercises: ExerciseCatalogItem[]): Promise<void> {
  const normalized = uniqueById(exercises);
  await withDatabaseTransaction(async (db) => {
    await db.runAsync('DELETE FROM custom_exercises');
    for (const exercise of normalized) await db.runAsync('INSERT INTO custom_exercises (id, archived, value_json) VALUES (?, 0, ?)', exercise.id, JSON.stringify(exercise));
  });
}
