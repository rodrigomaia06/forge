import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';

export type CatalogFilters = { query?: string; types?: string[]; equipment?: string[]; categories?: string[]; includeGroupInSearch?: boolean };

export function filterCatalog(items: ExerciseCatalogItem[], filters: CatalogFilters): ExerciseCatalogItem[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (filters.types?.length && !item.workoutTypeIds.some((id) => filters.types?.includes(id))) return false;
    if (filters.equipment?.length && !filters.equipment.includes(item.equipment)) return false;
    if (filters.categories?.length && !filters.categories.includes(item.category)) return false;
    if (!query) return true;
    const searchable = [item.name, item.equipment, item.category, ...item.aliases];
    if (filters.includeGroupInSearch) searchable.push(item.group);
    return searchable.join(' ').toLowerCase().includes(query);
  });
}

export function catalogFacets(items: ExerciseCatalogItem[]): { equipment: string[]; categories: string[] } {
  return { equipment: [...new Set(items.map((item) => item.equipment))].sort(), categories: [...new Set(items.map((item) => item.category))].sort() };
}

export function groupCatalogByMovement(items: ExerciseCatalogItem[]): [string, ExerciseCatalogItem[]][] {
  return Object.entries(items.reduce<Record<string, ExerciseCatalogItem[]>>((groups, item) => { (groups[item.group] ??= []).push(item); return groups; }, {}));
}

export function groupCatalogByEquipment(items: ExerciseCatalogItem[]): [string, ExerciseCatalogItem[]][] {
  return Object.entries(items.reduce<Record<string, ExerciseCatalogItem[]>>((groups, item) => { (groups[item.equipment] ??= []).push(item); return groups; }, {}));
}
