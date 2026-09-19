import source from './forge_exercise_catalog_v3_flat.json';
import type { ExerciseVariationFacets } from '../../types';

export const CATALOG_VERSION = 5;
export const CATALOG_EXERCISE_COUNT = 608;
export const TRACKING_TYPES = [
  'weight-reps', 'bodyweight-reps', 'weighted-bodyweight', 'assisted-bodyweight',
  'reps-only', 'duration', 'duration-weight', 'distance-duration', 'weight-distance',
] as const;
export type TrackingType = typeof TRACKING_TYPES[number];
export interface CatalogTaxonomyLabel { id: string; label: string; }
export interface BundledExercise {
  id: string; name: string; familyId: string; group: string; category: string; bodyRegion: string;
  equipment: string[]; primaryEquipment: string; variation?: string; variationFacets?: ExerciseVariationFacets; primaryMuscle: string;
  secondaryMuscles: string[]; workoutTypeIds: string[]; trackingType: TrackingType;
  movementPattern: string; mechanics: string; laterality: string; aliases: string[]; searchTerms: string[];
}
type CatalogSource = { version: number; schemaVersion: string; counts: { exercises: number }; taxonomies: Record<string, string[] | CatalogTaxonomyLabel[]>; legacyIdMap: Record<string, string>; exercises: BundledExercise[]; };
function ids(values: string[] | CatalogTaxonomyLabel[]): Set<string> { return new Set(values.map((value) => typeof value === 'string' ? value : value.id)); }
function reference(value: string, set: Set<string>, field: string, id: string): void { if (!set.has(value)) throw new Error(`Bundled exercise ${id} has unknown ${field}: ${value}.`); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0); }
function normalizeIdentity(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }

/** Validates the immutable release artifact before it is exposed to the app or SQLite. */
export function validateCatalog(candidate: CatalogSource = source as CatalogSource): BundledExercise[] {
  if (candidate.version !== CATALOG_VERSION || candidate.schemaVersion !== '5.0.0-flat' || candidate.counts?.exercises !== CATALOG_EXERCISE_COUNT || candidate.exercises?.length !== CATALOG_EXERCISE_COUNT) throw new Error(`Expected the Forge v5 catalogue release with ${CATALOG_EXERCISE_COUNT} exercises.`);
  const required = ['workoutTypes', 'bodyRegions', 'categories', 'muscles', 'equipment', 'trackingTypes', 'movementPatterns', 'mechanics', 'laterality'];
  if (required.some((key) => !Array.isArray(candidate.taxonomies?.[key]))) throw new Error('Bundled catalogue taxonomy is incomplete.');
  const refs = Object.fromEntries(required.map((key) => [key, ids(candidate.taxonomies[key])])) as Record<string, Set<string>>;
  if (refs.workoutTypes.size !== 10 || TRACKING_TYPES.some((type) => !refs.trackingTypes.has(type))) throw new Error('Bundled catalogue tracking or workout-type taxonomy is invalid.');
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const seenPickerKeys = new Set<string>();
  for (const exercise of candidate.exercises) {
    if (!exercise.id || !exercise.name?.trim() || !exercise.familyId || seenIds.has(exercise.id)) throw new Error(`Invalid or duplicate bundled exercise: ${exercise.id}.`);
    seenIds.add(exercise.id);
    const normalizedName = normalizeIdentity(exercise.name);
    if (seenNames.has(normalizedName)) throw new Error(`Bundled exercise ${exercise.id} has a duplicate exercise name.`);
    seenNames.add(normalizedName);
    reference(exercise.category, refs.categories, 'category', exercise.id); reference(exercise.bodyRegion, refs.bodyRegions, 'body region', exercise.id); reference(exercise.primaryMuscle, refs.muscles, 'primary muscle', exercise.id); reference(exercise.primaryEquipment, refs.equipment, 'primary equipment', exercise.id); reference(exercise.trackingType, refs.trackingTypes, 'tracking type', exercise.id); reference(exercise.movementPattern, refs.movementPatterns, 'movement pattern', exercise.id); reference(exercise.mechanics, refs.mechanics, 'mechanics', exercise.id); reference(exercise.laterality, refs.laterality, 'laterality', exercise.id);
    if (!strings(exercise.equipment) || !exercise.equipment.length || !strings(exercise.workoutTypeIds) || !exercise.workoutTypeIds.length || (exercise.aliases !== undefined && !strings(exercise.aliases)) || !strings(exercise.searchTerms) || (exercise.secondaryMuscles !== undefined && !strings(exercise.secondaryMuscles))) throw new Error(`Bundled exercise ${exercise.id} has incomplete arrays.`);
    exercise.equipment.forEach((value) => reference(value, refs.equipment, 'equipment', exercise.id)); exercise.workoutTypeIds.forEach((value) => reference(value, refs.workoutTypes, 'workout type', exercise.id)); (exercise.secondaryMuscles ?? []).forEach((value) => reference(value, refs.muscles, 'secondary muscle', exercise.id));
    if (exercise.variation && normalizeIdentity(exercise.variation) === normalizedName) throw new Error(`Bundled exercise ${exercise.id} repeats its name as a variation.`);
    if (exercise.variationFacets && Object.values(exercise.variationFacets).some((value) => value !== undefined && !(typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'))))) throw new Error(`Bundled exercise ${exercise.id} has invalid variation facets.`);
    const pickerKey = [
      normalizeIdentity(exercise.group),
      exercise.equipment.map(normalizeIdentity).sort().join('|'),
      normalizeIdentity(exercise.variation || exercise.name),
    ].join('::');
    if (seenPickerKeys.has(pickerKey)) throw new Error(`Bundled exercise ${exercise.id} duplicates a picker variation.`);
    seenPickerKeys.add(pickerKey);
  }
  for (const [legacy, current] of Object.entries(candidate.legacyIdMap ?? {})) if (!legacy || !seenIds.has(current)) throw new Error(`Invalid legacy catalogue mapping: ${legacy}.`);
  return candidate.exercises.map((exercise) => ({ ...exercise, aliases: exercise.aliases ?? [], secondaryMuscles: exercise.secondaryMuscles ?? [] }));
}
export const bundledCatalogVersion = source.version;
export const bundledCatalogTaxonomies = source.taxonomies;
export const bundledLegacyIdMap = source.legacyIdMap;
export const bundledExercises = validateCatalog();
