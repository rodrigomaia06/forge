import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import { loadCustomExercises, saveCustomExercises } from './exerciseRepository';
import { withDatabaseMaintenance } from './database';
import { loadPlansState, savePlansState } from './plansRepository';
import { loadSettingsPreferences, saveSettingsPreferences } from './settingsRepository';
import { loadWorkoutState, saveActiveWorkout, saveCompletedWorkouts } from './workoutRepository';
import { uniqueById } from './uniqueById';
import type { PlansState, SettingsPreferences, WorkoutState } from '../types';

export const FORGE_TRANSFER_VERSION = 1;
const REQUIRED_TABLES = ['forge_meta', 'preferences', 'plans', 'routines', 'workouts', 'custom_exercises', 'workout_types'];

export type ForgeDataTransfer = {
  format: 'forge-data';
  version: number;
  exportedAt: string;
  settings: SettingsPreferences;
  plans: PlansState;
  workouts: WorkoutState;
  customExercises: ExerciseCatalogItem[];
  /** Describes the intentionally selected portable sections. Older v1 files safely omit it. */
  selection?: DataTransferSelection;
};

export type DataTransferCategory = 'workouts' | 'plans' | 'exercises' | 'workoutTypes' | 'measurements';
export type DataTransferSelection = Record<DataTransferCategory, boolean>;
export type DataTransferCategorySummary = {
  available: number;
  newRecords: number;
  existingRecords: number;
  /** Only present for Plans & routines, whose parent/child hierarchy matters. */
  planCount?: number;
  routineCount?: number;
};
export type DataTransferInspection = {
  exportedAt: string;
  categories: Record<DataTransferCategory, DataTransferCategorySummary>;
  activeWorkout: boolean;
};

export const allDataTransferSelection = (): DataTransferSelection => ({
  workouts: true,
  plans: true,
  exercises: true,
  workoutTypes: true,
  measurements: true,
});

export type BackupInspection = {
  bytes: Uint8Array;
  workoutCount: number;
  activeWorkout: boolean;
  planCount: number;
  customExerciseCount: number;
};

function stamp(): string { return new Date().toISOString().replace(/[:.]/g, '-'); }
function filename(extension: string): string { return `forge-${stamp()}.${extension}`; }

async function shareFile(file: File, mimeType: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Forge data' });
}

function cacheFile(name: string, contents: Uint8Array | string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  file.write(contents);
  return file;
}

export async function createDataTransfer(selection = allDataTransferSelection()): Promise<ForgeDataTransfer> {
  const [settings, plans, workouts, customExercises] = await Promise.all([
    loadSettingsPreferences(), loadPlansState(), loadWorkoutState(), loadCustomExercises(),
  ]);
  return {
    format: 'forge-data', version: FORGE_TRANSFER_VERSION, exportedAt: new Date().toISOString(),
    settings: {
      ...settings,
      workoutTypes: selection.workoutTypes ? settings.workoutTypes : [],
      dailyMeasurementDefinitions: selection.measurements ? settings.dailyMeasurementDefinitions : [],
      dailyMeasurementEntries: selection.measurements ? settings.dailyMeasurementEntries : [],
    },
    plans: selection.plans ? plans : { plans: [], standaloneRoutines: [] },
    workouts: selection.workouts ? workouts : { activeWorkout: null, completedWorkouts: [] },
    customExercises: selection.exercises ? customExercises : [],
    selection,
  };
}

export async function exportJson(selection = allDataTransferSelection()): Promise<void> {
  const transfer = await createDataTransfer(selection);
  await shareFile(cacheFile(filename('json'), JSON.stringify(transfer, null, 2)), 'application/json');
}

export async function exportText(selection = allDataTransferSelection()): Promise<void> {
  const transfer = await createDataTransfer(selection);
  const lines = [
    'Forge training data',
    `Exported: ${transfer.exportedAt}`,
    `Completed workouts: ${transfer.workouts.completedWorkouts.length}`,
    `Plans: ${transfer.plans.plans.length}`,
    `Custom exercises: ${transfer.customExercises.length}`,
  ];
  await shareFile(cacheFile(filename('txt'), lines.join('\n')), 'text/plain');
}

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

function isIdList(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isObject(item) && typeof item.id === 'string' && item.id.length > 0);
}

function isTransfer(value: unknown): value is ForgeDataTransfer {
  if (!isObject(value) || value.format !== 'forge-data' || value.version !== FORGE_TRANSFER_VERSION || typeof value.exportedAt !== 'string') return false;
  if (!isObject(value.settings) || !isObject(value.plans) || !isObject(value.workouts) || !isIdList(value.customExercises)) return false;
  if (!isIdList(value.settings.workoutTypes) || !isIdList(value.settings.dailyMeasurementDefinitions) || !isIdList(value.settings.dailyMeasurementEntries)) return false;
  if (!isIdList(value.plans.plans) || !isIdList(value.plans.standaloneRoutines) || !isIdList(value.workouts.completedWorkouts)) return false;
  return value.workouts.activeWorkout === null || (isObject(value.workouts.activeWorkout) && typeof value.workouts.activeWorkout.id === 'string' && value.workouts.activeWorkout.id.length > 0);
}

export function parseDataTransfer(raw: string): ForgeDataTransfer {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('This is not valid Forge JSON.'); }
  if (!isTransfer(value)) {
    throw new Error('This JSON is not a compatible Forge data export.');
  }
  return value as unknown as ForgeDataTransfer;
}

async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  return new File(result.assets[0].uri).text();
}

/** Merge portable JSON by stable ids. Preferences remain local except user-created lists. */
export async function pickJsonTransfer(): Promise<ForgeDataTransfer | null> {
  const raw = await pickTextFile();
  return raw ? parseDataTransfer(raw) : null;
}

export async function inspectDataTransfer(incoming: ForgeDataTransfer, selection = allDataTransferSelection()): Promise<DataTransferInspection> {
  const [currentSettings, currentPlans, currentWorkouts, currentExercises] = await Promise.all([
    loadSettingsPreferences(), loadPlansState(), loadWorkoutState(), loadCustomExercises(),
  ]);
  const summary = <T extends { id: string }>(incomingItems: T[], currentItems: T[]): DataTransferCategorySummary => {
    const currentIds = new Set(currentItems.map((item) => item.id));
    const unique = uniqueById(incomingItems);
    return { available: unique.length, newRecords: unique.filter((item) => !currentIds.has(item.id)).length, existingRecords: unique.filter((item) => currentIds.has(item.id)).length };
  };
  const allRoutines = (plans: PlansState) => [
    ...plans.plans.flatMap((plan) => plan.routines),
    ...plans.standaloneRoutines,
  ];
  const incomingRoutines = allRoutines(incoming.plans);
  const currentRoutines = allRoutines(currentPlans);
  const incomingMeasures = [...incoming.settings.dailyMeasurementDefinitions, ...incoming.settings.dailyMeasurementEntries];
  const currentMeasures = [...currentSettings.dailyMeasurementDefinitions, ...currentSettings.dailyMeasurementEntries];
  return {
    exportedAt: incoming.exportedAt,
    activeWorkout: Boolean(selection.workouts && incoming.workouts.activeWorkout && !currentWorkouts.activeWorkout),
    categories: {
      workouts: selection.workouts ? summary(incoming.workouts.completedWorkouts, currentWorkouts.completedWorkouts) : { available: 0, newRecords: 0, existingRecords: 0 },
      plans: selection.plans ? (() => {
        const planSummary = summary(incoming.plans.plans, currentPlans.plans);
        const routineSummary = summary(incomingRoutines, currentRoutines);
        return {
          available: planSummary.available + routineSummary.available,
          newRecords: planSummary.newRecords + routineSummary.newRecords,
          existingRecords: planSummary.existingRecords + routineSummary.existingRecords,
          planCount: planSummary.available,
          routineCount: routineSummary.available,
        };
      })() : { available: 0, newRecords: 0, existingRecords: 0 },
      exercises: selection.exercises ? summary(incoming.customExercises, currentExercises) : { available: 0, newRecords: 0, existingRecords: 0 },
      workoutTypes: selection.workoutTypes ? summary(incoming.settings.workoutTypes, currentSettings.workoutTypes) : { available: 0, newRecords: 0, existingRecords: 0 },
      measurements: selection.measurements ? summary(incomingMeasures, currentMeasures) : { available: 0, newRecords: 0, existingRecords: 0 },
    },
  };
}

export async function mergeDataTransfer(incoming: ForgeDataTransfer, selection = allDataTransferSelection()): Promise<{ workouts: number; exercises: number }> {
  const [currentSettings, currentPlans, currentWorkouts, currentExercises] = await Promise.all([
    loadSettingsPreferences(), loadPlansState(), loadWorkoutState(), loadCustomExercises(),
  ]);
  const mergeById = <T extends { id: string }>(current: T[], addition: T[]): T[] => uniqueById([...current, ...addition]);
  const completed = selection.workouts ? mergeById(currentWorkouts.completedWorkouts, incoming.workouts.completedWorkouts) : currentWorkouts.completedWorkouts;
  const importedActive = incoming.workouts.activeWorkout && !completed.some((workout) => workout.id === incoming.workouts.activeWorkout?.id)
    ? incoming.workouts.activeWorkout
    : null;
  const plans = selection.plans ? mergeById(currentPlans.plans, incoming.plans.plans) : currentPlans.plans;
  const routines = selection.plans ? mergeById(currentPlans.standaloneRoutines, incoming.plans.standaloneRoutines) : currentPlans.standaloneRoutines;
  const exercises = selection.exercises ? mergeById(currentExercises, incoming.customExercises) : currentExercises;
  const settings: SettingsPreferences = {
    ...currentSettings,
    workoutTypes: selection.workoutTypes ? mergeById(currentSettings.workoutTypes, incoming.settings.workoutTypes ?? []) : currentSettings.workoutTypes,
    dailyMeasurementDefinitions: selection.measurements ? mergeById(currentSettings.dailyMeasurementDefinitions, incoming.settings.dailyMeasurementDefinitions ?? []) : currentSettings.dailyMeasurementDefinitions,
    dailyMeasurementEntries: selection.measurements ? mergeById(currentSettings.dailyMeasurementEntries, incoming.settings.dailyMeasurementEntries ?? []) : currentSettings.dailyMeasurementEntries,
  };
  await Promise.all([
    saveSettingsPreferences(settings), savePlansState({ plans, standaloneRoutines: routines }), saveCompletedWorkouts(completed), saveCustomExercises(exercises),
    selection.workouts && !currentWorkouts.activeWorkout && importedActive ? saveActiveWorkout(importedActive) : Promise.resolve(),
  ]);
  return { workouts: completed.length - currentWorkouts.completedWorkouts.length, exercises: exercises.length - currentExercises.length };
}

export async function importJson(): Promise<{ workouts: number; exercises: number }> {
  const incoming = await pickJsonTransfer();
  return incoming ? mergeDataTransfer(incoming) : { workouts: 0, exercises: 0 };
}

export async function createSqliteBackup(): Promise<void> {
  await withDatabaseMaintenance(async (db) => {
    const bytes = await db.serializeAsync();
    await shareFile(cacheFile(filename('sqlite'), bytes), 'application/vnd.sqlite3');
  });
}

function hasSqliteHeader(bytes: Uint8Array): boolean {
  const header = 'SQLite format 3\u0000';
  return bytes.length >= header.length && header.split('').every((character, index) => bytes[index] === character.charCodeAt(0));
}

async function inspectBytes(bytes: Uint8Array): Promise<BackupInspection> {
  if (!hasSqliteHeader(bytes)) throw new Error('Choose a Forge .sqlite backup, not a data transfer or another app database.');
  let candidate: SQLite.SQLiteDatabase | undefined;
  try {
    candidate = await SQLite.deserializeDatabaseAsync(bytes);
    const integrity = await candidate.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error('The backup failed SQLite integrity validation.');
    const rows = await candidate.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    const tables = new Set(rows.map((row) => row.name));
    if (REQUIRED_TABLES.some((table) => !tables.has(table))) throw new Error('This SQLite file is not a compatible Forge backup. Use JSON to transfer from older Forge versions.');
    const [workouts, active, plans, exercises] = await Promise.all([
      candidate.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM workouts WHERE is_active = 0'),
      candidate.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM workouts WHERE is_active = 1'),
      candidate.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM plans'),
      candidate.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM custom_exercises WHERE archived = 0'),
    ]);
    return { bytes, workoutCount: workouts?.count ?? 0, activeWorkout: (active?.count ?? 0) > 0, planCount: plans?.count ?? 0, customExerciseCount: exercises?.count ?? 0 };
  } finally { await candidate?.closeAsync(); }
}

export async function pickSqliteBackup(): Promise<BackupInspection | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.sqlite3', 'application/octet-stream'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  return inspectBytes(await new File(result.assets[0].uri).bytes());
}

/** Replaces the database only after validating an in-memory copy and retaining an in-app safety copy. */
export async function restoreSqliteBackup(inspection: BackupInspection): Promise<void> {
  await withDatabaseMaintenance(async (live) => {
    await inspectBytes(inspection.bytes);
    cacheFile(`forge-safety-before-restore-${stamp()}.sqlite`, await live.serializeAsync());
    const candidate = await SQLite.deserializeDatabaseAsync(inspection.bytes);
    try { await SQLite.backupDatabaseAsync({ sourceDatabase: candidate, destDatabase: live }); }
    finally { await candidate.closeAsync(); }
  });
}

/**
 * Erases user-owned Forge data while retaining only the immutable bundled
 * exercise catalogue needed to start a fresh local installation.
 */
export async function eraseAllForgeData(): Promise<void> {
  await withDatabaseMaintenance(async (db) => {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM set_measurements;
        DELETE FROM set_targets;
        DELETE FROM workouts;
        DELETE FROM routines;
        DELETE FROM plans;
        DELETE FROM custom_exercises;
        DELETE FROM workout_types;
        DELETE FROM preferences;
      `);
    });
  });
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
  return withDatabaseMaintenance(async (db) => {
    const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'");
    return { tables: row?.count ?? 0, database: 'Forge SQLite' };
  });
}
