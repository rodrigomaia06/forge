import { expect, test } from '@playwright/test';
import { applyShareUpdate, detectShareConflict, type ShareCurrentState } from '../../src/data/importDiff';
import type { ForgeDataTransfer } from '../../src/data/transferFormat';
import type { WorkoutRoutine } from '../../src/types';

const routine = (over: Partial<WorkoutRoutine>): WorkoutRoutine =>
  ({ id: 'r', name: 'Push Day', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0, ...over } as WorkoutRoutine);

const sharedRoutine = (item: WorkoutRoutine): ForgeDataTransfer => ({
  format: 'forge-data',
  version: 1,
  exportedAt: '',
  share: { kind: 'routine', title: item.name },
  settings: { workoutTypes: [], dailyMeasurementDefinitions: [], dailyMeasurementEntries: [] } as unknown as ForgeDataTransfer['settings'],
  plans: { plans: [], standaloneRoutines: [item] },
  workouts: { activeWorkout: null, completedWorkouts: [] },
  customExercises: [],
});

const current = (routines: WorkoutRoutine[]): ShareCurrentState => ({
  plans: { plans: [], standaloneRoutines: routines },
  workouts: [],
  exercises: [],
});

test('returns null for a content-identical re-import', () => {
  // Same content, only a freshly-minted id differs -> would be skipped, not a conflict.
  const conflict = detectShareConflict(sharedRoutine(routine({ id: 'in' })), current([routine({ id: 'ex' })]));
  expect(conflict).toBeNull();
});

test('returns null for a genuinely new item (no same-name match)', () => {
  const conflict = detectShareConflict(
    sharedRoutine(routine({ id: 'in', name: 'Pull Day' })),
    current([routine({ id: 'ex', name: 'Push Day' })]),
  );
  expect(conflict).toBeNull();
});

test('returns a populated conflict for a same-named routine with different exercises', () => {
  const existing = routine({
    id: 'ex',
    note: 'old note',
    exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ id: 's1' }] }],
  });
  const incoming = sharedRoutine(
    routine({
      id: 'in',
      note: 'new note',
      exercises: [
        { id: 'e2', name: 'Bench Press', sets: [{ id: 's1' }, { id: 's2' }] },
        { id: 'e3', name: 'Incline Press', sets: [] },
      ],
    }),
  );
  const conflict = detectShareConflict(incoming, current([existing]));
  expect(conflict).not.toBeNull();
  expect(conflict!.kind).toBe('routine');
  expect(conflict!.name).toBe('Push Day');
  expect(conflict!.existingId).toBe('ex');
  const changes = conflict!.changes.map((change) => `${change.type}:${change.label}`);
  expect(changes).toContain('changed:Note'); // scalar before->after
  expect(changes).toContain('changed:Bench Press'); // set-count change
  expect(changes).toContain('added:Incline Press'); // new child
  const benchChange = conflict!.changes.find((change) => change.label === 'Bench Press');
  expect(benchChange?.detail).toBe('1 → 2 sets');
  expect(conflict!.summary).toContain('exercise');
});

test('detects a removed child exercise', () => {
  const existing = routine({
    id: 'ex',
    exercises: [
      { id: 'e1', name: 'Bench Press', sets: [] },
      { id: 'e2', name: 'Dips', sets: [] },
    ],
  });
  const incoming = sharedRoutine(routine({ id: 'in', exercises: [{ id: 'e3', name: 'Bench Press', sets: [{ id: 's1' }] }] }));
  const conflict = detectShareConflict(incoming, current([existing]));
  const changes = conflict!.changes.map((change) => `${change.type}:${change.label}`);
  expect(changes).toContain('removed:Dips');
});

test('applyShareUpdate applies only the checked change units, in place', () => {
  const existing = routine({
    id: 'ex',
    note: 'old note',
    exercises: [
      { id: 'e1', name: 'Bench Press', sets: [] },
      { id: 'e2', name: 'Squat', sets: [] },
    ],
  });
  const incoming = sharedRoutine(
    routine({
      id: 'in',
      note: 'new note',
      exercises: [
        { id: 'e1', name: 'Bench Press', sets: [] },
        { id: 'e3', name: 'Overhead Press', sets: [] },
      ],
    }),
  );
  const conflict = detectShareConflict(incoming, current([existing]))!;
  const ids = Object.fromEntries(conflict.changes.map((change) => [`${change.type}:${change.label}`, change.id]));

  // Only the checked units apply: keep the removed Squat, exclude the added Overhead.
  const partial = applyShareUpdate(existing, conflict, [ids['removed:Squat']]);
  expect(partial.id).toBe('ex'); // clone preserves identity for an in-place write
  expect(partial.note).toBe('old note'); // Note change unchecked -> unchanged
  expect(partial.exercises.map((e) => e.name)).toEqual(['Bench Press']); // Squat dropped, Overhead not added

  // All checked == a full update: every field + child change applied.
  const full = applyShareUpdate(existing, conflict, conflict.changes.map((change) => change.id));
  expect(full.note).toBe('new note');
  expect(full.exercises.map((e) => e.name).sort()).toEqual(['Bench Press', 'Overhead Press']);

  // Nothing checked leaves the existing item untouched.
  const none = applyShareUpdate(existing, conflict, []);
  expect(none.note).toBe('old note');
  expect(none.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Squat']);
});
