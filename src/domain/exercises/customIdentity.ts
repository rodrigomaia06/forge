import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';

/** The provider and import repository must agree before accepting a custom definition. */
export function customVariationKey(exercise: ExerciseCatalogItem): string {
  const facets = exercise.variationFacets
    ? Object.entries(exercise.variationFacets).flatMap(([key, value]) =>
        Array.isArray(value)
          ? value.map((item) => `${key}:${item}`)
          : value
            ? [`${key}:${value}`]
            : [],
      )
    : [];
  return [
    exercise.group,
    ...(facets.length ? facets : [exercise.variation || exercise.name]),
    ...(exercise.equipmentIds?.length ? [...exercise.equipmentIds].sort() : [exercise.equipment]),
  ]
    .map((value) => value.trim().toLocaleLowerCase())
    .join('\u0000');
}
