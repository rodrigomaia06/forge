import { expect, test } from '@playwright/test';
import { mergeImportedPlans } from '../../src/data/dataTransferPlans';
import type { PlansState, WorkoutRoutine } from '../../src/types';

const routine = (id: string, name: string, note = ''): WorkoutRoutine =>
  ({ id, name, note, type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 } as unknown as WorkoutRoutine);
const state = (standaloneRoutines: WorkoutRoutine[]): PlansState => ({ plans: [], standaloneRoutines });

test('keeps a same-named but different import as a numbered copy', () => {
  // Different content (note) with a clashing name -> "Chest 2", not "- imported".
  const merged = mergeImportedPlans(state([routine('r1', 'Chest', 'old')]), state([routine('r2', 'Chest', 'new')]));
  const names = merged.standaloneRoutines.map((r) => r.name);
  expect(merged.standaloneRoutines).toHaveLength(2);
  expect(names).toContain('Chest');
  expect(names).toContain('Chest 2');
});

test('increments the number for further collisions', () => {
  const current = state([routine('r1', 'Chest', 'a'), routine('r2', 'Chest 2', 'b')]);
  const merged = mergeImportedPlans(current, state([routine('r3', 'Chest', 'c')]));
  expect(merged.standaloneRoutines.map((r) => r.name)).toContain('Chest 3');
});

test('skips a content-identical re-import instead of adding a copy', () => {
  const skipped: string[] = [];
  // Same content, only a freshly-minted id differs -> not added, reported skipped.
  const merged = mergeImportedPlans(
    state([routine('r1', 'Chest', 'same')]),
    state([routine('r2', 'Chest', 'same')]),
    [],
    skipped,
  );
  expect(merged.standaloneRoutines).toHaveLength(1);
  expect(merged.standaloneRoutines[0].name).toBe('Chest');
  expect(skipped).toEqual(['Chest']);
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
