import type { ForgeDataTransfer } from './transferFormat';
import type { ExerciseCatalogItem } from './exerciseCatalog';

/**
 * Per-item selection for a full data-dump import: which specific records the
 * user chose in each category. `filterTransferToSelection` reduces the transfer
 * to exactly those, then the ordinary merge runs — so the per-item screen needs
 * no changes to the merge itself.
 */
export type ImportSelectionKey =
  'workouts' | 'plans' | 'routines' | 'exercises' | 'workoutTypes' | 'measurements';

export type ImportSelectionIds = Record<ImportSelectionKey, ReadonlySet<string>>;

export type ImportItem = { id: string; label: string; sublabel?: string };
export type ImportCategoryItems = Record<ImportSelectionKey, ImportItem[]>;

export const emptyImportSelection = (): Record<ImportSelectionKey, Set<string>> => ({
  workouts: new Set(),
  plans: new Set(),
  routines: new Set(),
  exercises: new Set(),
  workoutTypes: new Set(),
  measurements: new Set(),
});

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** The individual, selectable records a transfer carries, per category. */
export function transferItems(transfer: ForgeDataTransfer): ImportCategoryItems {
  return {
    workouts: transfer.workouts.completedWorkouts.map((workout) => ({
      id: workout.id,
      label: workout.name || 'Workout',
      sublabel: `${new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString()} · ${count(workout.exercises.length, 'exercise')}`,
    })),
    plans: transfer.plans.plans.map((plan) => ({
      id: plan.id,
      label: plan.name || 'Plan',
      sublabel: count(plan.routines.length, 'routine'),
    })),
    routines: transfer.plans.standaloneRoutines.map((routine) => ({
      id: routine.id,
      label: routine.name || 'Routine',
      sublabel: `${routine.type} · ${count(routine.exercises.length, 'exercise')}`,
    })),
    exercises: transfer.customExercises.map((exercise: ExerciseCatalogItem) => ({
      id: exercise.id,
      label: exercise.name || 'Exercise',
      sublabel: exercise.group,
    })),
    workoutTypes: transfer.settings.workoutTypes.map((type) => ({ id: type.id, label: type.name })),
    measurements: transfer.settings.dailyMeasurementDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.name,
    })),
  };
}

/** Reduce a transfer to only the selected records; measurement entries follow their definition. */
export function filterTransferToSelection(
  transfer: ForgeDataTransfer,
  ids: ImportSelectionIds,
): ForgeDataTransfer {
  return {
    ...transfer,
    settings: {
      ...transfer.settings,
      workoutTypes: transfer.settings.workoutTypes.filter((type) => ids.workoutTypes.has(type.id)),
      dailyMeasurementDefinitions: transfer.settings.dailyMeasurementDefinitions.filter((definition) => ids.measurements.has(definition.id)),
      dailyMeasurementEntries: transfer.settings.dailyMeasurementEntries.filter((entry) => ids.measurements.has(entry.definitionId)),
    },
    plans: {
      plans: transfer.plans.plans.filter((plan) => ids.plans.has(plan.id)),
      standaloneRoutines: transfer.plans.standaloneRoutines.filter((routine) => ids.routines.has(routine.id)),
    },
    workouts: {
      activeWorkout: null,
      completedWorkouts: transfer.workouts.completedWorkouts.filter((workout) => ids.workouts.has(workout.id)),
    },
    customExercises: transfer.customExercises.filter((exercise) => ids.exercises.has(exercise.id)),
    selection: {
      workouts: ids.workouts.size > 0,
      plans: ids.plans.size > 0 || ids.routines.size > 0,
      exercises: ids.exercises.size > 0,
      workoutTypes: ids.workoutTypes.size > 0,
      measurements: ids.measurements.size > 0,
    },
  };
}
