import { expect, test } from '@playwright/test';
import { suggestNextWorkout } from '../../src/domain/workouts/suggestNextWorkout';
import type { Workout, WorkoutPlan, WorkoutRoutine } from '../../src/types';

function routine(id: string, name = id, planId?: string): WorkoutRoutine {
  return { id, name, type: 'Strength', exercises: [], planId, createdAt: 0, updatedAt: 0 };
}

function plan(id: string, routines: WorkoutRoutine[]): WorkoutPlan {
  return { id, name: id, routines, createdAt: 0, updatedAt: 0 };
}

function workout(overrides: Partial<Workout> & { completedAt: number }): Workout {
  return {
    id: `w-${overrides.completedAt}-${overrides.routineId ?? 'x'}`,
    name: 'Session',
    type: 'Strength',
    startedAt: overrides.completedAt - 3600_000,
    note: '',
    exercises: [],
    ...overrides,
  };
}

const MON = new Date(2026, 0, 5, 12); // Monday 5 Jan 2026
const day = (offset: number, hour = 10): number => new Date(2026, 0, 5 + offset, hour).getTime();

test('rotates to the next routine in the plan you last trained', () => {
  const routines = [routine('a', 'A', 'p1'), routine('b', 'B', 'p1'), routine('c', 'C', 'p1')];
  const plans = [plan('p1', routines)];
  const completed = [workout({ completedAt: day(-1), planId: 'p1', routineId: 'a' })];
  const suggestion = suggestNextWorkout({ completedWorkouts: completed, plans, standaloneRoutines: [], now: MON });
  expect(suggestion?.routine.id).toBe('b');
  expect(suggestion?.plan?.id).toBe('p1');
});

test('wraps around to the first routine after the last one', () => {
  const routines = [routine('a', 'A', 'p1'), routine('b', 'B', 'p1')];
  const plans = [plan('p1', routines)];
  const completed = [workout({ completedAt: day(-1), planId: 'p1', routineId: 'b' })];
  const suggestion = suggestNextWorkout({ completedWorkouts: completed, plans, standaloneRoutines: [], now: MON });
  expect(suggestion?.routine.id).toBe('a');
});

test('falls back to the weekday habit when no plan rotation applies', () => {
  const legs = routine('legs', 'Legs');
  // Two prior Mondays did "legs"; today is Monday.
  const completed = [
    workout({ completedAt: day(-7), routineId: 'legs' }),
    workout({ completedAt: day(-14), routineId: 'legs' }),
  ];
  const suggestion = suggestNextWorkout({ completedWorkouts: completed, plans: [], standaloneRoutines: [legs], now: MON });
  expect(suggestion?.routine.id).toBe('legs');
});

test('falls back to the most recent routine when there is no weekday habit', () => {
  const push = routine('push', 'Push');
  // Only session is on a Tuesday, so no Monday habit exists for today (Monday).
  const completed = [workout({ completedAt: day(1), routineId: 'push' })];
  const suggestion = suggestNextWorkout({ completedWorkouts: completed, plans: [], standaloneRoutines: [push], now: MON });
  expect(suggestion?.routine.id).toBe('push');
});

test('returns null when nothing ties to an existing routine', () => {
  const completed = [workout({ completedAt: day(-1) })]; // blank session, no routineId
  expect(suggestNextWorkout({ completedWorkouts: completed, plans: [], standaloneRoutines: [], now: MON })).toBeNull();
});

test('ignores a deleted plan and suggests from remaining history', () => {
  const push = routine('push', 'Push');
  const completed = [
    workout({ completedAt: day(-1), planId: 'gone', routineId: 'ghost' }),
    workout({ completedAt: day(-2), routineId: 'push' }),
  ];
  const suggestion = suggestNextWorkout({ completedWorkouts: completed, plans: [], standaloneRoutines: [push], now: MON });
  expect(suggestion?.routine.id).toBe('push');
});
