import { expect, test } from '@playwright/test';
import {
  computeWorkoutVolume,
  formatTrainingTime,
  formatVolume,
  lastCompletedWorkout,
  trainingTimeThisWeek,
  weekStrip,
  weekVolume,
} from '../../src/screens/dashboard/dashboardSummary';
import type { Workout, WorkoutSet } from '../../src/types';

function set(weight: string, reps: string, completed = true): WorkoutSet {
  return { id: `${weight}-${reps}`, weight, reps, completed };
}

function workout(overrides: Partial<Workout> & { completedAt: number }): Workout {
  return {
    id: `w-${overrides.completedAt}`,
    name: 'Session',
    type: 'Strength',
    startedAt: overrides.completedAt - 3600_000,
    note: '',
    exercises: [],
    ...overrides,
  };
}

function exercise(sets: WorkoutSet[]) {
  return { id: `e-${sets.length}`, name: 'Bench', sets };
}

const WED = new Date(2026, 0, 7, 12); // Wednesday 7 Jan 2026; week (Mon-start) = Jan 5..11
const day = (offset: number, hour = 10): number => new Date(2026, 0, 5 + offset, hour).getTime();

test('computeWorkoutVolume sums weight x reps of completed sets only', () => {
  const w = workout({
    completedAt: day(0),
    exercises: [exercise([set('100', '5'), set('80', '10'), set('60', '8', false)])],
  });
  expect(computeWorkoutVolume(w)).toBe(100 * 5 + 80 * 10);
});

test('weekStrip marks trained days and counts this week only', () => {
  const completed = [
    workout({ completedAt: day(1), type: 'Strength' }), // Tue, this week
    workout({ completedAt: day(1, 18), type: 'Cardio' }), // Tue again (second type)
    workout({ completedAt: day(2) }), // Wed, this week
    workout({ completedAt: day(-7) }), // last week
  ];
  const { days, workoutCount } = weekStrip(completed, WED, 1);
  expect(workoutCount).toBe(3);
  // A day with two workouts exposes both types in order (for the split dot).
  expect(days[1].types).toEqual(['Strength', 'Cardio']);
  expect(days[0].hasWorkout).toBe(false); // Mon
  expect(days[1].hasWorkout).toBe(true); // Tue
  expect(days[2].hasWorkout).toBe(true); // Wed
  expect(days[2].isToday).toBe(true);
  expect(days[3].isFuture).toBe(true); // Thu
  expect(days.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
});

test('weekStrip honours a Sunday week start', () => {
  const { days } = weekStrip([], WED, 0);
  expect(days.map((d) => d.label)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
});

test('trainingTimeThisWeek totals and buckets duration by weekday', () => {
  const completed = [
    workout({ completedAt: day(1), durationSeconds: 1800 }), // Tue
    workout({ completedAt: day(2), durationSeconds: 3600 }), // Wed
    workout({ completedAt: day(-7), durationSeconds: 9999 }), // last week, excluded
  ];
  const { totalSeconds, perDaySeconds } = trainingTimeThisWeek(completed, WED, 1);
  expect(totalSeconds).toBe(5400);
  expect(perDaySeconds[1]).toBe(1800);
  expect(perDaySeconds[2]).toBe(3600);
  expect(perDaySeconds[0]).toBe(0);
});

test('weekVolume compares this week to last week', () => {
  const completed = [
    workout({ completedAt: day(1), exercises: [exercise([set('100', '10')])] }), // this week: 1000
    workout({ completedAt: day(-6), exercises: [exercise([set('100', '8')])] }), // last week: 800
  ];
  const { thisWeekKg, lastWeekKg, deltaPct } = weekVolume(completed, WED, 1);
  expect(thisWeekKg).toBe(1000);
  expect(lastWeekKg).toBe(800);
  expect(deltaPct).toBe(25);
});

test('weekVolume compares last week only up to the same point in the week', () => {
  const completed = [
    // Last week: Monday counts (before Wed), Friday does not (after "now" = Wed).
    workout({ completedAt: day(-7), exercises: [exercise([set('100', '5')])] }), // last Mon: 500
    workout({ completedAt: day(-3), exercises: [exercise([set('100', '9')])] }), // last Fri: 900, excluded
  ];
  const { thisWeekKg, lastWeekKg, deltaPct } = weekVolume(completed, WED, 1);
  expect(thisWeekKg).toBe(0);
  expect(lastWeekKg).toBe(500);
  expect(deltaPct).toBe(-100);
});

test('weekVolume reports a null delta with no prior week', () => {
  const completed = [workout({ completedAt: day(1), exercises: [exercise([set('50', '10')])] })];
  expect(weekVolume(completed, WED, 1).deltaPct).toBeNull();
});

test('lastCompletedWorkout picks the most recent finished session', () => {
  const completed = [
    workout({ completedAt: day(-2) }),
    workout({ completedAt: day(0) }),
    workout({ completedAt: day(-5) }),
  ];
  expect(lastCompletedWorkout(completed)?.completedAt).toBe(day(0));
  expect(lastCompletedWorkout([])).toBeNull();
});

test('formatting helpers render Forge-style values', () => {
  expect(formatTrainingTime(0)).toBe('0m');
  expect(formatTrainingTime(1500)).toBe('25m');
  expect(formatTrainingTime(4 * 3600 + 32 * 60)).toBe('4h 32m');
  expect(formatVolume(12450)).toBe('12,450 kg');
});
