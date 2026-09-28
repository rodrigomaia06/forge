import { expect, test } from '@playwright/test';
import { freshenSharedIds, renameSharedWorkouts } from '../../src/data/sharedImport';
import type { ForgeDataTransfer } from '../../src/data/transferFormat';

const transfer = (over: Partial<ForgeDataTransfer>): ForgeDataTransfer => ({
  format: 'forge-data',
  version: 1,
  exportedAt: '',
  settings: { workoutTypes: [], dailyMeasurementDefinitions: [], dailyMeasurementEntries: [] } as unknown as ForgeDataTransfer['settings'],
  plans: { plans: [], standaloneRoutines: [] },
  workouts: { activeWorkout: null, completedWorkouts: [] },
  customExercises: [],
  ...over,
});

test('freshens a shared routine id so it always imports as new', () => {
  const out = freshenSharedIds(transfer({
    share: { kind: 'routine', title: 'X' },
    plans: { plans: [], standaloneRoutines: [{ id: 'r1', name: 'X' } as any] },
  }));
  expect(out.plans.standaloneRoutines[0].id).not.toBe('r1');
});

test('freshens a shared workout id', () => {
  const out = freshenSharedIds(transfer({
    share: { kind: 'workout', title: 'W' },
    workouts: { activeWorkout: null, completedWorkouts: [{ id: 'w1', name: 'W' } as any] },
  }));
  expect(out.workouts.completedWorkouts[0].id).not.toBe('w1');
});

test('leaves a non-share transfer untouched (idempotent backup)', () => {
  const out = freshenSharedIds(transfer({ plans: { plans: [], standaloneRoutines: [{ id: 'r1', name: 'X' } as any] } }));
  expect(out.plans.standaloneRoutines[0].id).toBe('r1');
});

test('renames a shared workout that clashes by name with a different one', () => {
  const renamed: { from: string; to: string }[] = [];
  const skipped: string[] = [];
  // Same name, different content -> kept as a numbered copy, not "- imported".
  const out = renameSharedWorkouts(
    [{ id: 'w2', name: 'Pull', note: 'new' } as any],
    [{ id: 'w1', name: 'Pull', note: 'old' } as any],
    renamed,
    skipped,
  );
  expect(out[0].name).toBe('Pull 2');
  expect(renamed).toEqual([{ from: 'Pull', to: 'Pull 2' }]);
  expect(skipped).toEqual([]);
});

test('skips a shared workout the device already has verbatim (no "- imported")', () => {
  const renamed: { from: string; to: string }[] = [];
  const skipped: string[] = [];
  // Identical content, only the freshly-minted id differs -> skipped entirely.
  const out = renameSharedWorkouts(
    [{ id: 'w2', name: 'Pull', note: 'same' } as any],
    [{ id: 'w1', name: 'Pull', note: 'same' } as any],
    renamed,
    skipped,
  );
  expect(out).toEqual([]);
  expect(renamed).toEqual([]);
  expect(skipped).toEqual(['Pull']);
});

test('imports a genuinely new shared workout under its own name', () => {
  const renamed: { from: string; to: string }[] = [];
  const skipped: string[] = [];
  const out = renameSharedWorkouts([{ id: 'w2', name: 'Legs' } as any], [], renamed, skipped);
  expect(out[0].name).toBe('Legs');
  expect(renamed).toEqual([]);
  expect(skipped).toEqual([]);
});
