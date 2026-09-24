import { expect, test } from '@playwright/test';
import { muscleGroupOf, muscleBalance, measurementSeries, restStats, streakStats } from '../../src/domain/dashboard/widgetMetrics';
import type { Workout } from '../../src/types';

test('maps muscle labels and slugs to display groups', () => {
  expect(muscleGroupOf('Chest')).toBe('Chest');
  expect(muscleGroupOf('lats')).toBe('Back');
  expect(muscleGroupOf('Front Delts')).toBe('Shoulders');
  expect(muscleGroupOf('hamstrings')).toBe('Legs');
  expect(muscleGroupOf('Biceps')).toBe('Arms');
  expect(muscleGroupOf('obliques')).toBe('Core');
  expect(muscleGroupOf('cardiovascular')).toBeNull();
  expect(muscleGroupOf(undefined)).toBeNull();
});

const NOW = new Date(2026, 0, 15, 12); // Thu 15 Jan 2026
function day(offset: number): number {
  return new Date(2026, 0, 15 - offset, 12).getTime();
}
function workout(o: number, type: string, muscles: string[]): Workout {
  return {
    id: `w${o}-${type}`, name: 'S', type,
    startedAt: day(o) - 3600_000, completedAt: day(o), note: '',
    exercises: muscles.map((m, i) => ({
      id: `e${o}${i}`, name: m,
      exerciseSnapshot: { name: m, trackingType: 'weight-reps', primaryMuscle: m } as never,
      sets: [
        { id: `a${o}${i}`, weight: '60', reps: '8', completed: true },
        { id: `b${o}${i}`, weight: '60', reps: '8', completed: true, tag: 'Warm Up' },
      ],
    })) as never,
  } as Workout;
}

test('muscle balance counts working sets per group and excludes warm-ups', () => {
  const workouts = [workout(1, 'Strength', ['Chest', 'lats']), workout(3, 'Strength', ['quads'])];
  const balance = muscleBalance(workouts, 4, NOW);
  const byGroup = Object.fromEntries(balance.map((b) => [b.group, b.sets]));
  expect(byGroup.Chest).toBe(1); // one working set (warm-up excluded)
  expect(byGroup.Back).toBe(1);
  expect(byGroup.Legs).toBe(1);
  expect(byGroup.Arms).toBe(0);
});

test('muscle balance respects the window', () => {
  const workouts = [workout(60, 'Strength', ['Chest'])]; // 60 days ago
  const balance = muscleBalance(workouts, 4, NOW); // 4-week window
  expect(balance.every((b) => b.sets === 0)).toBe(true);
});

test('streak counts consecutive weeks meeting a default weekly goal', () => {
  // 3 workouts in each of this week and the two prior weeks; goal 3/week.
  const workouts: Workout[] = [];
  for (const weekOffset of [0, 1, 2]) {
    for (let n = 0; n < 3; n += 1) workouts.push(workout(weekOffset * 7 + n, 'Strength', ['Chest']));
  }
  const streak = streakStats(workouts, 3, {}, NOW, 1);
  expect(streak.streakWeeks).toBe(3);
  expect(streak.metThisWeek).toBe(true);
});

test('streak breaks when a prior week misses the goal', () => {
  const workouts: Workout[] = [
    ...[0, 1, 2].map((n) => workout(n, 'Strength', ['Chest'])), // this week: 3
    workout(9, 'Strength', ['Chest']), // last week: only 1 (misses goal of 3)
  ];
  const streak = streakStats(workouts, 3, {}, NOW, 1);
  expect(streak.streakWeeks).toBe(1); // only this week counts
});

function entry(dateOffsetDays: number, value: number, definitionId = 'weight') {
  const d = new Date(2026, 0, 15 - dateOffsetDays, 12);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { id: `e-${dateOffsetDays}`, definitionId, date, value };
}

test('measurement series windows, sorts, and computes the delta', () => {
  const entries = [
    entry(0, 82), // today
    entry(10, 80),
    entry(40, 78), // outside a 30-day window
    entry(5, 81, 'other'), // different metric
  ];
  const s = measurementSeries(entries, 'weight', 30, NOW);
  expect(s.values).toEqual([80, 82]); // oldest → newest, in-window only
  expect(s.latest).toBe(82);
  expect(s.delta).toBe(2); // 82 - 80
  expect(s.count).toBe(2);
});

test('measurement series has no delta from a single reading', () => {
  const s = measurementSeries([entry(0, 82)], 'weight', 90, NOW);
  expect(s.latest).toBe(82);
  expect(s.delta).toBeNull();
});

function restWorkout(o: number, avgRest: number, samples: number): Workout {
  return { ...workout(o, 'Strength', ['Chest']), averageRestSeconds: avgRest, restTimerSamples: samples } as Workout;
}

test('rest stats trend compares the window to the previous equal window', () => {
  const workouts = [
    restWorkout(2, 90, 10), // this 7-day window
    restWorkout(4, 110, 10),
    restWorkout(9, 140, 10), // previous 7-day window
    restWorkout(11, 160, 10),
  ];
  const stats = restStats(workouts, 7, NOW);
  expect(stats.avgRestSeconds).toBe(100); // (90+110)/2 weighted equally
  expect(stats.sessions).toBe(2);
  expect(stats.deltaSeconds).toBe(-50); // 100 now vs 150 before
});

test('rest stats have no trend without a prior window', () => {
  const stats = restStats([restWorkout(1, 90, 10)], 7, NOW);
  expect(stats.avgRestSeconds).toBe(90);
  expect(stats.deltaSeconds).toBeNull();
});
