import { expect, test } from '@playwright/test';
import {
  routineStructureBaseline,
  hasRoutineStructureChanged,
  applyWorkoutStructureToRoutine,
} from '../../src/domain/workouts/routineStructure';
import type { Workout, WorkoutExerciseInput, WorkoutRoutine } from '../../src/types';

const routineExercises: WorkoutExerciseInput[] = [
  {
    id: 'ex1', exerciseId: 'bench', name: 'Bench Press',
    sets: [
      { id: 's1', plannedTargets: [{ id: 't1', kind: 'reps', unit: 'count', minValue: 8, maxValue: 10 }] },
      { id: 's2' },
    ],
  },
];

function workout(exercises: unknown[], baseline: WorkoutExerciseInput[]): Workout {
  return {
    id: 'w1', name: 'W', type: 'Strength', startedAt: 0, completedAt: null, note: '',
    exercises: exercises as Workout['exercises'],
    routineStructureBaseline: routineStructureBaseline(baseline),
  } as Workout;
}

test.describe('routineStructure', () => {
  test('warm-up sets do not count as a structural change', () => {
    const withWarmup = [{
      ...routineExercises[0],
      sets: [{ id: 'wu', tag: 'Warm Up' }, ...routineExercises[0].sets!],
    }];
    expect(hasRoutineStructureChanged(workout(withWarmup, routineExercises))).toBe(false);
  });

  test('adding a real working set is a structural change', () => {
    const withRealSet = [{
      ...routineExercises[0],
      sets: [...routineExercises[0].sets!, { id: 's3' }],
    }];
    expect(hasRoutineStructureChanged(workout(withRealSet, routineExercises))).toBe(true);
  });

  test('sync-back drops warm-ups and keeps the routine planned targets, not next-session ones', () => {
    const routine: WorkoutRoutine = {
      id: 'r1', name: 'R', type: 'Strength', exercises: routineExercises, createdAt: 0, updatedAt: 0,
    };
    const liveExercises = [{
      ...routineExercises[0],
      sets: [
        { id: 'wu', tag: 'Warm Up' },
        { id: 's1', plannedTargets: [{ id: 's1-next-reps', kind: 'reps', unit: 'count', minValue: 11, maxValue: 12 }] },
        { id: 's2' },
      ],
    }];
    const updated = applyWorkoutStructureToRoutine(routine, workout(liveExercises, routineExercises));
    expect(updated.exercises[0].sets!.map((s) => s.id)).toEqual(['s1', 's2']);
    // s1 keeps the routine's original 8–10 interval, not the session's 11–12 "next" target.
    expect(updated.exercises[0].sets![0].plannedTargets?.[0].minValue).toBe(8);
    expect(updated.exercises[0].sets![0].plannedTargets?.[0].id).toBe('t1');
    // s2 had no routine target and gains none.
    expect(updated.exercises[0].sets![1].plannedTargets).toBeUndefined();
  });
});
