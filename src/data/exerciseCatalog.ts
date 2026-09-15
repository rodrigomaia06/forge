import { bundledExercises, bundledCatalogTaxonomies, type TrackingType } from './catalog/loadCatalog';
import type { ExerciseVariationFacets } from '../types';
export interface ExerciseCatalogItem {
  id: string; name: string; familyId?: string; group: string; equipment: string; equipmentIds?: string[]; primaryEquipment?: string;
  variation?: string; variationFacets?: ExerciseVariationFacets; category: string; bodyRegion?: string; primaryMuscle: string; secondaryMuscles: string[];
  aliases: string[]; searchTerms?: string[]; workoutTypeIds: string[]; trackingType?: TrackingType;
  movementPattern?: string; mechanics?: string; laterality?: string; restSeconds?: number;
}
export const catalogTaxonomies = bundledCatalogTaxonomies;
export function taxonomyLabel(kind: 'categories' | 'muscles' | 'equipment', id: string): string {
  const entry = catalogTaxonomies[kind].find((value) => typeof value !== 'string' && value.id === id);
  return typeof entry === 'string' || !entry ? id : entry.label;
}
export const exerciseCatalog: ExerciseCatalogItem[] = bundledExercises.map((exercise) => ({
  ...exercise,
  equipment: exercise.equipment.map((id) => taxonomyLabel('equipment', id)).join(' & '),
  equipmentIds: exercise.equipment,
  category: taxonomyLabel('categories', exercise.category),
  primaryMuscle: taxonomyLabel('muscles', exercise.primaryMuscle),
  secondaryMuscles: exercise.secondaryMuscles.map((id) => taxonomyLabel('muscles', id)),
}));
