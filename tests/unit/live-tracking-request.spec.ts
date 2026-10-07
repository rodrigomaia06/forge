import { test, expect } from '@playwright/test';
import { applyLiveTrackingChange } from '../../src/domain/exercises/trackingChanges';
import { reduceActiveWorkout } from '../../src/state/useActiveWorkoutState';
import type { Workout, WorkoutExercise } from '../../src/types';

function session(): Workout {
  const block: WorkoutExercise = {
    id: 'block',
    exerciseId: 'pull-up',
    name: 'Weighted Pull-Up',
    trackingType: 'weighted-bodyweight',
    trackingOverride: 'weighted-bodyweight-duration',
    note: 'Keep',
    supersetId: 'pair',
    sets: [
      {
        id: 'set',
        weight: '15',
        reps: '',
        completed: false,
        measurements: [{ id: 'load', kind: 'addedWeight', unit: 'kg', value: 15 }],
      },
    ],
  };
  return {
    id: 'workout',
    name: 'Pull',
    type: 'Strength',
    startedAt: 1,
    completedAt: null,
    note: '',
    exercises: [block, { ...block, id: 'other' }],
  };
}
const ids = ['s1', 's2', 's3'];
const request = {
  kind: 'tracking' as const,
  id: 'request',
  blockId: 'block',
  mode: 'weighted-bodyweight' as const,
  confirmed: false,
  ids,
  history: [],
};

test('requests see queued edits and match the block rather than the repeated movement', () => {
  const current = session();
  const edited = reduceActiveWorkout(
    { workout: current },
    {
      kind: 'update',
      update: (workout) => ({
        ...workout!,
        exercises: workout!.exercises.map((block) =>
          block.id === 'block'
            ? {
                ...block,
                sets: block.sets.map((set) => ({
                  ...set,
                  measurements: [
                    ...set.measurements!,
                    { id: 'time', kind: 'duration' as const, unit: 'sec' as const, value: 45 },
                  ],
                })),
              }
            : block,
        ),
      }),
    },
  );
  const result = reduceActiveWorkout(edited, request);
  expect(result.workout).toBe(edited.workout);
  expect(result.receipt?.result.status).toBe('confirmation');
  expect(result.workout?.exercises[1]).toBe(current.exercises[1]);
  const confirmed = reduceActiveWorkout(result, { ...request, id: 'confirm', confirmed: true });
  expect(confirmed.receipt?.result.status).toBe('applied');
  expect(confirmed.workout?.exercises[0].trackingOverride).toBe('weighted-bodyweight');
  expect(confirmed.workout?.exercises[0].sets).toEqual(
    ids.map((id) => ({ id, weight: '', reps: '', completed: false })),
  );
  expect(confirmed.workout?.exercises[1]).toBe(current.exercises[1]);
});

test('target-only drafts require confirmation and cancel leaves the original untouched', () => {
  const workout = session();
  workout.exercises[0].sets[0].weight = '';
  workout.exercises[0].sets[0].measurements = [];
  workout.exercises[0].sets[0].targets = [
    { id: 'target', kind: 'duration', unit: 'sec', minValue: 40 },
  ];
  const { result, workout: unchanged } = applyLiveTrackingChange(
    workout,
    'block',
    'weighted-bodyweight',
    false,
    ids,
    [],
  );
  expect(result.status).toBe('confirmation');
  expect(unchanged).toBe(workout);
  const applied = applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight', true, ids, []);
  expect(applied.workout?.exercises[0].sets[0].targets).toBeUndefined();
});

test('a completed side requires consent then discards sets in the same block', () => {
  const workout = session();
  workout.exercises[0].sets[0].sideCompletion = { left: true, right: false };
  const pending = applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight', false, ids, []);
  expect(pending.result.status).toBe('confirmation');
  expect(pending.workout).toBe(workout);
  const applied = applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight', true, ids, []);
  expect(applied.workout?.exercises).toHaveLength(2);
  expect(applied.workout?.exercises[0]).toMatchObject({
    id: 'block',
    exerciseId: 'pull-up',
    note: 'Keep',
    supersetId: 'pair',
    trackingOverride: 'weighted-bodyweight',
  });
  expect(applied.workout?.exercises[0].sets).toEqual(
    ids.map((id) => ({ id, weight: '', reps: '', completed: false })),
  );
  expect(applied.workout?.exercises[1]).toBe(workout.exercises[1]);
});

test('missing blocks and incompatible modes never silently acknowledge a change', () => {
  const workout = session();
  expect(
    applyLiveTrackingChange(workout, 'pull-up', 'weighted-bodyweight', true, ids, []).result.status,
  ).toBe('missing');
  expect(applyLiveTrackingChange(workout, 'block', 'distance', true, ids, []).result.status).toBe(
    'incompatible',
  );
});

test('replaying a request is deterministic and the current mode is unchanged', () => {
  const workout = session();
  workout.exercises[0].sets[0].completed = true;
  const one = reduceActiveWorkout({ workout }, request);
  const two = reduceActiveWorkout({ workout }, request);
  expect(one).toEqual(two);
  expect(
    applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight-duration', false, ids, []).result
      .status,
  ).toBe('unchanged');
});

test('a failed projection acknowledges failure without partially modifying the workout', () => {
  const workout = session();
  const result = reduceActiveWorkout(
    { workout },
    { ...request, confirmed: true, history: [{ ...session(), completedAt: 1, exercises: null! }] },
  );
  expect(result.receipt?.result.status).toBe('failed');
  expect(result.workout).toBe(workout);
  const retry = reduceActiveWorkout(result, { ...request, confirmed: true });
  expect(retry.receipt?.result.status).toBe('applied');
});

test('even compatible load alone requires discard confirmation; selecting the current mode does not', () => {
  const workout = session();
  const result = applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight', false, ids, []);
  expect(result.result.status).toBe('confirmation');
  expect(result.workout).toBe(workout);
  expect(
    applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight-duration', true, ids, [])
      .workout,
  ).toBe(workout);
});

test('an empty block changes mode immediately and retains its empty set structure', () => {
  const workout = session();
  workout.exercises[0].sets = [
    { id: 'empty', weight: '', reps: '', completed: false, previous: 'Last session' },
  ];
  const changed = applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight', false, ids, []);
  expect(changed.result).toEqual({
    status: 'applied',
    blockId: 'block',
    mode: 'weighted-bodyweight',
  });
  expect(changed.workout?.exercises[0].sets).toHaveLength(1);
  expect(changed.workout?.exercises[0].sets[0].id).toBe('empty');
});
