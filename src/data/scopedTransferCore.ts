import { FORGE_TRANSFER_VERSION, type DataTransferSelection, type ForgeDataTransfer } from './transferFormat';
import { defaultSettingsPreferences } from './settingsDefaults';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import type {
  PlansState,
  SettingsPreferences,
  Workout,
  WorkoutRoutine,
  WorkoutState,
  WorkoutTypePreference,
} from '../types';

/**
 * Pure derivation of a portable transfer centred on a single item plus only its
 * dependencies — the custom exercises it references and any custom workout type
 * it uses. Built-in catalogue exercises/types are universal and never travel,
 * and no history or personal preferences (bodyweight, units, appearance) are
 * included. This module has no storage/native imports so it is unit-testable;
 * `scopedTransfer` wraps it with the actual repository loads.
 */
export type ShareScope =
  | { kind: 'routine'; id: string }
  | { kind: 'plan'; id: string }
  | { kind: 'workout'; id: string }
  | { kind: 'exercise'; id: string };

export type ScopedTransferState = {
  settings: SettingsPreferences;
  plans: PlansState;
  workouts: WorkoutState;
  customExercises: ExerciseCatalogItem[];
};

const emptyPlans = (): PlansState => ({ plans: [], standaloneRoutines: [] });
const emptyWorkouts = (): WorkoutState => ({ activeWorkout: null, completedWorkouts: [] });
const noSelection: DataTransferSelection = {
  workouts: false,
  plans: false,
  exercises: false,
  workoutTypes: false,
  measurements: false,
};

function exerciseIdsOf(exercises: readonly { exerciseId?: string }[]): Set<string> {
  return new Set(
    exercises.map((exercise) => exercise.exerciseId).filter((id): id is string => Boolean(id)),
  );
}

function matchesType(type: WorkoutTypePreference, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return type.name.trim().toLowerCase() === normalized || type.id.toLowerCase() === normalized;
}

// A shared item's `type` may be a built-in name (no stored record) or a custom
// type; carry only the custom records that back the item's types.
function customTypesFor(types: string[], all: WorkoutTypePreference[]): WorkoutTypePreference[] {
  return all.filter((type) => types.some((value) => matchesType(type, value)));
}

function findRoutine(plans: PlansState, id: string): WorkoutRoutine | undefined {
  return (
    plans.standaloneRoutines.find((routine) => routine.id === id) ??
    plans.plans.flatMap((plan) => plan.routines).find((routine) => routine.id === id)
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function workoutSummary(workout: Workout): string {
  const date = new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString();
  return `${date} · ${plural(workout.exercises.length, 'exercise')}`;
}

export function scopedTransferFrom(
  { settings, plans, workouts, customExercises }: ScopedTransferState,
  scope: ShareScope,
): ForgeDataTransfer {
  const base = {
    format: 'forge-data' as const,
    version: FORGE_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
  };
  const scopedSettings = (workoutTypes: WorkoutTypePreference[]): SettingsPreferences => ({
    ...defaultSettingsPreferences,
    workoutTypes,
    dailyMeasurementDefinitions: [],
    dailyMeasurementEntries: [],
  });
  const withCustom = (refIds: Set<string>): ExerciseCatalogItem[] =>
    customExercises.filter((exercise) => refIds.has(exercise.id));

  if (scope.kind === 'routine') {
    const routine = findRoutine(plans, scope.id);
    if (!routine) throw new Error('That routine is no longer available.');
    const usedCustom = withCustom(exerciseIdsOf(routine.exercises));
    const usedTypes = customTypesFor([routine.type], settings.workoutTypes);
    return {
      ...base,
      settings: scopedSettings(usedTypes),
      // Shared as a standalone routine — the recipient has no matching plan.
      plans: { plans: [], standaloneRoutines: [{ ...routine, planId: undefined }] },
      workouts: emptyWorkouts(),
      customExercises: usedCustom,
      selection: {
        ...noSelection,
        plans: true,
        exercises: usedCustom.length > 0,
        workoutTypes: usedTypes.length > 0,
      },
      share: { kind: 'routine', title: routine.name || 'Routine', summary: plural(routine.exercises.length, 'exercise') },
    };
  }

  if (scope.kind === 'plan') {
    const plan = plans.plans.find((item) => item.id === scope.id);
    if (!plan) throw new Error('That plan is no longer available.');
    const usedCustom = withCustom(exerciseIdsOf(plan.routines.flatMap((routine) => routine.exercises)));
    const usedTypes = customTypesFor(plan.routines.map((routine) => routine.type), settings.workoutTypes);
    return {
      ...base,
      settings: scopedSettings(usedTypes),
      plans: { plans: [plan], standaloneRoutines: [] },
      workouts: emptyWorkouts(),
      customExercises: usedCustom,
      selection: {
        ...noSelection,
        plans: true,
        exercises: usedCustom.length > 0,
        workoutTypes: usedTypes.length > 0,
      },
      share: { kind: 'plan', title: plan.name || 'Plan', summary: plural(plan.routines.length, 'routine') },
    };
  }

  if (scope.kind === 'workout') {
    const workout = workouts.completedWorkouts.find((item) => item.id === scope.id);
    if (!workout) throw new Error('That workout is no longer available.');
    const usedCustom = withCustom(exerciseIdsOf(workout.exercises));
    const usedTypes = customTypesFor([workout.type], settings.workoutTypes);
    return {
      ...base,
      settings: scopedSettings(usedTypes),
      plans: emptyPlans(),
      workouts: { activeWorkout: null, completedWorkouts: [workout] },
      customExercises: usedCustom,
      selection: {
        ...noSelection,
        workouts: true,
        exercises: usedCustom.length > 0,
        workoutTypes: usedTypes.length > 0,
      },
      share: { kind: 'workout', title: workout.name || 'Workout', summary: workoutSummary(workout) },
    };
  }

  const exercise = customExercises.find((item) => item.id === scope.id);
  if (!exercise) throw new Error('That custom exercise is no longer available.');
  return {
    ...base,
    settings: scopedSettings([]),
    plans: emptyPlans(),
    workouts: emptyWorkouts(),
    customExercises: [exercise],
    selection: { ...noSelection, exercises: true },
    share: { kind: 'exercise', title: exercise.name || 'Exercise', summary: exercise.group },
  };
}
