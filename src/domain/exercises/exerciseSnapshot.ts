import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { CATALOG_VERSION } from '../../data/catalog/loadCatalog';
import type { ExerciseSnapshot } from '../../types';

/** Copies catalogue metadata into a workout-owned record so future releases cannot reinterpret it. */
export function createExerciseSnapshot(exercise: ExerciseCatalogItem): ExerciseSnapshot {
  return {
    id: exercise.id,
    name: exercise.name,
    catalogueVersion: CATALOG_VERSION,
    trackingType: exercise.trackingType ?? 'weight-reps',
    familyId: exercise.familyId,
    group: exercise.group,
    variation: exercise.variation,
    equipment: exercise.equipmentIds,
    primaryEquipment: exercise.primaryEquipment,
    workoutTypeIds: exercise.workoutTypeIds,
    category: exercise.category,
    bodyRegion: exercise.bodyRegion,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: exercise.secondaryMuscles,
    aliases: exercise.aliases,
    searchTerms: exercise.searchTerms,
    movementPattern: exercise.movementPattern,
    restSeconds: exercise.restSeconds,
  };
}
