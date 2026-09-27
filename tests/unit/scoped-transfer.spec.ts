import { expect, test } from '@playwright/test';
import { scopedTransferFrom, type ScopedTransferState } from '../../src/data/scopedTransferCore';
import type { SettingsPreferences } from '../../src/types';

const customType = { id: 't1', name: 'Conditioning', color: '#123456' };
const exercise = (exerciseId?: string) => ({ id: `rex-${Math.random()}`, exerciseId, name: exerciseId ?? 'x', sets: [] });
const routine = {
  id: 'r1', name: 'Push Day', type: 'Conditioning', createdAt: 1, updatedAt: 1,
  // References one custom exercise and one built-in catalogue exercise.
  exercises: [exercise('custom-1'), exercise('bench')],
};

function state(over: Partial<ScopedTransferState> = {}): ScopedTransferState {
  return {
    settings: { workoutTypes: [customType], bodyweightKg: 99 } as unknown as SettingsPreferences,
    plans: { plans: [], standaloneRoutines: [] },
    workouts: { activeWorkout: null, completedWorkouts: [] },
    customExercises: [
      { id: 'custom-1', name: 'My Squat', group: 'Legs' },
      { id: 'custom-2', name: 'Other', group: 'Arms' },
    ],
    ...over,
  } as unknown as ScopedTransferState;
}

test('routine share carries the routine, its custom exercise, and its custom type only', () => {
  const transfer = scopedTransferFrom(
    state({ plans: { plans: [], standaloneRoutines: [routine as any] } }),
    { kind: 'routine', id: 'r1' },
  );
  expect(transfer.plans.standaloneRoutines).toHaveLength(1);
  expect(transfer.plans.plans).toHaveLength(0);
  // Only the referenced custom exercise; the built-in 'bench' and unreferenced 'custom-2' are excluded.
  expect(transfer.customExercises.map((item) => item.id)).toEqual(['custom-1']);
  expect(transfer.settings.workoutTypes).toHaveLength(1);
  expect(transfer.workouts.completedWorkouts).toHaveLength(0);
  expect(transfer.share).toMatchObject({ kind: 'routine', title: 'Push Day', summary: '2 exercises' });
  expect(transfer.selection).toMatchObject({ plans: true, exercises: true, workoutTypes: true, workouts: false });
});

test('a routine inside a plan is shared as a standalone with its planId cleared', () => {
  const planRoutine = { ...routine, id: 'r2', planId: 'p1' };
  const transfer = scopedTransferFrom(
    state({ plans: { plans: [{ id: 'p1', name: 'Plan', routines: [planRoutine], createdAt: 1, updatedAt: 1 } as any], standaloneRoutines: [] } }),
    { kind: 'routine', id: 'r2' },
  );
  expect(transfer.plans.plans).toHaveLength(0);
  expect(transfer.plans.standaloneRoutines).toHaveLength(1);
  expect(transfer.plans.standaloneRoutines[0].planId).toBeUndefined();
});

test('routine share leaks no history and no personal preferences', () => {
  const transfer = scopedTransferFrom(
    state({
      plans: { plans: [], standaloneRoutines: [routine as any] },
      workouts: { activeWorkout: null, completedWorkouts: [{ id: 'w9', name: 'Old', type: 'Strength', exercises: [] } as any] },
    }),
    { kind: 'routine', id: 'r1' },
  );
  expect(transfer.workouts.completedWorkouts).toHaveLength(0);
  // Output settings come from defaults, not the sharer's bodyweight.
  expect((transfer.settings as any).bodyweightKg).not.toBe(99);
});

test('plan share carries the plan with its routines and dependencies', () => {
  const plan = { id: 'p1', name: 'PPL', createdAt: 1, updatedAt: 1, routines: [routine] };
  const transfer = scopedTransferFrom(state({ plans: { plans: [plan as any], standaloneRoutines: [] } }), { kind: 'plan', id: 'p1' });
  expect(transfer.plans.plans).toHaveLength(1);
  expect(transfer.plans.plans[0].routines).toHaveLength(1);
  expect(transfer.customExercises.map((item) => item.id)).toEqual(['custom-1']);
  expect(transfer.share).toMatchObject({ kind: 'plan', title: 'PPL', summary: '1 routine' });
});

test('workout share carries the record and deps; a built-in type is not bundled', () => {
  const workout = { id: 'w1', name: 'Morning', type: 'Strength', startedAt: 1, completedAt: 2, durationSeconds: 60, exercises: [exercise('custom-1')] };
  const transfer = scopedTransferFrom(state({ workouts: { activeWorkout: null, completedWorkouts: [workout as any] } }), { kind: 'workout', id: 'w1' });
  expect(transfer.workouts.completedWorkouts).toHaveLength(1);
  expect(transfer.plans.plans).toHaveLength(0);
  expect(transfer.customExercises.map((item) => item.id)).toEqual(['custom-1']);
  expect(transfer.settings.workoutTypes).toHaveLength(0);
  expect(transfer.share).toMatchObject({ kind: 'workout' });
  expect(transfer.selection).toMatchObject({ workouts: true, plans: false });
});

test('custom exercise share carries only that exercise', () => {
  const transfer = scopedTransferFrom(state(), { kind: 'exercise', id: 'custom-2' });
  expect(transfer.customExercises.map((item) => item.id)).toEqual(['custom-2']);
  expect(transfer.plans.plans).toHaveLength(0);
  expect(transfer.workouts.completedWorkouts).toHaveLength(0);
  expect(transfer.share).toMatchObject({ kind: 'exercise', title: 'Other' });
});

test('a missing item throws rather than sharing an empty transfer', () => {
  expect(() => scopedTransferFrom(state(), { kind: 'routine', id: 'nope' })).toThrow();
  expect(() => scopedTransferFrom(state(), { kind: 'exercise', id: 'nope' })).toThrow();
});
