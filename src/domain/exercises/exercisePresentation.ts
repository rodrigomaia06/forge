import { taxonomyLabel, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import type { ExerciseSnapshot } from '../../types';

function normalizedWords(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function titleAlreadySaysVariation(name: string, variation: string): boolean {
  const variationWords = normalizedWords(variation);
  const titleWords = normalizedWords(name);
  return variationWords.size > 0 && [...variationWords].every((word) => titleWords.has(word));
}

function removePrimaryEquipment(variation: string, primaryEquipment: string): string {
  const expression = primaryEquipment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return variation.replace(new RegExp(expression, 'ig'), '').replace(/[·,–—-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Legacy snapshots omit this metadata and deliberately retain a name-only treatment. */
export function formatExerciseMetadata(snapshot: ExerciseSnapshot | undefined): string | null {
  const primaryEquipment = snapshot?.primaryEquipment?.trim();
  const equipment = primaryEquipment ? taxonomyLabel('equipment', primaryEquipment) : undefined;
  const rawVariation = snapshot?.variation?.trim();
  const variation = rawVariation && equipment
    ? removePrimaryEquipment(rawVariation, equipment)
    : rawVariation;
  const visibleVariation = variation && snapshot && !titleAlreadySaysVariation(snapshot.name, variation)
    ? variation
    : undefined;
  const metadata = [visibleVariation, equipment].filter((value): value is string => Boolean(value));
  return metadata.length ? metadata.join(' · ') : null;
}

/** Assisted movements must not look like ordinary machine variants in the picker. */
export function formatPickerPrimaryEquipment(exercise: ExerciseCatalogItem, primaryEquipment: string): string {
  return exercise.trackingType === 'assisted-bodyweight'
    ? `${primaryEquipment} · Assisted`
    : primaryEquipment;
}
