import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import type { ExerciseVariationFacets, TrackingType } from '../../types';

export const variationAxes = ['load', 'assistance', 'stance', 'grip', 'setup', 'laterality'] as const;
export type VariationAxis = (typeof variationAxes)[number];
export type VariationInput = { id: string; axis: VariationAxis; value: string; label: string };
export type VariationFamily = {
  familyId: string;
  group: string;
  variants: readonly ExerciseCatalogItem[];
  inputs: readonly VariationInput[];
  standalone: readonly ExerciseCatalogItem[];
};

export type ResolvedVariation = { exercise: ExerciseCatalogItem; source: 'bundled' | 'derived' };

const labels: Record<VariationAxis, string> = {
  load: 'Load', assistance: 'Assistance method', stance: 'Width / stance', grip: 'Grip', setup: 'Position / setup', laterality: 'Laterality',
};
const controlledFacetAxes = ['load', 'stance', 'grip', 'setup', 'laterality'] as const;

export function variationAxisLabel(axis: VariationAxis): string { return labels[axis]; }

/**
 * Classifies every family without guessing at source-specific prose. `other`
 * facets and unstructured variants remain named standalone exercises.
 */
export function buildVariationFamily(variants: readonly ExerciseCatalogItem[]): VariationFamily {
  const first = variants[0];
  if (!first) return { familyId: '', group: '', variants, inputs: [], standalone: [] };
  const controlled = variants.filter(isControlledVariant);
  const assisted = variants.filter((item) => item.trackingType === 'assisted-bodyweight');
  const composable = controlled.length > 0;
  const values = new Map<string, VariationInput>();
  if (composable) {
    controlled.forEach((item) => {
      controlledFacetAxes.forEach((axis) => {
        const value = item.variationFacets?.[axis];
        if (typeof value === 'string' && value.trim()) addInput(values, axis, value);
      });
    });
    if (assisted.length) {
      addInput(values, 'load', 'Assisted');
      for (const method of [...new Set(assisted.map(assistanceMethod).filter(Boolean))]) addInput(values, 'assistance', method!);
    }
  }
  const standalone = variants.filter((item) => {
    if (!composable) return true;
    if (item.trackingType === 'assisted-bodyweight') return false;
    return !isControlledVariant(item);
  });
  return {
    familyId: first.familyId ?? first.group,
    group: first.group,
    variants,
    inputs: [...values.values()].sort((left, right) => variationAxes.indexOf(left.axis) - variationAxes.indexOf(right.axis) || left.value.localeCompare(right.value)),
    standalone,
  };
}

export function hasComposableInputs(family: VariationFamily): boolean { return family.inputs.length > 0; }

/** Returns all legal, non-empty outputs for the selected modifier palette. */
export function resolveVariationPalette(family: VariationFamily, selectedIds: ReadonlySet<string>): ResolvedVariation[] {
  const selected = family.inputs.filter((input) => selectedIds.has(input.id));
  if (!selected.length) return [];
  const byAxis = new Map<VariationAxis, VariationInput[]>();
  selected.forEach((input) => byAxis.set(input.axis, [...(byAxis.get(input.axis) ?? []), input]));
  if (byAxis.get('load')?.some((input) => input.value === 'Assisted') && !byAxis.has('assistance')) {
    const methods = family.inputs.filter((input) => input.axis === 'assistance');
    if (methods.length) byAxis.set('assistance', methods);
  }
  const axes = variationAxes.filter((axis) => byAxis.has(axis));
  const conflictingAxes = axes.filter((axis) => (byAxis.get(axis) ?? []).length > 1);
  const movementAxes = axes.filter((axis) => axis !== 'load' && axis !== 'assistance');
  // A load mode qualifies one movement detail (Weighted + Pronated), but two
  // independent movement details (Wide + Neutral) are intentionally left for
  // the chooser: they may be one combined movement or two separate exercises.
  const requiresChoice = conflictingAxes.length > 0 || movementAxes.length > 1;
  const loadInputs = byAxis.get('load') ?? [];
  const movementInputs = movementAxes.flatMap((axis) => byAxis.get(axis) ?? []);
  const movementChoice = movementAxes.length > 1 || movementAxes.some((axis) => (byAxis.get(axis) ?? []).length > 1);
  const combinations = requiresChoice
    ? [
      ...fullCombinations(axes, byAxis),
      ...conflictingAxes.flatMap((axis) => byAxis.get(axis) ?? []).map((input) => [input]),
      ...(movementChoice ? movementInputs.map((input) => [input]) : []),
      ...(movementChoice && loadInputs.length === 1 ? movementInputs.map((input) => [loadInputs[0], input]) : []),
    ]
    : fullCombinations(axes, byAxis);
  const results = new Map<string, ResolvedVariation>();
  for (const combination of combinations) {
    if (!legalCombination(combination)) continue;
    const resolved = resolveCombination(family, combination);
    results.set(resolved.exercise.id, resolved);
  }
  return [...results.values()].sort((left, right) => left.exercise.name.localeCompare(right.exercise.name));
}

function fullCombinations(axes: VariationAxis[], selected: ReadonlyMap<VariationAxis, VariationInput[]>): VariationInput[][] {
  const walk = (index: number, current: VariationInput[]): VariationInput[][] => {
    if (index === axes.length) return [current];
    const options = selected.get(axes[index]) ?? [];
    return options.flatMap((item) => walk(index + 1, [...current, item]));
  };
  return walk(0, []);
}

function legalCombination(inputs: readonly VariationInput[]): boolean {
  const load = inputs.find((input) => input.axis === 'load')?.value;
  const assistance = inputs.some((input) => input.axis === 'assistance');
  return !assistance || load === 'Assisted';
}

function resolveCombination(family: VariationFamily, inputs: readonly VariationInput[]): ResolvedVariation {
  const facets = Object.fromEntries(inputs.filter((input) => input.axis !== 'assistance').map((input) => [input.axis, input.value])) as ExerciseVariationFacets;
  const assistance = inputs.find((input) => input.axis === 'assistance')?.value;
  const exact = [...family.variants]
    .filter((item) => compatibleExact(item, facets, assistance))
    .sort((left, right) => exactScore(right, facets, assistance) - exactScore(left, facets, assistance))[0];
  if (exact) return { exercise: exact, source: 'bundled' };
  const source = sourceFor(family.variants, facets, assistance);
  const values = inputs.map((input) => input.value);
  const variation = values.join(' · ');
  const name = `${values.join(' ')} ${family.group}`;
  const id = `custom-derived-${[family.familyId, ...inputs.flatMap((input) => [input.axis, input.value])].map(slug).join('-')}`;
  const trackingType = facets.load === 'Assisted' ? 'assisted-bodyweight' : facets.load === 'Weighted' ? 'weighted-bodyweight' : source.trackingType;
  return {
    source: 'derived',
    exercise: {
      ...source,
      id, name, variation,
      variationFacets: { ...facets, ...(assistance ? { assistance } : {}) },
      trackingType,
      aliases: [...new Set([name, family.group, ...source.aliases])],
      searchTerms: [...new Set([...(source.searchTerms ?? []), name, variation, ...values])],
    },
  };
}

function compatibleExact(item: ExerciseCatalogItem, facets: ExerciseVariationFacets, assistance?: string): boolean {
  if (facets.load === 'Assisted') return item.trackingType === 'assisted-bodyweight' && (!assistance || assistanceMethod(item) === assistance) && remainingFacetMatch(item, facets);
  if (item.trackingType === 'assisted-bodyweight') return false;
  return remainingFacetMatch(item, facets);
}
function remainingFacetMatch(item: ExerciseCatalogItem, facets: ExerciseVariationFacets): boolean {
  return Object.entries(facets).every(([axis, value]) => item.variationFacets?.[axis as keyof ExerciseVariationFacets] === value);
}
function exactScore(item: ExerciseCatalogItem, facets: ExerciseVariationFacets, assistance?: string): number {
  const matches = Object.entries(facets).filter(([axis, value]) => item.variationFacets?.[axis as keyof ExerciseVariationFacets] === value).length;
  return matches * 10 + (assistance && assistanceMethod(item) === assistance ? 2 : 0) - Object.keys(item.variationFacets ?? {}).length;
}
function sourceFor(variants: readonly ExerciseCatalogItem[], facets: ExerciseVariationFacets, assistance?: string): ExerciseCatalogItem {
  return [...variants].sort((left, right) => exactScore(right, facets, assistance) - exactScore(left, facets, assistance))[0]!;
}
function isControlledVariant(item: ExerciseCatalogItem): boolean {
  if (item.variationFacets?.other?.length) return false;
  return controlledFacetAxes.some((axis) => typeof item.variationFacets?.[axis] === 'string');
}
function assistanceMethod(item: ExerciseCatalogItem): string | undefined {
  if (item.trackingType !== 'assisted-bodyweight') return undefined;
  if (item.equipmentIds?.includes('resistance-band') || item.equipment.toLocaleLowerCase().includes('band')) return 'Band';
  if (item.equipmentIds?.includes('machine') || item.equipment.toLocaleLowerCase().includes('machine')) return 'Machine';
  return undefined;
}
function addInput(target: Map<string, VariationInput>, axis: VariationAxis, value: string): void {
  const id = `${axis}:${value}`.toLocaleLowerCase();
  target.set(id, { id, axis, value, label: value });
}
function slug(value: string): string { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
