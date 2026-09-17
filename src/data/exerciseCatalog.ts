import { bundledExercises, bundledCatalogTaxonomies, type TrackingType } from './catalog/loadCatalog';
import type { ExerciseVariationFacets } from '../types';
export interface ExerciseCatalogItem {
  id: string; name: string; familyId?: string; group: string; equipment: string; equipmentIds?: string[]; primaryEquipment?: string;
  variation?: string; variationFacets?: ExerciseVariationFacets; category: string; bodyRegion?: string; primaryMuscle: string; secondaryMuscles: string[];
  aliases: string[]; searchTerms?: string[]; workoutTypeIds: string[]; trackingType?: TrackingType;
  movementPattern?: string; mechanics?: string; laterality?: string; restSeconds?: number;
}
export const catalogTaxonomies = bundledCatalogTaxonomies;
// The label projection at module load (and later snapshot/presentation calls)
// resolves thousands of taxonomy ids. Look them up through an id->label map
// built once per kind instead of a linear .find over the taxonomy array. This
// preserves the exact fallback semantics: object entries resolve to their
// label, string entries and unknown ids fall back to the raw id.
const taxonomyLabelMaps: Partial<Record<'categories' | 'muscles' | 'equipment', Map<string, string>>> = {};
function taxonomyLabelMap(kind: 'categories' | 'muscles' | 'equipment'): Map<string, string> {
  let map = taxonomyLabelMaps[kind];
  if (!map) {
    map = new Map();
    for (const value of catalogTaxonomies[kind]) {
      if (typeof value !== 'string') map.set(value.id, value.label);
    }
    taxonomyLabelMaps[kind] = map;
  }
  return map;
}
export function taxonomyLabel(kind: 'categories' | 'muscles' | 'equipment', id: string): string {
  return taxonomyLabelMap(kind).get(id) ?? id;
}
export const exerciseCatalog: ExerciseCatalogItem[] = bundledExercises.map((exercise) => ({
  ...exercise,
  equipment: exercise.equipment.map((id) => taxonomyLabel('equipment', id)).join(' & '),
  equipmentIds: exercise.equipment,
  category: taxonomyLabel('categories', exercise.category),
  primaryMuscle: taxonomyLabel('muscles', exercise.primaryMuscle),
  secondaryMuscles: exercise.secondaryMuscles.map((id) => taxonomyLabel('muscles', id)),
}));
/** O(1) id lookup for the bundled catalogue, so hot paths never linear-scan it. */
export const exerciseCatalogById: ReadonlyMap<string, ExerciseCatalogItem> = new Map(
  exerciseCatalog.map((item) => [item.id, item]),
);
