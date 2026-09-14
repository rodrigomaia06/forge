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

const genericDetail = new Set(['bodyweight', 'machine', 'standard']);

function readableDetail(value: string): string {
  return value
    .replace(/[·,:()]/g, ' ')
    .replace(/[–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => !genericDetail.has(word.toLocaleLowerCase()))
    .map((word) => word.length < 3 ? word.toLocaleUpperCase() : `${word[0].toLocaleUpperCase()}${word.slice(1).toLocaleLowerCase()}`)
    .join(' ');
}

function titleAlreadySaysEquipment(name: string, equipment: string): boolean {
  const equipmentWords = normalizedWords(equipment);
  const titleWords = normalizedWords(name);
  return equipmentWords.size > 0 && [...equipmentWords].every((word) => titleWords.has(word));
}

/** Legacy snapshots omit this metadata and deliberately retain a name-only treatment. */
export function formatExerciseMetadata(snapshot: ExerciseSnapshot | undefined): string | null {
  // Unresolved legacy/custom records remain name-only. Canonical migration
  // replaces recognised snapshots first, so this never guesses at user data.
  if (snapshot?.catalogueVersion !== 3) return null;
  const primaryEquipment = snapshot?.primaryEquipment?.trim();
  const equipment = primaryEquipment ? taxonomyLabel('equipment', primaryEquipment) : undefined;
  const rawVariation = snapshot?.variation?.trim();
  const variation = rawVariation && equipment
    ? readableDetail(removePrimaryEquipment(rawVariation, equipment))
    : rawVariation ? readableDetail(rawVariation) : undefined;
  const visibleVariation = variation && snapshot && !titleAlreadySaysVariation(snapshot.name, variation)
    ? variation
    : undefined;
  const visibleEquipment = equipment && !genericDetail.has(equipment.toLocaleLowerCase())
    && !titleAlreadySaysEquipment(snapshot.name, equipment)
    ? equipment
    : undefined;
  const metadata = [visibleVariation, visibleEquipment].filter((value): value is string => Boolean(value));
  return metadata.length ? metadata.join(' · ') : null;
}

/** Assisted movements must not look like ordinary machine variants in the picker. */
export function formatPickerPrimaryEquipment(exercise: ExerciseCatalogItem, primaryEquipment: string): string {
  return exercise.trackingType === 'assisted-bodyweight'
    ? `${primaryEquipment} · Assisted`
    : primaryEquipment;
}
