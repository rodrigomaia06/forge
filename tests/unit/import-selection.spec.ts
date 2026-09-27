import { expect, test } from '@playwright/test';
import { emptyImportSelection, filterTransferToSelection, transferItems } from '../../src/data/importSelection';
import type { ForgeDataTransfer } from '../../src/data/transferFormat';

const transfer = (): ForgeDataTransfer => ({
  format: 'forge-data', version: 1, exportedAt: '',
  settings: {
    workoutTypes: [{ id: 't1', name: 'Type 1' }, { id: 't2', name: 'Type 2' }],
    dailyMeasurementDefinitions: [{ id: 'm1', name: 'Weight' }],
    dailyMeasurementEntries: [{ id: 'e1', definitionId: 'm1' }, { id: 'e2', definitionId: 'mX' }],
  } as unknown as ForgeDataTransfer['settings'],
  plans: {
    plans: [{ id: 'p1', name: 'Plan 1', routines: [], createdAt: 0, updatedAt: 0 }] as any,
    standaloneRoutines: [
      { id: 'r1', name: 'Routine 1', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 },
      { id: 'r2', name: 'Routine 2', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 },
    ] as any,
  },
  workouts: { activeWorkout: null, completedWorkouts: [{ id: 'w1', name: 'W1', exercises: [], completedAt: 0, startedAt: 0 }] as any },
  customExercises: [{ id: 'c1', name: 'Custom 1', group: 'Legs' }] as any,
});

test('transferItems enumerates each non-empty category', () => {
  const items = transferItems(transfer());
  expect(items.workouts.map((i) => i.id)).toEqual(['w1']);
  expect(items.plans.map((i) => i.id)).toEqual(['p1']);
  expect(items.routines.map((i) => i.id)).toEqual(['r1', 'r2']);
  expect(items.exercises.map((i) => i.id)).toEqual(['c1']);
  expect(items.workoutTypes.map((i) => i.id)).toEqual(['t1', 't2']);
  expect(items.measurements.map((i) => i.id)).toEqual(['m1']);
});

test('filterTransferToSelection keeps only chosen records', () => {
  const sel = emptyImportSelection();
  sel.routines.add('r1');
  sel.workoutTypes.add('t2');
  const out = filterTransferToSelection(transfer(), sel);
  expect(out.plans.standaloneRoutines.map((r) => r.id)).toEqual(['r1']);
  expect(out.plans.plans).toHaveLength(0);
  expect(out.workouts.completedWorkouts).toHaveLength(0);
  expect(out.settings.workoutTypes.map((t) => t.id)).toEqual(['t2']);
  expect(out.selection).toMatchObject({ plans: true, workouts: false, workoutTypes: true, exercises: false });
});

test('measurement entries follow their selected definition', () => {
  const sel = emptyImportSelection();
  sel.measurements.add('m1');
  const out = filterTransferToSelection(transfer(), sel);
  expect(out.settings.dailyMeasurementDefinitions.map((d) => d.id)).toEqual(['m1']);
  expect(out.settings.dailyMeasurementEntries.map((e) => e.id)).toEqual(['e1']);
});
