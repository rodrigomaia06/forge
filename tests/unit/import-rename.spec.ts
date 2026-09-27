import { expect, test } from '@playwright/test';
import { mergeImportedPlans } from '../../src/data/dataTransferPlans';
import type { PlansState, WorkoutRoutine } from '../../src/types';

const routine = (id: string, name: string): WorkoutRoutine =>
  ({ id, name, type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 } as unknown as WorkoutRoutine);
const state = (standaloneRoutines: WorkoutRoutine[]): PlansState => ({ plans: [], standaloneRoutines });

test('renames an imported routine that collides with an existing name', () => {
  const merged = mergeImportedPlans(state([routine('r1', 'Chest')]), state([routine('r2', 'Chest')]));
  const names = merged.standaloneRoutines.map((r) => r.name);
  expect(merged.standaloneRoutines).toHaveLength(2);
  expect(names).toContain('Chest');
  expect(names).toContain('Chest - imported');
});

test('increments the suffix for further collisions', () => {
  const current = state([routine('r1', 'Chest'), routine('r2', 'Chest - imported')]);
  const merged = mergeImportedPlans(current, state([routine('r3', 'Chest')]));
  expect(merged.standaloneRoutines.map((r) => r.name)).toContain('Chest - imported 2');
});

test('does not rename an update to the same id', () => {
  const merged = mergeImportedPlans(state([routine('r1', 'Chest')]), state([routine('r1', 'Chest')]));
  expect(merged.standaloneRoutines).toHaveLength(1);
  expect(merged.standaloneRoutines[0].name).toBe('Chest');
});

test('a differently-named import keeps its name', () => {
  const merged = mergeImportedPlans(state([routine('r1', 'Chest')]), state([routine('r2', 'Back')]));
  expect(merged.standaloneRoutines.map((r) => r.name).sort()).toEqual(['Back', 'Chest']);
});
