import type { Workout, WorkoutRoutine } from '../../types';
import type { CsvDraft } from './types';

/** Routines share exercise resolution and conflict review, but never enter workout history. */
export function routineReviewRecord(routine: WorkoutRoutine): Workout {
  return {
    ...routine,
    note: routine.note ?? '',
    startedAt: routine.createdAt,
    completedAt: routine.createdAt,
    durationSeconds: 0,
    exercises: routine.exercises.map((exercise, index) => ({
      ...exercise,
      id: exercise.id ?? `${routine.id}-exercise-${index}`,
      sets: (exercise.sets ?? []).map((set, index) => ({
        ...set,
        id: set.id ?? `${exercise.id}-set-${index}`,
        weight: set.weight ?? '',
        reps: set.reps ?? '',
        completed: false,
      })),
    })),
  };
}
export function importReviewRecords(draft: CsvDraft): Workout[] {
  return [...draft.workouts, ...(draft.routines ?? []).map(routineReviewRecord)];
}
export function resolvedRoutine(record: Workout, source: WorkoutRoutine): WorkoutRoutine {
  return {
    ...source,
    id: record.id,
    name: record.name,
    exercises: record.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map(({ completed, completedAt, ...set }) => set),
    })),
  };
}
