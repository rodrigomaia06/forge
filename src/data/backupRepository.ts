import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import { loadCustomExercises } from './exerciseRepository';
import { withDatabaseMaintenance } from './database';
import { loadPlansState } from './plansRepository';
import { loadSettingsPreferences } from './settingsRepository';
import { loadWorkoutState } from './workoutRepository';
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
export type DataTransferMergeResult = {
  categories: Record<DataTransferCategory, number>;
  activeWorkoutAdded: boolean;
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

/** UUIDs let a hand-authored import become durable without a central service. */
function createImportId(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isRecordList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isObject);
}

function isTransfer(value: unknown): value is ForgeDataTransfer {
  if (!isObject(value) || value.format !== 'forge-data' || value.version !== FORGE_TRANSFER_VERSION || typeof value.exportedAt !== 'string') return false;
  if (!isObject(value.settings) || !isObject(value.plans) || !isObject(value.workouts) || !isRecordList(value.customExercises)) return false;
  if (!isRecordList(value.settings.workoutTypes) || !isRecordList(value.settings.dailyMeasurementDefinitions) || !isRecordList(value.settings.dailyMeasurementEntries)) return false;
  if (!isRecordList(value.plans.plans) || !isRecordList(value.plans.standaloneRoutines) || !isRecordList(value.workouts.completedWorkouts)) return false;
  return value.workouts.activeWorkout === null || isObject(value.workouts.activeWorkout);
}

export function parseDataTransfer(raw: string): ForgeDataTransfer {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('This is not valid Forge JSON.'); }
  if (!isTransfer(value)) {
    throw new Error('This JSON is not a compatible Forge data export.');
  }
  return normalizeDataTransfer(value as unknown as ForgeDataTransfer);
}

/** Defend the database boundary from duplicate or cross-linked legacy rows. */
function normalizeDataTransfer(transfer: ForgeDataTransfer): ForgeDataTransfer {
  const assignId = <T extends Record<string, unknown>>(item: T, prefix: string): T & { id: string } => ({
    ...item,
    id: typeof item.id === 'string' && item.id.trim() ? item.id : createImportId(),
  });
  const records = <T extends Record<string, unknown>>(items: unknown, prefix: string): Array<T & { id: string }> =>
    Array.isArray(items) ? items.filter(isObject).map((item) => assignId(item as T, prefix)) : [];
  const normalizeWorkout = <T extends Record<string, unknown>>(workout: T, prefix: string): T & { id: string } => {
    const exercises = records<Record<string, unknown>>(workout.exercises, 'exercise').map((exercise) => ({
      ...exercise,
      sets: records<Record<string, unknown>>(exercise.sets, 'set'),
    }));
    return { ...assignId(workout, prefix), exercises };
  };
  const plans = records<Record<string, unknown>>(transfer.plans.plans, 'plan').map((plan) => ({
    ...plan,
    routines: uniqueById(records<Record<string, unknown>>(plan.routines, 'routine').map((routine) => ({ ...routine, planId: plan.id }))),
  }));
  const planRoutineIds = new Set(plans.flatMap((plan) => plan.routines.map((routine) => routine.id)));
  const completed = uniqueById(records<Record<string, unknown>>(transfer.workouts.completedWorkouts, 'workout').map((workout) => normalizeWorkout(workout, 'workout')));
  const activeCandidate = transfer.workouts.activeWorkout && isObject(transfer.workouts.activeWorkout)
    ? normalizeWorkout(transfer.workouts.activeWorkout, 'workout')
    : null;
  const active = activeCandidate && !completed.some((workout) => workout.id === activeCandidate.id)
    ? activeCandidate
    : null;
  return {
    ...transfer,
    settings: {
      ...transfer.settings,
      workoutTypes: uniqueById(records<Record<string, unknown>>(transfer.settings.workoutTypes, 'workout-type')),
      dailyMeasurementDefinitions: uniqueById(records<Record<string, unknown>>(transfer.settings.dailyMeasurementDefinitions, 'measurement-definition')),
      dailyMeasurementEntries: uniqueById(records<Record<string, unknown>>(transfer.settings.dailyMeasurementEntries, 'measurement-entry')),
    },
    plans: {
      plans,
      standaloneRoutines: uniqueById(records<Record<string, unknown>>(transfer.plans.standaloneRoutines, 'routine')).filter((routine) => !planRoutineIds.has(routine.id)),
    },
    workouts: { activeWorkout: active, completedWorkouts: completed },
    customExercises: uniqueById(records<Record<string, unknown>>(transfer.customExercises, 'exercise-catalogue')),
  } as unknown as ForgeDataTransfer;
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

export async function mergeDataTransfer(incoming: ForgeDataTransfer, selection = allDataTransferSelection()): Promise<DataTransferMergeResult> {
  incoming = normalizeDataTransfer(incoming);
  const [currentSettings, currentPlans, currentWorkouts, currentExercises] = await Promise.all([
    loadSettingsPreferences(), loadPlansState(), loadWorkoutState(), loadCustomExercises(),
  ]);
  const mergeById = <T extends { id: string }>(current: T[], addition: T[]): T[] => uniqueById([...current, ...addition]);
  const completed = selection.workouts ? mergeById(currentWorkouts.completedWorkouts, incoming.workouts.completedWorkouts) : currentWorkouts.completedWorkouts;
  const importedActive = selection.workouts && incoming.workouts.activeWorkout && !completed.some((workout) => workout.id === incoming.workouts.activeWorkout?.id)
    ? incoming.workouts.activeWorkout
    : null;
  const plans = (selection.plans ? mergeById(currentPlans.plans, incoming.plans.plans) : currentPlans.plans)
    .map((plan) => ({ ...plan, routines: uniqueById(plan.routines).map((routine) => ({ ...routine, planId: plan.id })) }));
  const planRoutineIds = new Set(plans.flatMap((plan) => plan.routines.map((routine) => routine.id)));
  const routines = (selection.plans ? mergeById(currentPlans.standaloneRoutines, incoming.plans.standaloneRoutines) : currentPlans.standaloneRoutines)
    .filter((routine) => !planRoutineIds.has(routine.id));
  const exercises = selection.exercises ? mergeById(currentExercises, incoming.customExercises) : currentExercises;
  const settings: SettingsPreferences = {
    ...currentSettings,
    workoutTypes: selection.workoutTypes ? mergeById(currentSettings.workoutTypes, incoming.settings.workoutTypes ?? []) : currentSettings.workoutTypes,
    dailyMeasurementDefinitions: selection.measurements ? mergeById(currentSettings.dailyMeasurementDefinitions, incoming.settings.dailyMeasurementDefinitions ?? []) : currentSettings.dailyMeasurementDefinitions,
    dailyMeasurementEntries: selection.measurements ? mergeById(currentSettings.dailyMeasurementEntries, incoming.settings.dailyMeasurementEntries ?? []) : currentSettings.dailyMeasurementEntries,
  };
  const active = currentWorkouts.activeWorkout ?? importedActive;
  const completedWithoutActive = active ? completed.filter((workout) => workout.id !== active.id) : completed;
  await withDatabaseMaintenance(async (db) => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT OR REPLACE INTO preferences (id, value_json) VALUES (1, ?)', JSON.stringify(settings));
      await db.runAsync('DELETE FROM workout_types');
      for (const [position, type] of settings.workoutTypes.entries()) await db.runAsync('INSERT INTO workout_types (id, archived, position, value_json) VALUES (?, ?, ?, ?)', type.id, type.hidden ? 1 : 0, position, JSON.stringify(type));
      await db.runAsync('DELETE FROM routines');
      await db.runAsync('DELETE FROM plans');
      for (const [position, plan] of plans.entries()) await db.runAsync('INSERT INTO plans (id, position, value_json) VALUES (?, ?, ?)', plan.id, position, JSON.stringify({ ...plan, routines: undefined }));
      const allRoutines = [...routines, ...plans.flatMap((plan) => plan.routines)];
      for (const [position, routine] of allRoutines.entries()) await db.runAsync('INSERT INTO routines (id, plan_id, position, value_json) VALUES (?, ?, ?, ?)', routine.id, routine.planId ?? null, position, JSON.stringify(routine));
      await db.runAsync('DELETE FROM workouts');
      if (active) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 1, NULL, ?, ?)', active.id, active.startedAt, JSON.stringify(active));
      for (const workout of completedWithoutActive) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 0, ?, ?, ?)', workout.id, workout.completedAt, workout.startedAt, JSON.stringify(workout));
      await db.runAsync('DELETE FROM custom_exercises');
      for (const exercise of exercises) await db.runAsync('INSERT INTO custom_exercises (id, archived, value_json) VALUES (?, 0, ?)', exercise.id, JSON.stringify(exercise));
    });
  });
  return {
    categories: {
      workouts: completedWithoutActive.length - currentWorkouts.completedWorkouts.length,
      plans: (plans.length + allRoutineCount(plans, routines)) - (currentPlans.plans.length + allRoutineCount(currentPlans.plans, currentPlans.standaloneRoutines)),
      exercises: exercises.length - currentExercises.length,
      workoutTypes: settings.workoutTypes.length - currentSettings.workoutTypes.length,
      measurements: settings.dailyMeasurementDefinitions.length + settings.dailyMeasurementEntries.length - currentSettings.dailyMeasurementDefinitions.length - currentSettings.dailyMeasurementEntries.length,
    },
    activeWorkoutAdded: Boolean(!currentWorkouts.activeWorkout && importedActive),
  };
}

function allRoutineCount(plans: PlansState['plans'], standalone: PlansState['standaloneRoutines']): number {
  return plans.reduce((count, plan) => count + plan.routines.length, standalone.length);
}

export async function importJson(): Promise<DataTransferMergeResult | null> {
  const incoming = await pickJsonTransfer();
  return incoming ? mergeDataTransfer(incoming) : null;
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
