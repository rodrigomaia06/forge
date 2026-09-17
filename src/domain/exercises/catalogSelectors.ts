import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { taxonomyLabel } from '../../data/exerciseCatalog';

export type CatalogFilters = { query?: string; types?: string[]; equipment?: string[]; categories?: string[]; exerciseCategories?: string[]; includeGroupInSearch?: boolean };

/**
 * Keeps catalogue search tolerant of punctuation and the ordinary singular/
 * plural spellings used by imported libraries without changing a custom
 * exercise's stored name or identity.
 */
export function catalogSearchKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\bpull[\s-]*ups?\b/g, 'pullup')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.length > 3 && /[^s]s$/.test(word) ? word.slice(0, -1) : word)
    .join(' ');
}

/**
 * Search and facet projection of one catalogue item, normalized once and reused
 * across every screen, query, and filter sheet. The catalogue is immutable for a
 * given item identity, so the index is memoized per item rather than recomputed
 * on each keystroke or filter pass.
 */
type CatalogItemIndex = {
  equipment: string[];
  muscles: string[];
  haystack: string;
  groupHaystack: string;
};

const itemIndexCache = new WeakMap<ExerciseCatalogItem, CatalogItemIndex>();

function catalogItemIndex(item: ExerciseCatalogItem): CatalogItemIndex {
  const cached = itemIndexCache.get(item);
  if (cached) return cached;
  const equipment = item.equipmentIds?.map((id) => taxonomyLabel('equipment', id)) ?? [item.equipment];
  const muscles = [item.primaryMuscle, ...item.secondaryMuscles];
  const facetTerms = item.variationFacets
    ? Object.values(item.variationFacets).flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    : [];
  const searchable = [item.name, ...equipment, item.category, item.primaryMuscle, ...item.secondaryMuscles, ...item.aliases, ...(item.searchTerms ?? []), ...facetTerms];
  // Store one full haystack plus the small group-token string separately rather
  // than a second near-duplicate haystack that repeats every field. The group is
  // space-joined, so a single-word query term matches the combined text exactly
  // when checked against either piece.
  const index: CatalogItemIndex = {
    equipment,
    muscles,
    haystack: catalogSearchKey(searchable.join(' ')),
    groupHaystack: catalogSearchKey(item.group),
  };
  itemIndexCache.set(item, index);
  return index;
}

/**
 * Precompute the per-item index for a whole catalogue in small chunks, off the
 * interaction path. Warming it once at startup keeps the first picker/browser
 * open from paying the full normalization cost in a single JS frame.
 */
export function warmCatalogIndex(items: ExerciseCatalogItem[], chunkSize = 40): void {
  let cursor = 0;
  const step = (): void => {
    const end = Math.min(cursor + chunkSize, items.length);
    for (; cursor < end; cursor += 1) catalogItemIndex(items[cursor]);
    if (cursor < items.length) {
      (globalThis.requestAnimationFrame ?? ((cb: () => void) => setTimeout(cb, 16)))(step);
    }
  };
  if (items.length) step();
}

export function filterCatalog(items: ExerciseCatalogItem[], filters: CatalogFilters): ExerciseCatalogItem[] {
  const query = catalogSearchKey(filters.query ?? '');
  const terms = query ? query.split(' ') : [];
  return items.filter((item) => {
    if (filters.types?.length && !item.workoutTypeIds.some((id) => filters.types?.includes(id))) return false;
    const index = catalogItemIndex(item);
    if (filters.equipment?.length && !index.equipment.some((value) => filters.equipment?.includes(value))) return false;
    if (filters.categories?.length && !index.muscles.some((muscle) => filters.categories?.includes(muscle))) return false;
    if (filters.exerciseCategories?.length && !filters.exerciseCategories.includes(item.category)) return false;
    if (!terms.length) return true;
    // Facets are stored in display order (for example `Weighted · Wide ·
    // Pronated`), while people naturally search them in any order. Matching
    // each normalized token keeps compound-variation selection independent of
    // that presentation order.
    return filters.includeGroupInSearch
      ? terms.every((term) => index.haystack.includes(term) || index.groupHaystack.includes(term))
      : terms.every((term) => index.haystack.includes(term));
  });
}

const facetsCache = new WeakMap<ExerciseCatalogItem[], { equipment: string[]; categories: string[] }>();

export function catalogFacets(items: ExerciseCatalogItem[]): { equipment: string[]; categories: string[] } {
  const cached = facetsCache.get(items);
  if (cached) return cached;
  const facets = {
    equipment: [...new Set(items.flatMap((item) => catalogItemIndex(item).equipment))].sort(),
    categories: [...new Set(items.flatMap((item) => catalogItemIndex(item).muscles))].sort(),
  };
  facetsCache.set(items, facets);
  return facets;
}

export function groupCatalogByMovement(items: ExerciseCatalogItem[]): [string, ExerciseCatalogItem[]][] {
  return Object.entries(items.reduce<Record<string, ExerciseCatalogItem[]>>((groups, item) => { (groups[item.group] ??= []).push(item); return groups; }, {}));
}

/**
 * The picker exposes the load-bearing equipment as its child hierarchy. Support
 * equipment stays on the catalogue item for filtering, search, and snapshots.
 */
export function groupCatalogByPrimaryEquipment(items: ExerciseCatalogItem[]): [string, ExerciseCatalogItem[]][] {
  const groups = items.reduce<Record<string, ExerciseCatalogItem[]>>((current, item) => {
    const primaryEquipment = item.primaryEquipment ?? item.equipment;
    (current[primaryEquipment] ??= []).push(item);
    return current;
  }, {});
  return Object.entries(groups).map(([equipment, exercises]) => [
    taxonomyLabel('equipment', equipment),
    exercises,
  ]);
}
