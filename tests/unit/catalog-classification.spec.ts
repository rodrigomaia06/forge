import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exerciseCatalog, taxonomyLabel } from '../../src/data/exerciseCatalog';
import { canonicalizeExercise } from '../../src/data/exerciseCanonicalization';

test('reviewed movement instructions determine categories and measurements', () => {
  for (const [id, category, type, tracking] of [
    ['kinetic-frog-hops', 'plyometrics', 'plyometrics', 'reps-only'],
    ['kinetic-kneeling-jump-squat', 'plyometrics', 'plyometrics', 'weight-reps'],
    ['kinetic-isometric-chest-squeezes', 'chest', 'strength', 'duration'],
    ['kinetic-superman', 'back', 'calisthenics', 'bodyweight-reps'],
    ['kinetic-romanian-deadlift-from-deficit', 'hamstrings', 'strength', 'weight-reps'],
    ['kinetic-carioca-quick-step', 'cardio', 'cardio', 'duration'],
    ['kinetic-hamstring-smr', 'mobility', 'mobility', 'duration'],
    ['kinetic-arm-circles', 'mobility', 'mobility', 'reps-only'],
    ['running', 'cardio', 'cardio', 'distance-duration'],
    ['cycling', 'cardio', 'cardio', 'distance-duration'],
    ['swimming', 'cardio', 'cardio', 'distance-duration'],
  ]) {
    const exercise = exerciseCatalog.find((item) => item.id === id);
    expect(exercise, id).toBeDefined();
    expect(exercise?.category, id).toBe(taxonomyLabel('categories', category));
    expect(exercise?.workoutTypeIds, id).toContain(type);
    expect(exercise?.trackingType, id).toBe(tracking);
  }
});

test('canonical corrections retain recorded values and user metadata', () => {
  const sets = [{ id: 's', weight: '8', reps: '12', completed: true }];
  const saved = {
    id: 'instance',
    exerciseId: 'kinetic-frog-hops',
    name: 'Frog Hops',
    trackingType: 'bodyweight-reps' as const,
    notes: 'Keep this',
    sets,
  };
  const repaired = canonicalizeExercise(saved);
  expect(repaired.trackingType).toBe('reps-only');
  expect(repaired.sets).toBe(sets);
  expect(repaired.notes).toBe(saved.notes);
  expect(canonicalizeExercise({ ...saved, exerciseId: 'custom-frog-hops' })).toEqual({
    ...saved,
    exerciseId: 'custom-frog-hops',
  });
});

test('release audit rejects independently corrupted category, tracking, and apparatus mappings', () => {
  const directory = mkdtempSync(join(tmpdir(), 'forge-classification-'));
  try {
    for (const [id, patch] of [
      ['running', { workoutTypeIds: ['strength'] }],
      ['kinetic-hamstring-smr', { trackingType: 'weight-reps' }],
      ['kinetic-frog-hops', { category: 'mobility', workoutTypeIds: ['mobility'] }],
      ['kinetic-stairmaster', { primaryEquipment: 'machine', equipment: ['machine'] }],
    ] as const) {
      const catalog = JSON.parse(
        readFileSync('src/data/catalog/forge_exercise_catalog_v3_flat.json', 'utf8'),
      );
      Object.assign(
        catalog.exercises.find((item: { id: string }) => item.id === id),
        patch,
      );
      const file = join(directory, 'catalog.json');
      writeFileSync(file, JSON.stringify(catalog));
      const result = spawnSync(
        process.execPath,
        ['scripts/audit-catalog-classification.mjs', '--catalog', file],
        { encoding: 'utf8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(id);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
