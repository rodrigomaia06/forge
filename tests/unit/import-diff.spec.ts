import { expect, test } from '@playwright/test';
import { detectShareConflict, type ShareCurrentState } from '../../src/data/importDiff';
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
