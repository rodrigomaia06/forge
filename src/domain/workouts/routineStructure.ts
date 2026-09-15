import type { SetTarget, Workout, WorkoutExerciseInput, WorkoutRoutine } from '../../types';

/** The reusable portion of a routine, deliberately excluding session logging data. */
export interface RoutineStructureBaseline {
  exercises: WorkoutExerciseInput[];
}

function copyTargets(targets: readonly SetTarget[] | undefined): SetTarget[] | undefined {
  return targets?.map((target) => ({ ...target }));
}

function copyExercises(exercises: readonly WorkoutExerciseInput[] | Workout['exercises']): WorkoutExerciseInput[] {
  return exercises.map((exercise) => ({
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    supersetId: exercise.supersetId,
    metric: exercise.metric,
    trackingType: exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps',
    exerciseSnapshot: exercise.exerciseSnapshot ? { ...exercise.exerciseSnapshot, equipment: exercise.exerciseSnapshot.equipment ? [...exercise.exerciseSnapshot.equipment] : undefined } : undefined,
    sets: (exercise.sets ?? []).map((set) => ({ id: set.id, plannedTargets: copyTargets(set.plannedTargets) })),
  }));
}

export function routineStructureBaseline(exercises: readonly WorkoutExerciseInput[]): RoutineStructureBaseline {
  return { exercises: copyExercises(exercises) };
}

function structureComparable(exercises: readonly WorkoutExerciseInput[] | Workout['exercises']): string {
  return JSON.stringify(copyExercises(exercises).map((exercise) => ({
    id: exercise.id,
    exerciseId: exercise.exerciseId ?? exercise.exerciseSnapshot?.id ?? exercise.name,
    supersetId: exercise.supersetId,
    trackingType: exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType,
    sets: (exercise.sets ?? []).map((set) => ({
      id: set.id,
      plannedTargets: (set.plannedTargets ?? []).map(({ kind, unit, minValue, maxValue }) => ({ kind, unit, minValue, maxValue })),
    })),
  })));
}

export function hasRoutineStructureChanged(workout: Workout): boolean {
  const baseline = workout.routineStructureBaseline;
  return baseline !== undefined && structureComparable(workout.exercises) !== structureComparable(baseline.exercises);
}

/** Copies only reusable structure back to a routine; logged workout state is never retained. */
export function applyWorkoutStructureToRoutine(routine: WorkoutRoutine, workout: Workout): WorkoutRoutine {
  const priorById = new Map(routine.exercises.map((exercise) => [exercise.id, exercise]));
  return {
    ...routine,
    exercises: copyExercises(workout.exercises).map((exercise) => ({
      ...exercise,
      // An existing routine exercise keeps its reusable note. A live note is
      // session data and must not silently overwrite it when structure syncs.
      note: priorById.get(exercise.id ?? '')?.note,
    })),
  };
}
