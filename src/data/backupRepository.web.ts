import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ExerciseCatalogItem } from './exerciseCatalog';
import { loadCustomExercises, saveCustomExercises } from './exerciseRepository';
import { mergeImportedPlans, type ImportRename } from './dataTransferPlans';
import { renameSharedExercises, renameSharedWorkouts } from './sharedImport';
import { normalizeDataTransfer } from './dataTransferNormalization';
import { loadPlansState, savePlansState } from './plansRepository';
import { loadSettingsPreferences, saveSettingsPreferences } from './settingsRepository';
import { uniqueById } from './uniqueById';
import { loadWorkoutState, saveActiveWorkout, saveCompletedWorkouts } from './workoutRepository';
import type { PlansState, SettingsPreferences, WorkoutState } from '../types';

export const FORGE_TRANSFER_VERSION = 1;
export type DataTransferCategory =
  'workouts' | 'plans' | 'exercises' | 'workoutTypes' | 'measurements';
export type DataTransferSelection = Record<DataTransferCategory, boolean>;
export type DataTransferCategorySummary = {
  available: number;
  newRecords: number;
  existingRecords: number;
  planCount?: number;
  routineCount?: number;
};
export type DataTransferInspection = {
  exportedAt: string;
  categories: Record<DataTransferCategory, DataTransferCategorySummary>;
  activeWorkout: boolean;
};
export type DataTransferMergeResult = {
  categories: Record<DataTransferCategory, number>;
  activeWorkoutAdded: boolean;
  renamed: ImportRename[];
};
export type ForgeDataTransfer = {
  format: 'forge-data';
  version: number;
  exportedAt: string;
  settings: SettingsPreferences;
  plans: PlansState;
  workouts: WorkoutState;
  customExercises: ExerciseCatalogItem[];
  selection?: DataTransferSelection;
  share?: { kind: 'routine' | 'plan' | 'workout' | 'exercise'; title: string; summary?: string };
};
export type BackupInspection = {
  bytes: Uint8Array;
  workoutCount: number;
  activeWorkout: boolean;
  planCount: number;
  customExerciseCount: number;
};

export const allDataTransferSelection = (): DataTransferSelection => ({
  workouts: true,
  plans: true,
  exercises: true,
  workoutTypes: true,
  measurements: true,
});

function download(name: string, type: string, body: string): void {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function createDataTransfer(
  selection = allDataTransferSelection(),
): Promise<ForgeDataTransfer> {
  const [settings, plans, workouts, customExercises] = await Promise.all([
    loadSettingsPreferences(),
    loadPlansState(),
    loadWorkoutState(),
    loadCustomExercises(),
  ]);
  return {
    format: 'forge-data',
    version: FORGE_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    selection,
    settings: {
      ...settings,
      workoutTypes: selection.workoutTypes ? settings.workoutTypes : [],
      dailyMeasurementDefinitions: selection.measurements
        ? settings.dailyMeasurementDefinitions
        : [],
      dailyMeasurementEntries: selection.measurements ? settings.dailyMeasurementEntries : [],
    },
    plans: selection.plans ? plans : { plans: [], standaloneRoutines: [] },
    workouts: selection.workouts ? workouts : { activeWorkout: null, completedWorkouts: [] },
    customExercises: selection.exercises ? customExercises : [],
  };
}

export async function exportJson(selection = allDataTransferSelection()): Promise<void> {
  download(
    'forge-data.json',
    'application/json',
    JSON.stringify(await createDataTransfer(selection), null, 2),
  );
}

export async function exportText(selection = allDataTransferSelection()): Promise<void> {
  const data = await createDataTransfer(selection);
  download(
    'forge-data.txt',
    'text/plain',
    `Forge training data\nExported: ${data.exportedAt}\nCompleted workouts: ${data.workouts.completedWorkouts.length}\nPlans: ${data.plans.plans.length}\nCustom exercises: ${data.customExercises.length}`,
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRecordList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isObject);
}

function isTransfer(value: unknown): value is ForgeDataTransfer {
  if (
    !isObject(value) ||
    value.format !== 'forge-data' ||
    value.version !== FORGE_TRANSFER_VERSION ||
    typeof value.exportedAt !== 'string'
  )
    return false;
  if (
    !isObject(value.settings) ||
    !isObject(value.plans) ||
    !isObject(value.workouts) ||
    !isRecordList(value.customExercises)
  )
    return false;
  if (
    !isRecordList(value.settings.workoutTypes) ||
    !isRecordList(value.settings.dailyMeasurementDefinitions) ||
    !isRecordList(value.settings.dailyMeasurementEntries)
  )
    return false;
  if (
    !isRecordList(value.plans.plans) ||
    !isRecordList(value.plans.standaloneRoutines) ||
    !isRecordList(value.workouts.completedWorkouts)
  )
    return false;
  return value.workouts.activeWorkout === null || isObject(value.workouts.activeWorkout);
}

export function parseDataTransfer(raw: string): ForgeDataTransfer {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('This is not valid Forge JSON.');
  }
  if (!isTransfer(value)) throw new Error('This JSON is not a compatible Forge data export.');
  return normalizeDataTransfer(value);
}

async function chooseJson(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

export async function pickJsonTransfer(): Promise<ForgeDataTransfer | null> {
  const raw = await chooseJson();
  return raw ? parseDataTransfer(raw) : null;
}

export async function inspectDataTransfer(
  incoming: ForgeDataTransfer,
  selection = allDataTransferSelection(),
): Promise<DataTransferInspection> {
  const [settings, plans, workouts, exercises] = await Promise.all([
    loadSettingsPreferences(),
    loadPlansState(),
    loadWorkoutState(),
    loadCustomExercises(),
  ]);
  const summary = <T extends { id: string }>(
    addition: T[],
    current: T[],
  ): DataTransferCategorySummary => {
    const ids = new Set(current.map(({ id }) => id));
    const unique = uniqueById(addition);
    return {
      available: unique.length,
      newRecords: unique.filter(({ id }) => !ids.has(id)).length,
      existingRecords: unique.filter(({ id }) => ids.has(id)).length,
    };
  };
  const skipped = { available: 0, newRecords: 0, existingRecords: 0 };
  return {
    exportedAt: incoming.exportedAt,
    activeWorkout: Boolean(
      selection.workouts && incoming.workouts.activeWorkout && !workouts.activeWorkout,
    ),
    categories: {
      workouts: selection.workouts
        ? summary(incoming.workouts.completedWorkouts, workouts.completedWorkouts)
        : skipped,
      plans: selection.plans
        ? (() => {
            const routines = (state: PlansState) => [
              ...state.plans.flatMap((plan) => plan.routines),
              ...state.standaloneRoutines,
            ];
            const planSummary = summary(incoming.plans.plans, plans.plans);
            const routineSummary = summary(routines(incoming.plans), routines(plans));
            return {
              available: planSummary.available + routineSummary.available,
              newRecords: planSummary.newRecords + routineSummary.newRecords,
              existingRecords: planSummary.existingRecords + routineSummary.existingRecords,
              planCount: planSummary.available,
              routineCount: routineSummary.available,
            };
          })()
        : skipped,
      exercises: selection.exercises ? summary(incoming.customExercises, exercises) : skipped,
      workoutTypes: selection.workoutTypes
        ? summary(incoming.settings.workoutTypes, settings.workoutTypes)
        : skipped,
      measurements: selection.measurements
        ? summary(
            [
              ...incoming.settings.dailyMeasurementDefinitions,
              ...incoming.settings.dailyMeasurementEntries,
            ],
            [...settings.dailyMeasurementDefinitions, ...settings.dailyMeasurementEntries],
          )
        : skipped,
    },
  };
}

export async function mergeDataTransfer(
  incoming: ForgeDataTransfer,
  selection = allDataTransferSelection(),
): Promise<DataTransferMergeResult> {
  incoming = normalizeDataTransfer(incoming);
  const [settings, plans, workouts, exercises] = await Promise.all([
    loadSettingsPreferences(),
    loadPlansState(),
    loadWorkoutState(),
    loadCustomExercises(),
  ]);
  const merge = <T extends { id: string }>(current: T[], addition: T[]): T[] =>
    uniqueById([...current, ...addition]);
  const renamed: ImportRename[] = [];
  const incomingWorkouts = incoming.share
    ? renameSharedWorkouts(incoming.workouts.completedWorkouts, workouts.completedWorkouts.map((w) => w.name), renamed)
    : incoming.workouts.completedWorkouts;
  const incomingExercises = incoming.share
    ? renameSharedExercises(incoming.customExercises, exercises.map((e) => e.name), renamed)
    : incoming.customExercises;
  const completed = selection.workouts
    ? merge(workouts.completedWorkouts, incomingWorkouts)
    : workouts.completedWorkouts;
  const importedActive =
    selection.workouts &&
    incoming.workouts.activeWorkout &&
    !completed.some((workout) => workout.id === incoming.workouts.activeWorkout?.id)
      ? incoming.workouts.activeWorkout
      : null;
  const custom = selection.exercises ? merge(exercises, incomingExercises) : exercises;
  const mergedPlanState = selection.plans ? mergeImportedPlans(plans, incoming.plans, renamed) : plans;
  const mergedPlans = mergedPlanState.plans;
  const mergedStandaloneRoutines = mergedPlanState.standaloneRoutines;
  const mergedSettings = {
    ...settings,
    workoutTypes: selection.workoutTypes
      ? merge(settings.workoutTypes, incoming.settings.workoutTypes ?? [])
      : settings.workoutTypes,
    dailyMeasurementDefinitions: selection.measurements
      ? merge(
          settings.dailyMeasurementDefinitions,
          incoming.settings.dailyMeasurementDefinitions ?? [],
        )
      : settings.dailyMeasurementDefinitions,
    dailyMeasurementEntries: selection.measurements
      ? merge(settings.dailyMeasurementEntries, incoming.settings.dailyMeasurementEntries ?? [])
      : settings.dailyMeasurementEntries,
  };
  await Promise.all([
    saveSettingsPreferences(mergedSettings),
    savePlansState({ plans: mergedPlans, standaloneRoutines: mergedStandaloneRoutines }),
    saveCompletedWorkouts(completed),
    saveCustomExercises(custom),
    !workouts.activeWorkout && importedActive
      ? saveActiveWorkout(importedActive)
      : Promise.resolve(),
  ]);
  return {
    categories: {
      workouts: completed.length - workouts.completedWorkouts.length,
      plans:
        mergedPlans.length +
        mergedPlans.flatMap((plan) => plan.routines).length +
        mergedStandaloneRoutines.length -
        plans.plans.length -
        plans.plans.flatMap((plan) => plan.routines).length -
        plans.standaloneRoutines.length,
      exercises: custom.length - exercises.length,
      workoutTypes: mergedSettings.workoutTypes.length - settings.workoutTypes.length,
      measurements:
        mergedSettings.dailyMeasurementDefinitions.length +
        mergedSettings.dailyMeasurementEntries.length -
        settings.dailyMeasurementDefinitions.length -
        settings.dailyMeasurementEntries.length,
    },
    activeWorkoutAdded: Boolean(!workouts.activeWorkout && importedActive),
    renamed,
  };
}

export async function importJson(): Promise<DataTransferMergeResult | null> {
  const incoming = await pickJsonTransfer();
  return incoming ? mergeDataTransfer(incoming) : null;
}

export async function createSqliteBackup(): Promise<void> {
  throw new Error('Full SQLite backups are available in iOS and Android builds, not on web.');
}

export async function pickSqliteBackup(): Promise<BackupInspection | null> {
  throw new Error('Full SQLite restore is available in iOS and Android builds, not on web.');
}

export async function restoreSqliteBackup(): Promise<void> {
  throw new Error('Full SQLite restore is available in iOS and Android builds, not on web.');
}

export async function eraseAllForgeData(): Promise<void> {
  await AsyncStorage.multiRemove([
    '@forge/diagnostics-v1',
    '@forge/rest-timer-v1',
    '@forge/active-workout',
    '@forge/completed-workouts',
    '@forge/plans-v1',
    '@forge/settings-preferences',
    '@forge/custom-exercises',
  ]);
}

export async function databaseStatus(): Promise<{ tables: number; database: string }> {
  return { tables: 0, database: 'Browser storage' };
}
