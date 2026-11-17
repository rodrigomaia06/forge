import { expect, test } from '@playwright/test';
import { formatRangeEntry, rangeEntryText, rangeEntryValues, recordedIntervalText, withoutRecordedInterval } from '../../src/domain/workouts/rangeEntry';
import { createWorkout } from '../../src/state/workoutMutations';
import {
  MAX_PLAUSIBLE_DISTANCE_KM,
  MAX_PLAUSIBLE_REPS,
  MAX_PLAUSIBLE_SET_DURATION_SECONDS,
  MAX_PLAUSIBLE_WEIGHT_KG,
  PREVIOUS_BEST_JUMP_FACTOR,
  describeImplausibleSetValue,
  implausibleSetValues,
} from '../../src/domain/workouts/setPlausibility';
import { exercisesWithAddedPrevious } from '../../src/domain/workouts/nextSessionTargets';
import type { SetMeasurement, TrackingType, Workout, WorkoutExercise, WorkoutSet } from '../../src/types';

test('routine distance intervals keep their decimal and only a dash separates a range', () => {
  expect(rangeEntryText('5.5', 'distance')).toBe('5.5');
  expect(rangeEntryText('5,5', 'distance')).toBe('5,5');
  expect(rangeEntryValues('5,5', 'distance')).toEqual([5.5]);
  expect(rangeEntryText('5.5-7.25', 'distance')).toBe('5.5-7.25');
  expect(rangeEntryValues('5.5-7.25', 'distance')).toEqual([5.5, 7.25]);
  // A second decimal on one side and a second separator are dropped while typing.
  expect(rangeEntryText('5..5--6', 'distance')).toBe('5.5-6');
  expect(rangeEntryText('8–12', 'reps')).toBe('8-12');
  expect(rangeEntryValues('8-12', 'reps')).toEqual([8, 12]);
  // A half-typed or cleared range never collapses to 0.
  expect(rangeEntryValues('8-', 'reps')).toEqual([8]);
  expect(rangeEntryValues('', 'reps')).toEqual([]);
  expect(formatRangeEntry('distance', 5.5, 7.25)).toBe('5.5–7.25');
  expect(formatRangeEntry('reps', 8, 8)).toBe('8');
});

test('routine time intervals are entered and shown as mm:ss', () => {
  // The decimal keypad's separator is the clock separator, as in recorded time.
  expect(rangeEntryText('0.30-1.00', 'duration')).toBe('0:30-1:00');
  expect(rangeEntryValues('0:30-1:00', 'duration')).toEqual([30, 60]);
  // Plain digits remain seconds.
  expect(rangeEntryValues('45-75', 'duration')).toEqual([45, 75]);
  expect(formatRangeEntry('duration', 45, 75)).toBe('00:45–01:15');
  expect(formatRangeEntry('duration', 1800)).toBe('30:00');
  expect(rangeEntryValues('1:60', 'duration')).toEqual([]);
});

let ids = 0;
const measured = (kinds: Partial<Record<SetMeasurement['kind'], number>>, completed = true): WorkoutSet => ({
  id: `set-${++ids}`,
  weight: kinds.weight !== undefined ? String(kinds.weight) : '',
  reps: kinds.reps !== undefined ? String(kinds.reps) : '',
  completed,
  measurements: Object.entries(kinds).map(([kind, value]) => ({
    id: `m-${++ids}`,
    kind: kind as SetMeasurement['kind'],
    unit: ({ weight: 'kg', addedWeight: 'kg', reps: 'count', distance: 'km', duration: 'sec', rpe: 'rpe' } as const)[kind as SetMeasurement['kind']],
    value: value as number,
  })),
});
const exercise = (name: string, trackingType: TrackingType, sets: WorkoutSet[], over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: `ex-${++ids}`, exerciseId: name.toLowerCase().replace(/\s+/g, '-'), name, trackingType, sets, ...over,
});
const workout = (id: string, exercises: WorkoutExercise[], completedAt: number | null = 2000): Workout => ({
  id, name: id, type: 'Strength', startedAt: 1000, completedAt, note: '', exercises,
});

test('flags completed values above the absolute limits', () => {
  const live = workout('live', [
    exercise('Bench Press', 'weight-reps', [
      measured({ weight: 100, reps: 5 }),
      measured({ weight: MAX_PLAUSIBLE_WEIGHT_KG + 1, reps: 5 }),
      measured({ weight: 100, reps: MAX_PLAUSIBLE_REPS + 1 }),
      // Incomplete sets are not recorded and never flagged.
      measured({ weight: 9000, reps: 5 }, false),
    ]),
    exercise('Running', 'distance-duration', [
      measured({ distance: MAX_PLAUSIBLE_DISTANCE_KM + 1 }),
      measured({ duration: MAX_PLAUSIBLE_SET_DURATION_SECONDS + 1 }),
      measured({ distance: 5, duration: 1800 }),
    ]),
  ], null);
  const issues = implausibleSetValues(live, []);
  expect(issues.map((issue) => [issue.exerciseName, issue.setNumber, issue.kind, issue.reason])).toEqual([
    ['Bench Press', 2, 'weight', 'limit'],
    ['Bench Press', 3, 'reps', 'limit'],
    ['Running', 1, 'distance', 'limit'],
    ['Running', 2, 'duration', 'limit'],
  ]);
  expect(describeImplausibleSetValue(issues[0])).toBe('Bench Press, set 2: 501 kg');
  expect(describeImplausibleSetValue(issues[3])).toBe('Running, set 2: 6:00:01');
});

test('flags a value more than ten times the movement’s previous best', () => {
  const history = [
    workout('old', [exercise('Curl', 'weight-reps', [measured({ weight: 20, reps: 10 })])]),
    // Off-session exercises never set a previous best.
    workout('off', [exercise('Curl', 'weight-reps', [measured({ weight: 2, reps: 1 })], { offSession: true })]),
  ];
  const live = workout('live', [
    exercise('Curl', 'weight-reps', [
      measured({ weight: 20 * PREVIOUS_BEST_JUMP_FACTOR, reps: 10 }),
      measured({ weight: 20 * PREVIOUS_BEST_JUMP_FACTOR + 1, reps: 10 }),
    ]),
  ], null);
  const issues = implausibleSetValues(live, history);
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ setNumber: 2, kind: 'weight', reason: 'jump', previousBest: 20 });
  expect(describeImplausibleSetValue(issues[0])).toBe('Curl, set 2: 201 kg (best so far 20 kg)');
  // An edited past workout is never compared with its own saved copy.
  const edited = { ...live, id: 'edited', completedAt: 3000 };
  expect(implausibleSetValues(edited, [...history, edited])).toHaveLength(1);
  expect(implausibleSetValues(workout('normal', [exercise('Curl', 'weight-reps', [measured({ weight: 22, reps: 10 })])]), history)).toEqual([]);
});

test('the Previous column labels distance so cardio never reads as weight × reps', () => {
  const history = [workout('run', [exercise('Running', 'distance-duration', [measured({ distance: 5, duration: 1800 })])])];
  const [filled] = exercisesWithAddedPrevious([exercise('Running', 'distance-duration', [measured({}, false)])], history);
  expect(filled.sets[0].previous).toBe('5 km × 30:00');
});

test('routine distance and time intervals reach the live set like rep intervals', () => {
  const interval = (kind: 'reps' | 'distance' | 'duration', min: number, max: number) =>
    ({ id: `t-${kind}`, kind, unit: kind === 'reps' ? 'count' as const : kind === 'distance' ? 'km' as const : 'sec' as const, minValue: min, maxValue: max });
  const live = createWorkout({
    name: 'Run',
    routineId: 'routine',
    exercises: [
      { name: 'Running', trackingOverride: 'distance-duration', sets: [{ id: 'a', weight: '', reps: '', plannedTargets: [interval('distance', 5, 5), interval('duration', 1500, 1800)] }] },
      { name: 'Curl', trackingType: 'weight-reps', sets: [{ id: 'b', weight: '20', reps: '', plannedTargets: [interval('reps', 8, 12)] }] },
      // Recorded routine values (imported routines) prefill, as a routine weight does.
      { name: 'Rowing', trackingOverride: 'distance-duration', sets: [{ id: 'c', weight: '', reps: '', measurements: [{ id: 'm', kind: 'distance', unit: 'km', value: 2 }] }] },
    ],
  });
  const [run, curl, row] = live.exercises.map((exercise) => exercise.sets[0]);
  // Intervals stay advisory guidance (shown as the empty field's hint), never entered values.
  expect(run.plannedTargets?.map((target) => target.kind)).toEqual(['distance', 'duration']);
  expect(run.measurements).toBeUndefined();
  expect(curl.plannedTargets?.map((target) => target.kind)).toEqual(['reps']);
  expect(curl.reps).toBe('');
  expect(curl.weight).toBe('20');
  expect(row.measurements?.[0].value).toBe(2);
});

test('routine editor shows recorded values as intervals and replaces them on edit', () => {
  const set: WorkoutSet = {
    id: 's', weight: '', reps: '10', completed: false,
    measurements: [
      { id: 'd', kind: 'distance', unit: 'km', value: 5.5 },
      { id: 't', kind: 'duration', unit: 'sec', value: 1800 },
    ],
  };
  expect(recordedIntervalText(set, 'distance')).toBe('5.5');
  expect(recordedIntervalText(set, 'duration')).toBe('30:00');
  expect(recordedIntervalText({ ...set, measurements: undefined }, 'reps')).toBe('10');
  expect(recordedIntervalText({ ...set, measurements: [] }, 'distance')).toBe('');
  const cleared = withoutRecordedInterval(set, 'duration');
  expect(cleared.measurements?.map((entry) => entry.kind)).toEqual(['distance']);
  expect(withoutRecordedInterval({ ...set, measurements: undefined }, 'reps')).toMatchObject({ reps: '' });
  expect(withoutRecordedInterval({ ...set, measurements: [] , reps: '' }, 'distance')).toEqual({});
});
