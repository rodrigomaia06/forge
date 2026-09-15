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

export function filterCatalog(items: ExerciseCatalogItem[], filters: CatalogFilters): ExerciseCatalogItem[] {
  const query = catalogSearchKey(filters.query ?? '');
  return items.filter((item) => {
    if (filters.types?.length && !item.workoutTypeIds.some((id) => filters.types?.includes(id))) return false;
    const equipment = item.equipmentIds?.map((id) => taxonomyLabel('equipment', id)) ?? [item.equipment];
    if (filters.equipment?.length && !equipment.some((value) => filters.equipment?.includes(value))) return false;
    const muscles = [item.primaryMuscle, ...item.secondaryMuscles];
    if (filters.categories?.length && !muscles.some((muscle) => filters.categories?.includes(muscle))) return false;
    if (filters.exerciseCategories?.length && !filters.exerciseCategories.includes(item.category)) return false;
    if (!query) return true;
    const facetTerms = item.variationFacets ? Object.values(item.variationFacets).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []) : [];
    const searchable = [item.name, ...equipment, item.category, item.primaryMuscle, ...item.secondaryMuscles, ...item.aliases, ...(item.searchTerms ?? []), ...facetTerms];
    if (filters.includeGroupInSearch) searchable.push(item.group);
    const haystack = catalogSearchKey(searchable.join(' '));
    // Facets are stored in display order (for example `Weighted · Wide ·
    // Pronated`), while people naturally search them in any order. Matching
    // each normalized token keeps compound-variation selection independent of
    // that presentation order.
    return query.split(' ').every((term) => haystack.includes(term));
  });
}

export function catalogFacets(items: ExerciseCatalogItem[]): { equipment: string[]; categories: string[] } {
  return {
    equipment: [...new Set(items.flatMap((item) => item.equipmentIds?.map((id) => taxonomyLabel('equipment', id)) ?? [item.equipment]))].sort(),
    categories: [...new Set(items.flatMap((item) => [item.primaryMuscle, ...item.secondaryMuscles]))].sort(),
  };
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
