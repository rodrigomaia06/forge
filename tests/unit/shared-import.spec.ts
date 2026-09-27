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

test('renames a shared workout that clashes by name and reports it', () => {
  const renamed: { from: string; to: string }[] = [];
  const out = renameSharedWorkouts([{ id: 'w2', name: 'Pull' } as any], ['Pull'], renamed);
  expect(out[0].name).toBe('Pull - imported');
  expect(renamed).toEqual([{ from: 'Pull', to: 'Pull - imported' }]);
});
