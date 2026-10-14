import { sessionChartLayout } from '../../src/components/charts/sessionChartLayout';
import { formatProgressValue } from '../../src/domain/exercises/progressPresentation';
import { test, expect } from '@playwright/test';
import {
  exerciseSessions,
  exerciseProgress,
  classifyProgress,
  metricsFor,
  progressScope,
  progressInRange,
  validateProgressOverrides,
  mergeProgressOverrides,
} from '../../src/domain/exercises/progress';
import { trackingFields, measurementUnit } from '../../src/domain/exercises/tracking';
import { parseSettingsPreferences } from '../../src/data/settingsPreferences';
import type { TrackingType, Workout, WorkoutExercise, SetMeasurementKind } from '../../src/types';
const exercise = (mode: TrackingType = 'weight-reps'): WorkoutExercise => ({
  id: 'block',
  exerciseId: 'bench',
  name: 'Bench',
  trackingType: mode,
  sets: [{ id: 'set', weight: '50', reps: '8', completed: true }],
});
const workout = (blocks = [exercise()], id = 'w', date = 1): Workout => ({
  id,
  name: id,
  type: 'Strength',
  note: '',
  startedAt: date,
  completedAt: date + 100,
  exercises: blocks,
});
const fields: Record<SetMeasurementKind, number> = {
  weight: 50,
  addedWeight: 20,
  reps: 8,
  duration: 120,
  distance: 0.5,
  rpe: 8,
};
for (const mode of Object.keys(trackingFields) as TrackingType[]) {
  test(`calculates recorded metrics for ${mode}`, () => {
    const ex = exercise(mode);
    ex.sets[0].measurements = trackingFields[mode].map((kind) => ({
      id: kind,
      kind,
      unit: measurementUnit[kind],
      value: fields[kind],
    }));
    const sessions = exerciseSessions(ex, [workout([ex])]);
    const expected = {
      load: mode.startsWith('assisted') || mode.startsWith('weighted-bodyweight') ? 20 : 50,
      volume: 400,
      'best-reps': 8,
      'total-reps': 8,
      'longest-duration': 120,
      'total-duration': 120,
      distance: 0.5,
      pace: 240,
    };
    for (const metric of metricsFor(mode))
      expect(exerciseProgress(ex, sessions, metric)[0].value).toBe(expected[metric]);
  });
}
test('keeps identities, modes and same-day sessions separate, combining repeated blocks', () => {
  const ex = exercise();
  const same = { ...exercise(), id: 'repeat' };
  const variation = { ...exercise(), exerciseId: 'incline' };
  const differentMode = exercise('duration-weight');
  const sessions = exerciseSessions(ex, [
    workout([ex, same, variation, differentMode]),
    workout([ex], 'second'),
    { ...workout(), id: 'active', completedAt: null },
  ]);
  expect(sessions).toHaveLength(2);
  expect(sessions.find((session) => session.workout.id === 'w')!.exercises).toHaveLength(2);
  expect(exerciseProgress(ex, sessions, 'volume').map((point) => point.value)).toEqual([400, 800]);
  expect(exerciseSessions({ ...ex, exerciseId: undefined }, [workout([ex])])).toHaveLength(1);
  expect(exerciseSessions(ex, [workout([{ ...ex, exerciseId: undefined }])])).toHaveLength(0);
  expect(
    exerciseSessions({ ...ex, exerciseId: undefined, name: ' bench ' }, [
      workout([{ ...ex, exerciseId: undefined }]),
    ]),
  ).toHaveLength(1);
});
test('history retains original sets while calculations omit warmups, incomplete, off-session and invalid data', () => {
  const ex = exercise();
  ex.sets.push(
    { ...ex.sets[0], id: 'warm', weight: '200', tag: 'Warm Up' },
    { ...ex.sets[0], id: 'unfinished', weight: '300', completed: false },
    { ...ex.sets[0], id: 'side', weight: '400', sideCompletion: { left: true, right: false } },
    { ...ex.sets[0], id: 'invalid', weight: 'NaN' },
    { ...ex.sets[0], id: 'invalid-reps', reps: '-2' },
  );
  const sessions = exerciseSessions(ex, [workout([ex, { ...ex, id: 'off', offSession: true }])]);
  expect(sessions[0].exercises[0].sets).toHaveLength(6);
  expect(exerciseProgress(ex, sessions, 'volume')[0].value).toBe(400);
  expect(exerciseProgress(ex, sessions, 'load')[0].value).toBe(50);
  expect(ex.sets[1].weight).toBe('200');
});
const points = (values: number[]) =>
  values.map((value, index) => ({ workoutId: `w${index}`, date: index * 86400000, value }));
test('filters clear spikes and drops independently and permits reversible overrides', () => {
  const source = points([100, 101, 100, 900, 100, 101, 100, 5, 100, 101, 100]);
  const filtered = classifyProgress(source);
  expect(filtered.filter((point) => point.excluded).map((point) => point.workoutId)).toEqual([
    'w3',
    'w7',
  ]);
  expect(classifyProgress(source, { w3: 'include', w0: 'exclude' })[3].excluded).toBe(false);
  expect(classifyProgress(source, { w3: 'include', w0: 'exclude' })[0].excluded).toBe(true);
  expect(classifyProgress(source)[3].excluded).toBe(true);
  expect(filtered[4].trend).toBe(100);
});
test('keeps sparse, zero baseline, ordinary fluctuation, gradual and sustained changes', () => {
  for (const values of [
    [100, 100, 1000],
    [0, 0, 0, 900, 0, 0, 0],
    [100, 120, 90, 115, 100, 125, 95],
    [10, 12, 14, 16, 18, 20, 22],
    [50, 50, 50, 50, 50, 100, 100, 100, 100, 100, 100],
  ])
    expect(classifyProgress(points(values)).some((point) => point.excluded)).toBe(false);
  expect(classifyProgress(points([1, 2]))[1].trend).toBeUndefined();
  expect(classifyProgress(points([1, 2, 3]))[2].trend).toBe(2);
  expect(classifyProgress(points([1, 2, 3, 4, 5, 6]))[5].trend).toBe(4);
});
test('range changes preserve full-history classifications and smoothed values', () => {
  const classified = classifyProgress(points([100, 100, 100, 1000, 100, 100, 100, 100]));
  const cropped = progressInRange(classified, 7, 9 * 86400000);
  expect(cropped.find((point) => point.workoutId === 'w3')).toEqual(classified[3]);
  expect(progressInRange(classified, 'all')).toEqual(classified);
});
test('override settings validate, round-trip backup JSON, merge without changing current choices and accept older backups', () => {
  const scope = progressScope(exercise(), 'load');
  const overrides = { [scope]: { w: 'exclude', other: 'include' } };
  const loaded = parseSettingsPreferences(JSON.stringify({ exerciseProgressOverrides: overrides }));
  expect(loaded.exerciseProgressOverrides).toEqual(overrides);
  expect(parseSettingsPreferences(JSON.stringify(loaded)).exerciseProgressOverrides).toEqual(
    overrides,
  );
  expect(parseSettingsPreferences('{}').exerciseProgressOverrides).toEqual({});
  expect(
    validateProgressOverrides({
      bad: { w: 'exclude' },
      [scope]: { w: 'delete', other: 'include' },
    }),
  ).toEqual({ [scope]: { other: 'include' } });
  expect(validateProgressOverrides([])).toEqual({});
  expect(mergeProgressOverrides({ [scope]: { w: 'include' } }, overrides, new Set(['w']))).toEqual({
    [scope]: { w: 'include' },
  });
});
test('pace aggregates distance and duration rather than averaging individual paces', () => {
  const ex = exercise('distance-duration');
  ex.sets = [1, 2].map((n) => ({
    id: String(n),
    weight: '',
    reps: '',
    completed: true,
    measurements: [
      { id: 'd', kind: 'distance', unit: 'km', value: n },
      { id: 't', kind: 'duration', unit: 'sec', value: 60 },
    ],
  }));
  expect(exerciseProgress(ex, exerciseSessions(ex, [workout([ex])]), 'pace')[0].value).toBe(40);
});

test('rejects invalid units, preserves supported fractional reps, and keeps empty histories usable', () => {
  const ex = exercise();
  ex.sets[0].measurements = [
    { id: 'weight', kind: 'weight', unit: 'count', value: 50 },
    { id: 'reps', kind: 'reps', unit: 'count', value: 8 },
  ];
  expect(exerciseProgress(ex, exerciseSessions(ex, [workout([ex])]), 'load')).toEqual([]);
  ex.sets[0].measurements[0].unit = 'kg';
  ex.sets[0].measurements[1].value = 1.5;
  expect(exerciseProgress(ex, exerciseSessions(ex, [workout([ex])]), 'best-reps')[0].value).toBe(
    1.5,
  );
  expect(exerciseProgress(ex, exerciseSessions(ex, [workout([ex])]), 'volume')[0].value).toBe(75);
  expect(exerciseSessions(ex, [])).toEqual([]);
});

test('load and volume classify anomalies independently without changing imported provenance', () => {
  const ex = exercise();
  const history = Array.from({ length: 9 }, (_, index) =>
    workout(
      [{ ...ex, sets: [{ ...ex.sets[0], reps: index === 4 ? '100' : '8' }] }],
      `w${index}`,
      index,
    ),
  );
  history[4].importSource = {
    source: 'hevy',
    sessionKey: 'source-session',
    fingerprint: 'content',
  };
  const sessions = exerciseSessions(ex, history);
  expect(exerciseProgress(ex, sessions, 'load').some((point) => point.excluded)).toBe(false);
  expect(exerciseProgress(ex, sessions, 'volume')[4].excluded).toBe(true);
  expect(history[4].exercises[0].sets[0].reps).toBe('100');
  expect(history[4].importSource).toEqual({
    source: 'hevy',
    sessionKey: 'source-session',
    fingerprint: 'content',
  });
});

test('formats canonical measurements using the current preferences, including inverse pace conversion', () => {
  expect(formatProgressValue('load', 100, 'imperial')).toBe('220.5 lb');
  expect(formatProgressValue('volume', 100, 'metric')).toBe('100 kg · reps');
  expect(formatProgressValue('distance', 1.609344, 'imperial')).toBe('1 mi');
  expect(formatProgressValue('pace', 300, 'metric')).toBe('05:00/km');
  expect(formatProgressValue('pace', 300, 'imperial')).toBe('08:03/mi');
  expect(formatProgressValue('total-duration', 3661, 'imperial')).toBe('1:01:01');
});

test('calculates a large archive without collapsing sessions or mutating source sets', () => {
  const ex = exercise();
  const history = Array.from({ length: 5000 }, (_, index) =>
    workout([ex], `w${index}`, index * 86400000),
  );
  const sessions = exerciseSessions(ex, history);
  const result = exerciseProgress(ex, sessions, 'volume');
  expect(result).toHaveLength(5000);
  expect(result[result.length - 1].trend).toBe(400);
  expect(ex.sets[0].weight).toBe('50');
});

test('retains legacy weight and reps when a saved set only has an RPE measurement', () => {
  const ex = exercise();
  ex.sets[0].measurements = [{ id: 'rpe', kind: 'rpe', unit: 'rpe', value: 8 }];
  expect(exerciseProgress(ex, exerciseSessions(ex, [workout([ex])]), 'volume')[0].value).toBe(400);
});

test('positions chart points by actual session time and centres a constant series', () => {
  const layout = sessionChartLayout(
    [
      { date: 0, value: 50 },
      { date: 10, value: 50 },
      { date: 100, value: 50 },
    ],
    232,
    180,
  );
  expect(layout.x(0)).toBe(16);
  expect(layout.x(10)).toBe(36);
  expect(layout.x(100)).toBe(216);
  expect(layout.y(50)).toBe(90);
  expect(sessionChartLayout([{ date: 0, value: 50 }], 232, 180).x(0)).toBe(116);
});
