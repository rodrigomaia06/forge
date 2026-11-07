import { expect, test } from '@playwright/test';
import { exercisesWithAddedPrevious, routineExercisesWithNextSessionTargets, withPreviousForAppended, withPreviousRefreshed } from '../../src/domain/workouts/nextSessionTargets';
import type { WorkoutRoutine } from '../../src/types';
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

const logged = (exercises: unknown[], completedAt = 2000): Workout => ({
  id: `w${completedAt}`, name: 'Old', type: 'Strength', startedAt: completedAt - 1000, completedAt,
  durationSeconds: 60, note: '', exercises,
} as unknown as Workout);

test('a removed and re-added exercise gets previous back without touching earlier exercises', () => {
  const history = [logged([
    { id: 'h1', exerciseId: 'back-extension', name: 'Back Extension', trackingType: 'bodyweight-reps', sets: [set({ reps: '12', completed: true })] },
  ])];
  const kept = { id: 'k', exerciseId: 'curl', name: 'Curl', trackingType: 'weight-reps', sets: [set({ previous: '10 × 10' })] } as unknown as WorkoutExercise;
  const readded = { id: 'r', exerciseId: 'back-extension', name: 'Back Extension', trackingType: 'bodyweight-reps', sets: [set()] } as unknown as WorkoutExercise;
  const result = withPreviousForAppended([kept, readded], 1, history);
  expect(result[0]).toBe(kept);
  expect(result[1].sets[0].previous).toBe('12');
});

test('previous falls back to a same-movement session logged under another mode, showing shared fields only', () => {
  const history = [logged([
    { id: 'h1', exerciseId: 'back-extension', name: 'Back Extension', trackingType: 'weight-reps', sets: [set({ weight: '10', reps: '15', completed: true })] },
  ])];
  const added = [{ id: 'a', exerciseId: 'back-extension', name: 'Back Extension', trackingType: 'bodyweight-reps', sets: [set()] } as unknown as WorkoutExercise];
  expect(exercisesWithAddedPrevious(added, history)[0].sets[0].previous).toBe('15');
});

test('the tracking fallback never feeds next-session targets', () => {
  const history = [logged([
    { id: 'h1', exerciseId: 'back-extension', name: 'Back Extension', trackingType: 'weight-reps', sets: [set({ weight: '10', reps: '15', completed: true, targets: [{ id: 't', kind: 'reps', unit: 'count', minValue: 18, maxValue: 18 }] })] },
  ])];
  const routine = { id: 'r', name: 'R', type: 'Strength', createdAt: 1, updatedAt: 1, exercises: [
    { id: 'x', exerciseId: 'back-extension', name: 'Back Extension', trackingType: 'bodyweight-reps', sets: [{ id: 'rs' }] },
  ] } as unknown as WorkoutRoutine;
  const [exercise] = routineExercisesWithNextSessionTargets(routine, history);
  expect(exercise.sets?.[0].previous).toBe('15');
  expect(exercise.sets?.[0].plannedTargets ?? []).toEqual([]);
});

test('replacing an exercise drops the old movement previous and refills from the replacement history', () => {
  const history = [logged([
    { id: 'h1', exerciseId: 'row', name: 'Row', trackingType: 'weight-reps', sets: [set({ weight: '70', reps: '8', completed: true })] },
  ])];
  const other = { id: 'o', exerciseId: 'curl', name: 'Curl', trackingType: 'weight-reps', sets: [set({ previous: '10 × 10' })] } as unknown as WorkoutExercise;
  const replaced = { id: 'x', exerciseId: 'row', name: 'Row', trackingType: 'weight-reps', sets: [set({ previous: '100 × 5' }), set({ previous: '100 × 5' })] } as unknown as WorkoutExercise;
  const result = withPreviousRefreshed([other, replaced], 'x', history);
  expect(result[0]).toBe(other);
  expect(result[1].sets[0].previous).toBe('70 × 8');
  expect(result[1].sets[1].previous).toBeUndefined();
  expect(withPreviousRefreshed([replaced], 'x', [])[0].sets[0].previous).toBeUndefined();
});
