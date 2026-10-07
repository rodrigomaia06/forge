import { normalizeDataTransfer } from '../../src/data/dataTransferNormalization';
import { computeWorkoutVolume } from '../../src/screens/dashboard/dashboardSummary';
import { routineExercisesWithNextSessionTargets } from '../../src/domain/workouts/nextSessionTargets';
import { test, expect } from '@playwright/test';
import {
  effectiveTracking,
  parseDuration,
  formatDuration,
  missingTrackingFields,
  trackingChoices,
  trackingFields,
  measurementUnit,
} from '../../src/domain/exercises/tracking';
import {
  changeExerciseTracking,
  losesTrackingData,
} from '../../src/domain/exercises/trackingChanges';
import {
  workoutFinishSummary,
  workoutNeedsFinishReview,
  finishRoutineState,
} from '../../src/domain/workouts/finishWorkout';
import {
  hasRoutineStructureChanged,
  routineStructureBaseline,
} from '../../src/domain/workouts/routineStructure';
import { exercisesWithAddedPrevious } from '../../src/domain/workouts/nextSessionTargets';
import { canonicalizeExercise } from '../../src/data/exerciseCanonicalization';
import { writeWebWorkoutFinish, type FinishStorage } from '../../src/data/webWorkoutFinish';
import type { Workout, WorkoutExercise, PlansState } from '../../src/types';

const exercise = (): WorkoutExercise => ({
  id: 'ex',
  exerciseId: 'kinetic-barbell-bench-press',
  name: 'Barbell Bench Press',
  trackingType: 'weight-reps',
  note: 'Reusable note',
  supersetId: 'pair',
  sets: [
    {
      id: 's',
      weight: '50',
      reps: '8',
      completed: false,
      plannedTargets: [{ id: 't', kind: 'reps', unit: 'count', minValue: 8, maxValue: 10 }],
    },
  ],
});
const workout = (): Workout => ({
  id: 'w',
  name: 'Push',
  type: 'Strength',
  startedAt: 1,
  completedAt: 1000,
  routineId: 'r',
  planId: 'p',
  note: 'Session note',
  exercises: [exercise()],
  routineStructureBaseline: routineStructureBaseline([exercise()]),
});
const plans = (): PlansState => ({
  plans: [
    {
      id: 'p',
      name: 'Plan',
      createdAt: 1,
      updatedAt: 1,
      routines: [
        {
          id: 'r',
          name: 'Push',
          type: 'Strength',
          planId: 'p',
          createdAt: 1,
          updatedAt: 1,
          exercises: [exercise()],
        },
      ],
    },
  ],
  standaloneRoutines: [],
});
let id = 0;
const fresh = () => `fresh-${++id}`;

test('finish review is required only for incomplete work or a routine decision', () => {
  const source = plans().plans[0].routines[0];
  const completed = workout();
  completed.exercises[0].sets[0].completed = true;
  expect(workoutNeedsFinishReview(completed, source)).toBe(false);
  expect(workoutNeedsFinishReview({ ...completed, routineId: undefined })).toBe(true);
  expect(workoutNeedsFinishReview(completed)).toBe(true);
  expect(workoutNeedsFinishReview(workout(), source)).toBe(true);
  expect(workoutNeedsFinishReview({ ...completed, exercises: [] })).toBe(false);
  const changed = {
    ...completed,
    exercises: [{ ...completed.exercises[0], trackingOverride: 'duration-weight' as const }],
  };
  expect(workoutNeedsFinishReview(changed, source)).toBe(true);
  completed.exercises[0].sets[0].sideCompletion = { left: true, right: false };
  expect(workoutNeedsFinishReview(completed, source)).toBe(true);
});

test('resolution, catalogue normalization and compatible choices preserve an explicit override', () => {
  const saved = { ...exercise(), trackingOverride: 'duration-weight' as const };
  expect(effectiveTracking(canonicalizeExercise(saved))).toBe('duration-weight');
  expect(
    effectiveTracking({
      exerciseSnapshot: { trackingType: 'duration' },
      trackingType: 'weight-reps',
    }),
  ).toBe('duration');
  expect(effectiveTracking({})).toBe('weight-reps');
  expect(trackingChoices({ trackingType: 'assisted-bodyweight' })).toEqual([
    'assisted-bodyweight',
    'assisted-bodyweight-duration',
  ]);
  expect(trackingChoices({ trackingType: 'distance-duration' })).toEqual([
    'distance',
    'duration',
    'distance-duration',
  ]);
});
test('duration parsing and all selected fields determine validation', () => {
  expect(parseDuration('90')).toBe(90);
  expect(parseDuration('1:30')).toBe(90);
  expect(parseDuration('1,30')).toBe(90);
  expect(parseDuration('1,02,30')).toBe(3750);
  expect(parseDuration('1:02:30')).toBe(3750);
  expect(formatDuration(3750)).toBe('1:02:30');
  expect(parseDuration('1:60:00')).toBeNaN();
  expect(parseDuration('')).toBeNaN();
  expect(parseDuration('abc')).toBeNaN();
  expect(formatDuration(90)).toBe('01:30');
  expect(parseDuration('1:60')).toBeNaN();
  expect(parseDuration('1:')).toBeNaN();
  const set = {
    ...exercise().sets[0],
    measurements: [{ id: 'd', kind: 'distance' as const, unit: 'km' as const, value: 2 }],
  };
  expect(missingTrackingFields('distance', set)).toEqual([]);
  expect(missingTrackingFields('distance-duration', set)).toEqual(['duration']);
  expect(missingTrackingFields('duration-weight', set)).toEqual(['duration']);
});
test('in-place switching clears incompatible drafts and keeps compatible loads', () => {
  const before = exercise();
  expect(losesTrackingData(before, 'duration-weight')).toBe(true);
  const [after] = changeExerciseTracking([before], before.id, 'duration-weight', fresh);
  expect(after.id).toBe(before.id);
  expect(after.sets[0].weight).toBe('50');
  expect(after.sets[0].reps).toBe('');
  expect(after.sets[0].plannedTargets).toEqual([]);
  expect(before.sets[0].reps).toBe('8');
  expect(hasRoutineStructureChanged({ ...workout(), exercises: [after] })).toBe(true);
});
for (const side of [false, true])
  test(`completed ${side ? 'side' : 'set'} creates a protected new block`, () => {
    const before = exercise();
    before.sets[0] = {
      ...before.sets[0],
      completed: !side,
      sideCompletion: side ? { left: true, right: false } : undefined,
    };
    const after = changeExerciseTracking([before], before.id, 'duration-weight', fresh);
    expect(after[0]).toBe(before);
    expect(after).toHaveLength(2);
    expect(after[1].sets).toHaveLength(3);
    expect(after[1].sets.every((set) => !set.completed && !set.reps && !set.weight)).toBe(true);
    expect(after[1].note).toBe(before.note);
    expect(after[1].supersetId).toBe(before.supersetId);
    expect(workoutFinishSummary({ ...workout(), exercises: [before] }).incomplete).toBe(
      side ? 1 : 0,
    );
  });
test('history matches mode and occurrence', () => {
  const first = exercise();
  const second = { ...exercise(), id: 'second', sets: [{ ...exercise().sets[0], weight: '80' }] };
  const timed = { ...exercise(), id: 'timed', trackingOverride: 'duration-weight' as const };
  const result = exercisesWithAddedPrevious(
    [first, second, timed],
    [{ ...workout(), exercises: [first, second] }],
  );
  expect(result[0].sets[0].previous).toBe('50 × 8');
  expect(result[1].sets[0].previous).toBe('80 × 8');
  expect(result[2].sets[0].previous).toBeUndefined();
});
test('routine outcomes project only reusable data, fresh identities and the existing destination', () => {
  const logged = workout();
  logged.exercises = changeExerciseTracking(logged.exercises, 'ex', 'duration-weight', fresh);
  logged.exercises[0].sets.push({
    ...exercise().sets[0],
    id: 'warmup',
    tag: 'Warm Up',
    completed: true,
  });
  const state = plans();
  expect(finishRoutineState(state, logged, { kind: 'keep' })).toBe(state);
  const updated = finishRoutineState(state, logged, { kind: 'update' }).plans[0].routines[0];
  expect(updated.exercises[0].trackingOverride).toBe('duration-weight');
  expect(updated.exercises[0].sets).toHaveLength(1);
  expect(updated.exercises[0].sets![0]).toEqual({ id: 's', plannedTargets: [] });
  const copied = finishRoutineState(state, logged, { kind: 'new', name: 'Copy' }).plans[0].routines;
  expect(copied[0]).toBe(state.plans[0].routines[0]);
  expect(copied[1].id).not.toBe('r');
  expect(copied[1].exercises[0].id).not.toBe('ex');
  expect(copied[1].exercises[0].sets![0].id).not.toBe('s');
  expect(() => finishRoutineState(state, logged, { kind: 'new', name: ' ' })).toThrow();
  expect(
    finishRoutineState({ plans: [], standaloneRoutines: [] }, logged, { kind: 'new', name: 'Copy' })
      .standaloneRoutines,
  ).toHaveLength(1);
  expect(() =>
    finishRoutineState({ plans: [], standaloneRoutines: [] }, logged, { kind: 'update' }),
  ).toThrow();
});
test('browser finish failure rolls back every record; retry and duplicates save once', async () => {
  const logged = workout();
  const values = new Map<string, string>([
    ['@forge/plans-v1', JSON.stringify(plans())],
    ['@forge/active-workout', JSON.stringify(logged)],
    ['@forge/completed-workouts', '[]'],
  ]);
  const before = new Map(values);
  let fail = true;
  const storage: FinishStorage = {
    multiGet: async (keys) => keys.map((key) => [key, values.get(key) ?? null] as const),
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
    multiSet: async (pairs) => {
      for (const [key, value] of pairs) {
        values.set(key, value);
        if (fail) {
          fail = false;
          throw new Error('Storage full');
        }
      }
    },
  };
  await expect(
    writeWebWorkoutFinish(storage, logged, { kind: 'new', name: 'Copy' }),
  ).rejects.toThrow('Storage full');
  expect(values).toEqual(before);
  await writeWebWorkoutFinish(storage, logged, { kind: 'new', name: 'Copy' });
  await writeWebWorkoutFinish(storage, logged, { kind: 'new', name: 'Another copy' });
  expect(JSON.parse(values.get('@forge/completed-workouts')!)).toHaveLength(1);
  expect(JSON.parse(values.get('@forge/plans-v1')!).plans[0].routines).toHaveLength(2);
  expect(
    JSON.parse(values.get('@forge/completed-workouts')!)[0].exercises[0].sets[0].completed,
  ).toBe(false);
});

test('portable records preserve overrides and timed strength excludes rep volume', () => {
  const timed = { ...exercise(), trackingOverride: 'duration-weight' as const };
  timed.sets[0].completed = true;
  const transfer = normalizeDataTransfer({
    settings: {},
    plans: { plans: [], standaloneRoutines: [] },
    workouts: { completedWorkouts: [{ ...workout(), exercises: [timed] }], activeWorkout: null },
  });
  expect(transfer.workouts.completedWorkouts[0].exercises[0].trackingOverride).toBe(
    'duration-weight',
  );
  expect(computeWorkoutVolume({ exercises: [timed] })).toBe(0);
});
test('next-session targets match both tracking mode and repeated occurrence', () => {
  const first = exercise();
  const second = { ...exercise(), id: 'second' };
  const timed = { ...exercise(), id: 'timed', trackingOverride: 'duration-weight' as const };
  const record = (item: WorkoutExercise, value: number) => ({
    ...item,
    sets: [
      {
        ...item.sets[0],
        targets: [
          { id: 'next-' + item.id, kind: 'weight' as const, unit: 'kg' as const, minValue: value },
        ],
      },
    ],
  });
  const routine = plans().plans[0].routines[0];
  routine.exercises = [first, second, timed];
  const result = routineExercisesWithNextSessionTargets(routine, [
    { ...workout(), exercises: [record(first, 60), record(second, 70), record(timed, 80)] },
  ]);
  expect(
    result.map(
      (item) => item.sets![0].plannedTargets!.find((target) => target.kind === 'weight')?.minValue,
    ),
  ).toEqual([60, 70, 80]);
});

test('a deleted source uses original reusable intervals, never generated next-session hints', () => {
  const original = plans().plans[0].routines[0];
  const guided = exercise();
  guided.sets[0].plannedTargets = [
    { id: 'session-hint', kind: 'reps', unit: 'count', minValue: 12, maxValue: 15 },
  ];
  const logged = {
    ...workout(),
    exercises: [guided],
    routineStructureBaseline: routineStructureBaseline([guided], original),
  };
  expect(hasRoutineStructureChanged(logged)).toBe(false);
  const copied = finishRoutineState({ plans: [], standaloneRoutines: [] }, logged, {
    kind: 'new',
    name: 'Recovered',
  }).standaloneRoutines[0];
  expect(copied.exercises[0].sets![0].plannedTargets?.[0].minValue).toBe(8);
  expect(copied.exercises[0].sets![0].plannedTargets?.[0].id).toBe('t');
  expect(logged.routineStructureBaseline.routineName).toBe('Push');
});

test('all compatible mode transitions warn exactly for removed data and preserve compatible targets', () => {
  const bases = [
    'weight-reps',
    'bodyweight-reps',
    'weighted-bodyweight',
    'assisted-bodyweight',
    'distance-duration',
    'weight-distance',
  ] as const;
  for (const base of bases)
    for (const from of trackingChoices({ trackingType: base }))
      for (const to of trackingChoices({ trackingType: base })) {
        if (from === to) continue;
        const before: WorkoutExercise = {
          ...exercise(),
          trackingType: base,
          trackingOverride: from,
          sets: [
            {
              id: 'set',
              weight: '',
              reps: '',
              completed: false,
              measurements: trackingFields[from].map((kind) => ({
                id: kind,
                kind,
                unit: measurementUnit[kind],
                value: 15,
              })),
              plannedTargets: trackingFields[from].map((kind) => ({
                id: kind,
                kind,
                unit: measurementUnit[kind],
                minValue: 15,
              })),
            },
          ],
        };
        const removed = trackingFields[from].filter((kind) => !trackingFields[to].includes(kind));
        expect(losesTrackingData(before, to), `${from} -> ${to}`).toBe(removed.length > 0);
        const [after] = changeExerciseTracking([before], before.id, to, fresh);
        expect(after.id).toBe(before.id);
        expect(effectiveTracking(after)).toBe(to);
        const preserved = trackingFields[from]
          .filter((kind) => trackingFields[to].includes(kind))
          .sort();
        expect(after.sets[0].measurements!.map((entry) => entry.kind).sort()).toEqual(preserved);
        expect(after.sets[0].plannedTargets!.map((entry) => entry.kind).sort()).toEqual(preserved);
        expect(before.sets[0].measurements).toHaveLength(trackingFields[from].length);
        const empty = {
          ...before,
          sets: [{ id: 'empty', weight: '', reps: '', completed: false }],
        };
        expect(losesTrackingData(empty, to)).toBe(false);
        const targetsOnly = { ...before, sets: [{ ...before.sets[0], measurements: [] }] };
        expect(losesTrackingData(targetsOnly, to)).toBe(removed.length > 0);
      }
});
