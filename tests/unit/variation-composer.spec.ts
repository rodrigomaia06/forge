import { expect, test } from '@playwright/test';

import { exerciseCatalog } from '../../src/data/exerciseCatalog';
import {
  buildVariationFamily,
  resolveVariationPalette,
} from '../../src/domain/exercises/variationResolver';

function select(...ids: string[]): ReadonlySet<string> { return new Set(ids); }

test('resolves compatible pull-up modifiers into a single exact catalogue exercise', () => {
  const pullUps = exerciseCatalog.filter((exercise) => exercise.group === 'Pull-Up');
  const family = buildVariationFamily(pullUps);
  expect(family.inputs.map((input) => input.label)).toEqual(expect.arrayContaining(['Weighted', 'Assisted', 'Pronated', 'Supinated', 'Neutral', 'Wide']));
  const results = resolveVariationPalette(family, select('load:weighted', 'grip:pronated'));
  expect(results).toHaveLength(1);
  expect(results[0].exercise.id).toBe('weighted-pull-up');
});

test('offers independently selectable outputs only for conflicting pull-up choices', () => {
  const pullUps = exerciseCatalog.filter((exercise) => exercise.group === 'Pull-Up');
  const results = resolveVariationPalette(buildVariationFamily(pullUps), select('load:weighted', 'grip:supinated', 'grip:pronated'));
  expect(results.map((result) => result.exercise.id)).toEqual(expect.arrayContaining(['weighted-chin-up', 'weighted-pull-up', 'chin-up', 'pull-up']));
});

test('does not silently join two independent movement variants', () => {
  const pullUps = exerciseCatalog.filter((exercise) => exercise.group === 'Pull-Up');
  const results = resolveVariationPalette(buildVariationFamily(pullUps), select('stance:wide', 'grip:neutral'));
  expect(results.map((result) => result.exercise.id)).toEqual(expect.arrayContaining([
    'wide-grip-pull-up',
    'neutral-grip-pull-up',
    'custom-derived-pull-up-stance-wide-grip-neutral',
  ]));
});

test('never combines weighted and assisted loading in one output', () => {
  const pullUps = exerciseCatalog.filter((exercise) => exercise.group === 'Pull-Up');
  const results = resolveVariationPalette(buildVariationFamily(pullUps), select('load:weighted', 'load:assisted'));
  expect(results.every((result) => !result.exercise.name.includes('Weighted Assisted'))).toBe(true);
  expect(results.some((result) => result.exercise.trackingType === 'weighted-bodyweight')).toBe(true);
  expect(results.some((result) => result.exercise.trackingType === 'assisted-bodyweight')).toBe(true);
});

test('keeps assistance methods conditional on Assisted and resolves assisted tracking', () => {
  const pullUps = exerciseCatalog.filter((exercise) => exercise.group === 'Pull-Up');
  const family = buildVariationFamily(pullUps);
  const assisted = resolveVariationPalette(family, select('load:assisted', 'grip:pronated'));
  expect(assisted).toHaveLength(2);
  expect(assisted.every((result) => result.exercise.trackingType === 'assisted-bodyweight')).toBe(true);
  expect(assisted.every((result) => result.exercise.variationFacets?.load === 'Assisted')).toBe(true);
});

test('classifies all bundled entries without dropping unstructured variants', () => {
  const byFamily = new Map<string, typeof exerciseCatalog>();
  exerciseCatalog.forEach((exercise) => byFamily.set(`${exercise.category}\u0001${exercise.group}`, [...(byFamily.get(`${exercise.category}\u0001${exercise.group}`) ?? []), exercise]));
  for (const variants of byFamily.values()) {
    const family = buildVariationFamily(variants);
    const represented = new Set([...family.standalone.map((item) => item.id), ...family.variants.filter((item) => item.variationFacets && !item.variationFacets.other?.length).map((item) => item.id), ...family.variants.filter((item) => item.trackingType === 'assisted-bodyweight').map((item) => item.id)]);
    expect(represented.size).toBeGreaterThan(0);
    const allInputs = new Set(family.inputs.map((input) => input.id));
    const outputs = resolveVariationPalette(family, allInputs);
    expect(outputs.every((result) => !/weighted assisted/i.test(result.exercise.name))).toBe(true);
    expect(outputs.filter((result) => result.exercise.variationFacets?.load === 'Assisted').every((result) => result.exercise.trackingType === 'assisted-bodyweight')).toBe(true);
  }
});
