import type { FinishRoutineChoice, PlansState, Workout, WorkoutRoutine } from '../../types';
import { applyWorkoutStructureToRoutine, hasRoutineStructureChanged } from './routineStructure';

export function workoutFinishSummary(workout: Workout) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) =>
    set.sideCompletion ? set.sideCompletion.left && set.sideCompletion.right : set.completed,
  ).length;
  return { total: sets.length, completed, incomplete: sets.length - completed };
}

export function workoutNeedsFinishReview(workout: Workout, source?: WorkoutRoutine): boolean {
  if (!workout.exercises.length) return false;
  return (
    workoutFinishSummary(workout).incomplete > 0 ||
    Boolean(workout.routineId && (hasRoutineStructureChanged(workout) || !source))
  );
}

/** Pure projection shared by the native transaction and browser transaction. */
export function finishRoutineState(
  state: PlansState,
  workout: Workout,
  choice: FinishRoutineChoice,
): PlansState {
  const source = [
    ...state.standaloneRoutines,
    ...state.plans.flatMap((plan) => plan.routines),
  ].find((routine) => routine.id === workout.routineId);
  if (!choice) throw new Error('Choose a routine outcome.');
  if (choice.kind === 'keep') return state;
  if (choice.kind === 'update' && !source)
    throw new Error('The original routine was deleted. Choose another outcome.');
  if (choice.kind === 'update') {
    const update = (routine: WorkoutRoutine) =>
      routine.id === source!.id
        ? {
            ...applyWorkoutStructureToRoutine(routine, workout),
            updatedAt: workout.completedAt ?? Date.now(),
          }
        : routine;
    return {
      plans: state.plans.map((plan) => ({ ...plan, routines: plan.routines.map(update) })),
      standaloneRoutines: state.standaloneRoutines.map(update),
    };
  }
  const name = choice.name.trim();
  if (!name) throw new Error('Enter a routine name.');
  const id = `routine-from-${workout.id}`;
  const planId = workout.planId ?? source?.planId;
  const destination = state.plans.find((plan) => plan.id === planId);
  const base: WorkoutRoutine = source ?? {
    id,
    name,
    type: workout.type,
    exercises: workout.routineStructureBaseline?.reusableExercises ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const reusable = applyWorkoutStructureToRoutine(base, workout);
  const supersets = new Map<string, string>();
  const routine: WorkoutRoutine = {
    ...reusable,
    id,
    name,
    planId: destination?.id,
    createdAt: workout.completedAt ?? Date.now(),
    updatedAt: workout.completedAt ?? Date.now(),
    exercises: reusable.exercises.map((exercise, index) => {
      if (exercise.supersetId && !supersets.has(exercise.supersetId))
        supersets.set(exercise.supersetId, `${id}-superset-${index}`);
      return {
        ...exercise,
        id: `${id}-exercise-${index}`,
        supersetId: exercise.supersetId ? supersets.get(exercise.supersetId) : undefined,
        sets: exercise.sets?.map((set, setIndex) => ({
          ...set,
          id: `${id}-exercise-${index}-set-${setIndex}`,
        })),
      };
    }),
  };
  return {
    plans: state.plans.map((plan) =>
      plan.id === destination?.id ? { ...plan, routines: [...plan.routines, routine] } : plan,
    ),
    standaloneRoutines: destination
      ? state.standaloneRoutines
      : [...state.standaloneRoutines, routine],
  };
}
