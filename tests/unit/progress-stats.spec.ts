import { test, expect } from '@playwright/test';
import { exerciseSessions, type ProgressPoint } from '../../src/domain/exercises/progress';
import {
  estimatedOneRepMax,
  progressChange,
  progressRecord,
} from '../../src/domain/exercises/progressStats';
import { formatProgressValue } from '../../src/domain/exercises/progressPresentation';
import type { Workout, WorkoutExercise, WorkoutSet } from '../../src/types';

const set = (weight: string, reps: string, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `${weight}-${reps}`,
  weight,
  reps,
  completed: true,
  ...extra,
});
const exercise = (sets: WorkoutSet[]): WorkoutExercise => ({
  id: 'block',
  exerciseId: 'press',
  name: 'Press',
  trackingType: 'weight-reps',
  sets,
});
const workout = (date: number, sets: WorkoutSet[], id = `${date}`): Workout => ({
  id,
  name: id,
  type: 'Strength',
  note: '',
  startedAt: date,
  completedAt: date + 1,
  exercises: [exercise(sets)],
});
const point = (value: number, date: number, excluded = false): ProgressPoint => ({
  value,
  date,
  workoutId: `${date}`,
  excluded,
  automatic: false,
});

test('Epley accepts high repetitions, preserves singles and excludes ineligible sets', () => {
  const workouts = [
    workout(1, [
      set('90', '1'),
      set('60', '15'),
      set('200', '2', { tag: 'Warm Up' }),
      set('500', '10', { completed: false }),
      set('400', '10', { sideCompletion: { left: true, right: false } }),
      set('-2', '8'),
      set('40', '0.5'),
      set('0', '10'),
      set('NaN', '10'),
    ]),
  ];
  const sessions = exerciseSessions(exercise([]), workouts);
  expect(estimatedOneRepMax(sessions, 'all')?.value).toBe(90);
  expect(
    estimatedOneRepMax(exerciseSessions(exercise([]), [workout(2, [set('60', '20')])]), 'all')
      ?.value,
  ).toBeCloseTo(100);
});

test('1RM combines repeated blocks, rejects off-session and other identities, and respects period', () => {
  const now = 100 * 86400000;
  const recent = workout(now, [set('50', '6')]);
  recent.exercises.push(
    exercise([set('60', '10')]),
    { ...exercise([set('1000', '8')]), offSession: true },
    { ...exercise([set('1000', '8')]), exerciseId: 'other' },
  );
  const sessions = exerciseSessions(exercise([]), [
    workout(now - 8 * 86400000, [set('100', '1')]),
    recent,
  ]);
  expect(estimatedOneRepMax(sessions, 7, now)).toMatchObject({ value: 80, date: now });
  expect(estimatedOneRepMax(sessions, 'all', now)?.value).toBe(100);
  expect(estimatedOneRepMax([], 'all')).toBeUndefined();
});

test('structured values remain authoritative and duplicate/invalid units are excluded', () => {
  const structured = set('1000', '1000', {
    measurements: [
      { id: 'w', kind: 'weight', unit: 'kg', value: 50 },
      { id: 'r', kind: 'reps', unit: 'count', value: 6 },
    ],
  });
  expect(
    estimatedOneRepMax(exerciseSessions(exercise([]), [workout(1, [structured])]), 'all')?.value,
  ).toBe(60);
  structured.measurements!.push({ id: 'duplicate', kind: 'weight', unit: 'kg', value: 200 });
  expect(
    estimatedOneRepMax(exerciseSessions(exercise([]), [workout(1, [structured])]), 'all'),
  ).toBeUndefined();
});

test('record and change use included chronological sessions with neutral signed deltas', () => {
  const points = [point(80, 3), point(40, 1), point(500, 2, true)];
  expect(progressRecord(points, 'load', 'weight-reps')?.value).toBe(80);
  expect(progressRecord(points, 'load', 'assisted-bodyweight')?.value).toBe(40);
  expect(progressRecord(points, 'pace', 'distance-duration')?.value).toBe(40);
  expect(progressChange(points)).toEqual({ absolute: 40, percent: 100 });
  expect(progressChange([point(0, 1), point(50, 2)])).toEqual({ absolute: 50 });
  expect(progressChange([point(50, 1)])).toBeUndefined();
  expect(progressChange([point(50, 1), point(25, 2)])).toEqual({ absolute: -25, percent: -50 });
  expect(formatProgressValue('load', 100, 'imperial')).toBe('220.5 lb');
  expect(formatProgressValue('volume', 100, 'metric')).toBe('100 kg · reps');
  expect(formatProgressValue('pace', 120, 'metric')).toBe('02:00/km');
});

test('1RM rejects other tracking modes and resolves tied records chronologically', () => {
  const unsupported = workout(1, [set('100', '10')]);
  unsupported.exercises[0].trackingType = 'weighted-bodyweight';
  expect(
    estimatedOneRepMax([{ workout: unsupported, exercises: unsupported.exercises }], 'all'),
  ).toBeUndefined();
  const sessions = exerciseSessions(exercise([]), [
    workout(3, [set('100', '1')]),
    workout(1, [set('60', '20')]),
  ]);
  expect(estimatedOneRepMax(sessions, 'all')).toMatchObject({ value: 100, date: 1 });
});
