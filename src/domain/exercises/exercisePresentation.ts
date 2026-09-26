import { taxonomyLabel, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { CATALOG_VERSION } from '../../data/catalog/loadCatalog';
import type { ExerciseSnapshot } from '../../types';

function normalizedWords(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

// A variation word is already expressed by the title when every one of its
// sub-tokens is in the title — so "Farmer's" (farmer + s) or "90/90" (90) is
// recognised as redundant even though the title tokenizes across the
// apostrophe/slash and never contains the joined word verbatim.
function wordCoveredByTitle(word: string, titleWords: Set<string>): boolean {
  const tokens = normalizedWords(word);
  return tokens.size > 0 && [...tokens].every((token) => titleWords.has(token));
}

function titleAlreadySaysVariation(name: string, variation: string): boolean {
  const variationWords = normalizedWords(variation);
  const titleWords = normalizedWords(name);
  return variationWords.size > 0 && [...variationWords].every((word) => titleWords.has(word));
}

/** Removes only variation words already expressed by the canonical title. */
function variationNotInTitle(name: string, variation: string): string {
  const titleWords = normalizedWords(name);
  return variation
    .split(/\s*[·,–—-]\s*|\s+/)
    .filter((word) => word && !wordCoveredByTitle(word, titleWords))
    .join(' ');
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

/**
 * Picker rows already use the canonical exercise name as their primary label.
 * Do not repeat facets which that name expresses (including Forge's canonical
 * Chin-Up/Pull-Up grip names).  This is presentation-only: catalogue facets
 * remain intact for search, matching and the variation resolver.
 */
export function formatCatalogVariation(name: string, rawVariation: string | undefined): string | null {
  if (!rawVariation?.trim()) return null;
  const detail = readableDetail(rawVariation);
  if (!detail) return null;
  const implied = new Set<string>();
  const normalizedName = name.toLocaleLowerCase();
  if (/\bchin[ -]?up\b/.test(normalizedName)) implied.add('supinated');
  if (/\bpull[ -]?up\b/.test(normalizedName) && !/\bchin[ -]?up\b/.test(normalizedName)) implied.add('pronated');
  const titleWords = normalizedWords(name);
  const remaining = detail.split(/\s*[·,–—-]\s*|\s+/)
    .filter((word) => word && !wordCoveredByTitle(word, titleWords) && !implied.has(word.toLocaleLowerCase()));
  return remaining.length ? remaining.join(' ') : null;
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
  if (snapshot?.catalogueVersion !== CATALOG_VERSION) return null;
  const primaryEquipment = snapshot?.primaryEquipment?.trim();
  const equipment = primaryEquipment ? taxonomyLabel('equipment', primaryEquipment) : undefined;
  const rawVariation = snapshot?.variation?.trim();
  const variation = rawVariation && equipment
    ? readableDetail(removePrimaryEquipment(rawVariation, equipment))
    : rawVariation ? readableDetail(rawVariation) : undefined;
  const visibleVariation = snapshot ? formatCatalogVariation(snapshot.name, variation) ?? undefined : variation;
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
