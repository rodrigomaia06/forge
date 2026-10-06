import { expect, test } from '@playwright/test';
import { exerciseCatalog } from '../../src/data/exerciseCatalog';
import { canonicalizeExercise } from '../../src/data/exerciseCanonicalization';
import { bundledCatalogVersion, validateCatalog } from '../../src/data/catalog/loadCatalog';

test('cardio catalogue uses movement measurements rather than strength defaults', () => {
  for (const id of ['kinetic-stairmaster', 'kinetic-step-mill', 'kinetic-rope-jumping']) {
    expect(exerciseCatalog.find((exercise) => exercise.id === id)?.trackingType).toBe('duration');
  }
  for (const exercise of exerciseCatalog.filter((item) => item.category === 'Cardio')) {
    expect(['weight-reps', 'bodyweight-reps']).not.toContain(exercise.trackingType);
  }
});

test('catalogue upgrade repairs saved cardio tracking and preserves entered sets', () => {
  const sets = [{ id: 'set-1', weight: '10', reps: '20', completed: true }];
  const saved = {
    id: 'instance',
    exerciseId: 'kinetic-stairmaster',
    name: 'Stairmaster',
    trackingType: 'weight-reps' as const,
    sets,
  };
  const corrected = canonicalizeExercise(saved);
  expect(corrected.trackingType).toBe('duration');
  expect(corrected.sets).toBe(sets);
  expect(corrected.exerciseId).toBe(saved.exerciseId);
  expect(bundledCatalogVersion).toBe(7);
  expect(validateCatalog()).toHaveLength(608);
  expect(canonicalizeExercise({ ...saved, exerciseId: 'custom-stairmaster' })).toEqual({
    ...saved,
    exerciseId: 'custom-stairmaster',
  });
});
