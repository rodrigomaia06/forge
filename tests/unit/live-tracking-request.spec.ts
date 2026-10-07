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
const ids = ['new-block', 's1', 's2', 's3'];
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
  expect(confirmed.workout?.exercises[0].sets[0]).toMatchObject({
    id: 'set',
    weight: '15',
    measurements: [{ id: 'load', kind: 'addedWeight', unit: 'kg', value: 15 }],
  });
  expect(confirmed.workout?.exercises[1]).toBe(current.exercises[1]);
});

test('target-only drafts require confirmation and cancel leaves the original untouched', () => {
  const workout = session();
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
  expect(applied.workout?.exercises[0].sets[0].targets).toEqual([]);
});

test('a completed side arriving before confirmation protects the original block', () => {
  const workout = session();
  workout.exercises[0].sets[0].sideCompletion = { left: true, right: false };
  const applied = applyLiveTrackingChange(workout, 'block', 'weighted-bodyweight', true, ids, []);
  expect(applied.workout?.exercises[0]).toBe(workout.exercises[0]);
  expect(applied.workout?.exercises[1]).toMatchObject({
    id: 'new-block',
    exerciseId: 'pull-up',
    note: 'Keep',
    supersetId: 'pair',
    trackingOverride: 'weighted-bodyweight',
  });
  expect(
    applied.workout?.exercises[1].sets.map((set) => [set.weight, set.reps, set.completed]),
  ).toEqual([
    ['', '', false],
    ['', '', false],
    ['', '', false],
  ]);
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
    { ...request, history: [{ ...session(), completedAt: 1, exercises: null! }] },
  );
  expect(result.receipt?.result.status).toBe('failed');
  expect(result.workout).toBe(workout);
  const retry = reduceActiveWorkout(result, request);
  expect(retry.receipt?.result.status).toBe('applied');
});
