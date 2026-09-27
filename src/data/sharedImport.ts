import { createImportId } from './dataTransferNormalization';
import { distinctName, normalizeName, type ImportRename } from './dataTransferPlans';
import type { ForgeDataTransfer } from './transferFormat';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import type { Workout } from '../types';

/**
 * A shared single item is meant to be *added* to the recipient's collection, not
 * synced — so give its top-level records fresh ids. That way a share always
 * imports as a new copy (the review shows it as new, the merge appends it),
 * even when the sender and recipient are the same device. Full-data backups keep
 * their ids so a restore stays idempotent, so this only touches share files.
 */
export function freshenSharedIds(transfer: ForgeDataTransfer): ForgeDataTransfer {
  switch (transfer.share?.kind) {
    case 'routine':
      return {
        ...transfer,
        plans: {
          ...transfer.plans,
          standaloneRoutines: transfer.plans.standaloneRoutines.map((routine) => ({ ...routine, id: createImportId() })),
        },
      };
    case 'plan':
      return {
        ...transfer,
        plans: {
          ...transfer.plans,
          plans: transfer.plans.plans.map((plan) => {
            const id = createImportId();
            return { ...plan, id, routines: plan.routines.map((routine) => ({ ...routine, id: createImportId(), planId: id })) };
          }),
        },
      };
    case 'workout':
      return {
        ...transfer,
        workouts: {
          ...transfer.workouts,
          completedWorkouts: transfer.workouts.completedWorkouts.map((workout) => ({ ...workout, id: createImportId() })),
        },
      };
    case 'exercise':
      return { ...transfer, customExercises: transfer.customExercises.map((exercise) => ({ ...exercise, id: createImportId() })) };
    default:
      return transfer;
  }
}

/**
 * Rename shared workouts / custom exercises that clash by name with what's
 * already on device, so an added copy is distinguishable ("Pull - Extension" ->
 * "Pull - Extension - imported"). Routine/plan names are handled by the plan
 * merge; this covers the two flat categories. Only runs for share files.
 */
export function renameSharedWorkouts(
  workouts: readonly Workout[],
  currentNames: readonly string[],
  renamed: ImportRename[],
): Workout[] {
  const taken = new Set(currentNames.map(normalizeName));
  return workouts.map((workout) => {
    const to = distinctName(workout.name || 'Workout', taken);
    if (to !== workout.name) renamed.push({ from: workout.name, to });
    return to === workout.name ? workout : { ...workout, name: to };
  });
}

export function renameSharedExercises(
  exercises: readonly ExerciseCatalogItem[],
  currentNames: readonly string[],
  renamed: ImportRename[],
): ExerciseCatalogItem[] {
  const taken = new Set(currentNames.map(normalizeName));
  return exercises.map((exercise) => {
    const to = distinctName(exercise.name || 'Exercise', taken);
    if (to !== exercise.name) renamed.push({ from: exercise.name, to });
    return to === exercise.name ? exercise : { ...exercise, name: to };
  });
}
