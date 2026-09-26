import { expect, test } from '@playwright/test';
import { exercisesWithAddedPrevious } from '../../src/domain/workouts/nextSessionTargets';
import type { Workout, WorkoutExercise } from '../../src/types';

const set = (over: Partial<any> = {}) => ({ id: 's'+Math.random(), weight: '', reps: '', completed: false, ...over });

test('fills previous for a newly added exercise from prior history', () => {
  const history: Workout[] = [{
    id: 'w1', name: 'Old', type: 'Strength', startedAt: 1000, completedAt: 2000,
    durationSeconds: 60,
    exercises: [{
      id: 'e1', exerciseId: 'bench', name: 'Bench Press', trackingType: 'weight-reps',
      sets: [ set({ weight: '100', reps: '5', completed: true }), set({ weight: '100', reps: '4', completed: true }) ],
    } as unknown as WorkoutExercise],
  } as unknown as Workout];

  const added: WorkoutExercise[] = [{
    id: 'e2', exerciseId: 'bench', name: 'Bench Press', trackingType: 'weight-reps',
    sets: [ set(), set(), set() ],
  } as unknown as WorkoutExercise];

  const filled = exercisesWithAddedPrevious(added, history);
  expect(filled[0].sets[0].previous).toBe('100 × 5');
  expect(filled[0].sets[1].previous).toBe('100 × 4');
  expect(filled[0].sets[2].previous).toBeUndefined();
});

test('no history leaves previous unset', () => {
  const added: WorkoutExercise[] = [{ id: 'e', name: 'Curl', trackingType: 'weight-reps', sets: [set()] } as unknown as WorkoutExercise];
  expect(exercisesWithAddedPrevious(added, []) [0].sets[0].previous).toBeUndefined();
});
