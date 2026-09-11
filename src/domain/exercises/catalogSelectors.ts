import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { taxonomyLabel } from '../../data/exerciseCatalog';

export type CatalogFilters = { query?: string; types?: string[]; equipment?: string[]; categories?: string[]; exerciseCategories?: string[]; includeGroupInSearch?: boolean };

export function filterCatalog(items: ExerciseCatalogItem[], filters: CatalogFilters): ExerciseCatalogItem[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (filters.types?.length && !item.workoutTypeIds.some((id) => filters.types?.includes(id))) return false;
    const equipment = item.equipmentIds?.map((id) => taxonomyLabel('equipment', id)) ?? [item.equipment];
    if (filters.equipment?.length && !equipment.some((value) => filters.equipment?.includes(value))) return false;
    const muscles = [item.primaryMuscle, ...item.secondaryMuscles];
    if (filters.categories?.length && !muscles.some((muscle) => filters.categories?.includes(muscle))) return false;
    if (filters.exerciseCategories?.length && !filters.exerciseCategories.includes(item.category)) return false;
    if (!query) return true;
    const searchable = [item.name, ...equipment, item.category, item.primaryMuscle, ...item.secondaryMuscles, ...item.aliases, ...(item.searchTerms ?? [])];
    if (filters.includeGroupInSearch) searchable.push(item.group);
    return searchable.join(' ').toLowerCase().includes(query);
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

export function groupCatalogByEquipment(items: ExerciseCatalogItem[]): [string, ExerciseCatalogItem[]][] {
  return Object.entries(items.reduce<Record<string, ExerciseCatalogItem[]>>((groups, item) => { (groups[item.equipment] ??= []).push(item); return groups; }, {}));
}
