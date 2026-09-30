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
import { mergeImportedPlans, type ImportRename } from './dataTransferPlans';
import { renameSharedExercises, renameSharedWorkouts } from './sharedImport';
import {
  applySelectiveShareUpdate,
  detectShareConflict,
  dropSharedItem,
  isUpdateResolution,
  shareResolutionResult,
  type ShareConflict,
  type ShareResolution,
} from './importDiff';
import { normalizeDataTransfer, reconcileMeasurements } from './dataTransferNormalization';
import type { PlansState, SettingsPreferences, WorkoutState } from '../types';
import {
  FORGE_TRANSFER_VERSION,
  allDataTransferSelection,
  type DataTransferCategory,
  type DataTransferSelection,
  type ForgeDataTransfer,
  type ShareDescriptor,
  type ShareKind,
} from './transferFormat';

export {
  FORGE_TRANSFER_VERSION,
  allDataTransferSelection,
  type DataTransferCategory,
  type DataTransferSelection,
  type ForgeDataTransfer,
  type ShareDescriptor,
  type ShareKind,
};

const REQUIRED_TABLES = [
  'forge_meta',
  'preferences',
  'plans',
  'routines',
  'workouts',
  'custom_exercises',
  'workout_types',
];

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
  /** Present when a single-item share updates an existing item (same name, different content). */
  conflict?: ShareConflict;
};
export type DataTransferMergeResult = {
  categories: Record<DataTransferCategory, number>;
  activeWorkoutAdded: boolean;
  /** Records renamed on import to avoid a name clash (from -> to). */
  renamed: ImportRename[];
  /** Names of shared records the device already had verbatim, so they were skipped. */
  skipped: string[];
  /** The applied decision for a single-item share conflict, if one was resolved. */
  resolution?: { action: 'updated' | 'keptBoth' | 'skipped'; name: string };
};

export type BackupInspection = {
  bytes: Uint8Array;
  workoutCount: number;
  activeWorkout: boolean;
  planCount: number;
  customExerciseCount: number;
};

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
function filename(extension: string): string {
  return `forge-${stamp()}.${extension}`;
}
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
/**
 * A readable, URL-safe filename slug. Spaces and punctuation become single
 * underscores — a share file URI with raw spaces fails to load on iOS, so the
 * shared name must avoid them.
 */
function slug(name: string): string {
  return name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}
/** A `.forge` filename that says what the file holds, not a timestamp blob. */
function shareFilename(transfer: ForgeDataTransfer): string {
  if (transfer.share) {
    const base = slug(transfer.share.title) || transfer.share.kind;
    return `${base}_${transfer.share.kind}.forge`;
  }
  return `Forge_export_${dateStamp()}.forge`;
}

async function shareFile(file: File, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Forge data' });
}

function cacheFile(name: string, contents: Uint8Array | string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  file.write(contents);
  return file;
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
    selection,
  };
}

export async function exportJson(selection = allDataTransferSelection()): Promise<void> {
  await shareTransfer(await createDataTransfer(selection));
}

/**
 * Shares a transfer (whole-app export or a single-item scoped share) as a
 * `.forge` file — JSON content, distinct extension so the OS can associate it
 * with Forge. The recipient imports it through the same Import flow.
 */
export async function shareTransfer(transfer: ForgeDataTransfer): Promise<void> {
  await shareFile(
    cacheFile(shareFilename(transfer), JSON.stringify(transfer, null, 2)),
    'application/json',
  );
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
  await shareFile(cacheFile(`Forge_summary_${dateStamp()}.txt`, lines.join('\n')), 'text/plain');
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
  if (!isTransfer(value)) {
    throw new Error('This JSON is not a compatible Forge data export.');
  }
  return normalizeDataTransfer(value as unknown as ForgeDataTransfer);
}

async function pickTextFile(): Promise<string | null> {
  // `.forge` has no registered MIME/UTI yet (that arrives with the native
  // open-in-Forge work), so accept any file and gate on the extension here plus
  // the content check in parseDataTransfer. Only Forge's own `.forge` exports
  // are accepted — a plain `.json` is rejected by name.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!/\.forge$/i.test(asset.name ?? '')) {
    throw new Error('Choose a Forge (.forge) file. Other files are not accepted.');
  }
  return new File(asset.uri).text();
}

/** Merge portable JSON by stable ids. Preferences remain local except user-created lists. */
export async function pickJsonTransfer(): Promise<ForgeDataTransfer | null> {
  const raw = await pickTextFile();
  return raw ? parseDataTransfer(raw) : null;
}

export async function inspectDataTransfer(
  incoming: ForgeDataTransfer,
  selection = allDataTransferSelection(),
): Promise<DataTransferInspection> {
  const [currentSettings, currentPlans, currentWorkouts, currentExercises] = await Promise.all([
    loadSettingsPreferences(),
    loadPlansState(),
    loadWorkoutState(),
    loadCustomExercises(),
  ]);
  const summary = <T extends { id: string }>(
    incomingItems: T[],
    currentItems: T[],
  ): DataTransferCategorySummary => {
    const currentIds = new Set(currentItems.map((item) => item.id));
    const unique = uniqueById(incomingItems);
    return {
      available: unique.length,
      newRecords: unique.filter((item) => !currentIds.has(item.id)).length,
      existingRecords: unique.filter((item) => currentIds.has(item.id)).length,
    };
  };
  const allRoutines = (plans: PlansState) => [
    ...plans.plans.flatMap((plan) => plan.routines),
    ...plans.standaloneRoutines,
  ];
  const incomingRoutines = allRoutines(incoming.plans);
  const currentRoutines = allRoutines(currentPlans);
  const incomingMeasures = [
    ...incoming.settings.dailyMeasurementDefinitions,
    ...incoming.settings.dailyMeasurementEntries,
  ];
  const currentMeasures = [
    ...currentSettings.dailyMeasurementDefinitions,
    ...currentSettings.dailyMeasurementEntries,
  ];
  return {
    exportedAt: incoming.exportedAt,
    activeWorkout: Boolean(
      selection.workouts && incoming.workouts.activeWorkout && !currentWorkouts.activeWorkout,
    ),
    conflict:
      detectShareConflict(incoming, {
        plans: currentPlans,
        workouts: currentWorkouts.completedWorkouts,
        exercises: currentExercises,
      }) ?? undefined,
    categories: {
      workouts: selection.workouts
        ? summary(incoming.workouts.completedWorkouts, currentWorkouts.completedWorkouts)
        : { available: 0, newRecords: 0, existingRecords: 0 },
      plans: selection.plans
        ? (() => {
            const planSummary = summary(incoming.plans.plans, currentPlans.plans);
            const routineSummary = summary(incomingRoutines, currentRoutines);
            return {
              available: planSummary.available + routineSummary.available,
              newRecords: planSummary.newRecords + routineSummary.newRecords,
              existingRecords: planSummary.existingRecords + routineSummary.existingRecords,
              planCount: planSummary.available,
              routineCount: routineSummary.available,
            };
          })()
        : { available: 0, newRecords: 0, existingRecords: 0 },
      exercises: selection.exercises
        ? summary(incoming.customExercises, currentExercises)
        : { available: 0, newRecords: 0, existingRecords: 0 },
      workoutTypes: selection.workoutTypes
        ? summary(incoming.settings.workoutTypes, currentSettings.workoutTypes)
        : { available: 0, newRecords: 0, existingRecords: 0 },
      measurements: selection.measurements
        ? summary(incomingMeasures, currentMeasures)
        : { available: 0, newRecords: 0, existingRecords: 0 },
    },
  };
}

export async function mergeDataTransfer(
  incoming: ForgeDataTransfer,
  selection = allDataTransferSelection(),
  resolution?: ShareResolution,
): Promise<DataTransferMergeResult> {
  incoming = normalizeDataTransfer(incoming);
  const [currentSettings, currentPlans, currentWorkouts, currentExercises] = await Promise.all([
    loadSettingsPreferences(),
    loadPlansState(),
    loadWorkoutState(),
    loadCustomExercises(),
  ]);
  const mergeById = <T extends { id: string }>(current: T[], addition: T[]): T[] =>
    uniqueById([...current, ...addition]);
  // Resolve a single-item share conflict (same name, different content) per the
  // user's decision: 'update' replaces the matched item in place (keeping its
  // id), 'skip' imports nothing, 'keepBoth'/undefined keeps the existing "X 2"
  // copy behaviour.
  const conflict = resolution
    ? detectShareConflict(incoming, {
        plans: currentPlans,
        workouts: currentWorkouts.completedWorkouts,
        exercises: currentExercises,
      })
    : null;
  const resolutionResult = shareResolutionResult(conflict, resolution);
  const updateAction = Boolean(conflict) && isUpdateResolution(resolution);
  // A selective update carries the checked change-unit ids: merge them onto the
  // on-device item and swap the result into the shared-item slot, so the whole-
  // item update path below replaces the record in place with exactly that.
  if (conflict && typeof resolution === 'object' && resolution.kind === 'update') {
    incoming = applySelectiveShareUpdate(incoming, conflict, resolution.selectedIds, {
      plans: currentPlans,
      workouts: currentWorkouts.completedWorkouts,
      exercises: currentExercises,
    });
  }
  if (conflict && resolution === 'skip') incoming = dropSharedItem(incoming, conflict.kind);
  const planUpdate =
    conflict && updateAction && (conflict.kind === 'routine' || conflict.kind === 'plan')
      ? { kind: conflict.kind, existingId: conflict.existingId }
      : undefined;
  const workoutUpdate = conflict && updateAction && conflict.kind === 'workout' ? conflict : null;
  const exerciseUpdate = conflict && updateAction && conflict.kind === 'exercise' ? conflict : null;
  const renamed: ImportRename[] = [];
  const skipped: string[] = [];
  // A shared item is freshened to import as a copy; but skip the flat records
  // the device already has verbatim, and only rename (X 2) a genuinely different
  // one whose name clashes. Routine/plan records go through the plan merge.
  const incomingWorkouts = incoming.share && !workoutUpdate
    ? renameSharedWorkouts(incoming.workouts.completedWorkouts, currentWorkouts.completedWorkouts, renamed, skipped)
    : workoutUpdate
      ? []
      : incoming.workouts.completedWorkouts;
  const incomingExercises = incoming.share && !exerciseUpdate
    ? renameSharedExercises(incoming.customExercises, currentExercises, renamed, skipped)
    : exerciseUpdate
      ? []
      : incoming.customExercises;
  // An 'update' on a flat record replaces the matched item in place, keeping its id.
  const baseCompleted = workoutUpdate
    ? currentWorkouts.completedWorkouts.map((workout) =>
        workout.id === workoutUpdate.existingId
          ? { ...incoming.workouts.completedWorkouts[0], id: workoutUpdate.existingId }
          : workout,
      )
    : currentWorkouts.completedWorkouts;
  const baseExercises = exerciseUpdate
    ? currentExercises.map((exercise) =>
        exercise.id === exerciseUpdate.existingId
          ? { ...incoming.customExercises[0], id: exerciseUpdate.existingId }
          : exercise,
      )
    : currentExercises;
  const completed = selection.workouts
    ? mergeById(baseCompleted, incomingWorkouts)
    : baseCompleted;
  const importedActive =
    selection.workouts &&
    incoming.workouts.activeWorkout &&
    !completed.some((workout) => workout.id === incoming.workouts.activeWorkout?.id)
      ? incoming.workouts.activeWorkout
      : null;
  const mergedPlanState = selection.plans
    ? mergeImportedPlans(currentPlans, incoming.plans, renamed, skipped, planUpdate)
    : currentPlans;
  const plans = mergedPlanState.plans;
  const routines = mergedPlanState.standaloneRoutines;
  const exercises = selection.exercises
    ? mergeById(baseExercises, incomingExercises)
    : baseExercises;
  const measurements = selection.measurements
    ? reconcileMeasurements(
        currentSettings.dailyMeasurementDefinitions,
        currentSettings.dailyMeasurementEntries,
        incoming.settings.dailyMeasurementDefinitions ?? [],
        incoming.settings.dailyMeasurementEntries ?? [],
      )
    : { definitions: currentSettings.dailyMeasurementDefinitions, entries: currentSettings.dailyMeasurementEntries };
  const settings: SettingsPreferences = {
    ...currentSettings,
    workoutTypes: selection.workoutTypes
      ? mergeById(currentSettings.workoutTypes, incoming.settings.workoutTypes ?? [])
      : currentSettings.workoutTypes,
    dailyMeasurementDefinitions: measurements.definitions,
    dailyMeasurementEntries: measurements.entries,
  };
  const active = currentWorkouts.activeWorkout ?? importedActive;
  const completedWithoutActive = active
    ? completed.filter((workout) => workout.id !== active.id)
    : completed;
  await withDatabaseMaintenance(async (db) => {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT OR REPLACE INTO preferences (id, value_json) VALUES (1, ?)',
        JSON.stringify(settings),
      );
      await db.runAsync('DELETE FROM workout_types');
      for (const [position, type] of settings.workoutTypes.entries())
        await db.runAsync(
          'INSERT INTO workout_types (id, archived, position, value_json) VALUES (?, ?, ?, ?)',
          type.id,
          type.hidden ? 1 : 0,
          position,
          JSON.stringify(type),
        );
      await db.runAsync('DELETE FROM routines');
      await db.runAsync('DELETE FROM plans');
      for (const [position, plan] of plans.entries())
        await db.runAsync(
          'INSERT INTO plans (id, position, value_json) VALUES (?, ?, ?)',
          plan.id,
          position,
          JSON.stringify({ ...plan, routines: undefined }),
        );
      const allRoutines = [...routines, ...plans.flatMap((plan) => plan.routines)];
      for (const [position, routine] of allRoutines.entries())
        await db.runAsync(
          'INSERT INTO routines (id, plan_id, position, value_json) VALUES (?, ?, ?, ?)',
          routine.id,
          routine.planId ?? null,
          position,
          JSON.stringify(routine),
        );
      await db.runAsync('DELETE FROM workouts');
      if (active)
        await db.runAsync(
          'INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 1, NULL, ?, ?)',
          active.id,
          active.startedAt,
          JSON.stringify(active),
        );
      for (const workout of completedWithoutActive)
        await db.runAsync(
          'INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 0, ?, ?, ?)',
          workout.id,
          workout.completedAt,
          workout.startedAt,
          JSON.stringify(workout),
        );
      await db.runAsync('DELETE FROM custom_exercises');
      for (const exercise of exercises)
        await db.runAsync(
          'INSERT INTO custom_exercises (id, archived, value_json) VALUES (?, 0, ?)',
          exercise.id,
          JSON.stringify(exercise),
        );
    });
  });
  return {
    categories: {
      workouts: completedWithoutActive.length - currentWorkouts.completedWorkouts.length,
      plans:
        plans.length +
        allRoutineCount(plans, routines) -
        (currentPlans.plans.length +
          allRoutineCount(currentPlans.plans, currentPlans.standaloneRoutines)),
      exercises: exercises.length - currentExercises.length,
      workoutTypes: settings.workoutTypes.length - currentSettings.workoutTypes.length,
      measurements:
        settings.dailyMeasurementDefinitions.length +
        settings.dailyMeasurementEntries.length -
        currentSettings.dailyMeasurementDefinitions.length -
        currentSettings.dailyMeasurementEntries.length,
    },
    activeWorkoutAdded: Boolean(!currentWorkouts.activeWorkout && importedActive),
    renamed,
    skipped,
    resolution: resolutionResult,
  };
}

function allRoutineCount(
  plans: PlansState['plans'],
  standalone: PlansState['standaloneRoutines'],
): number {
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
  return (
    bytes.length >= header.length &&
    header.split('').every((character, index) => bytes[index] === character.charCodeAt(0))
  );
}

async function inspectBytes(bytes: Uint8Array): Promise<BackupInspection> {
  if (!hasSqliteHeader(bytes))
    throw new Error('Choose a Forge .sqlite backup, not a data transfer or another app database.');
  return withTemporaryBackupDatabase(bytes, async (candidate) => {
    const integrity = await candidate.getFirstAsync<{ integrity_check: string }>(
      'PRAGMA integrity_check',
    );
    if (integrity?.integrity_check !== 'ok')
      throw new Error('The backup failed SQLite integrity validation.');
    const rows = await candidate.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tables = new Set(rows.map((row) => row.name));
    if (REQUIRED_TABLES.some((table) => !tables.has(table)))
      throw new Error(
        'This SQLite file is not a compatible Forge backup. Use JSON to transfer from older Forge versions.',
      );
    const [workouts, active, plans, exercises] = await Promise.all([
      candidate.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workouts WHERE is_active = 0',
      ),
      candidate.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workouts WHERE is_active = 1',
      ),
      candidate.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM plans'),
      candidate.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM custom_exercises WHERE archived = 0',
      ),
    ]);
    return {
      bytes,
      workoutCount: workouts?.count ?? 0,
      activeWorkout: (active?.count ?? 0) > 0,
      planCount: plans?.count ?? 0,
      customExerciseCount: exercises?.count ?? 0,
    };
  });
}

/**
 * iOS can reject a deserialized in-memory database while preparing its first
 * statement. Validate a cache-backed candidate instead, then always remove it
 * once the check or restore completes.
 */
async function withTemporaryBackupDatabase<T>(
  bytes: Uint8Array,
  work: (database: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const databaseName = `forge-restore-candidate-${stamp()}.sqlite`;
  const file = cacheFile(databaseName, bytes);
  let candidate: SQLite.SQLiteDatabase | undefined;
  try {
    candidate = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true }, Paths.cache.uri);
    return await work(candidate);
  } finally {
    try {
      await candidate?.closeAsync();
    } finally {
      if (file.exists) file.delete();
    }
  }
}

export async function pickSqliteBackup(): Promise<BackupInspection | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/vnd.sqlite3', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return inspectBytes(await new File(result.assets[0].uri).bytes());
}

/** Replaces the database only after validating an in-memory copy and retaining an in-app safety copy. */
export async function restoreSqliteBackup(inspection: BackupInspection): Promise<void> {
  await withDatabaseMaintenance(async (live) => {
    await inspectBytes(inspection.bytes);
    cacheFile(`forge-safety-before-restore-${stamp()}.sqlite`, await live.serializeAsync());
    await withTemporaryBackupDatabase(inspection.bytes, async (candidate) => {
      await SQLite.backupDatabaseAsync({ sourceDatabase: candidate, destDatabase: live });
    });
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
    // Also clear the dashboard layout (holds user note-tile text) and the
    // backup-history footer, so "Delete all data" leaves no user data behind.
    '@forge/dashboard-layout-v1',
    '@forge/backup-history-v1',
  ]);
}

export async function databaseStatus(): Promise<{ tables: number; database: string }> {
  return withDatabaseMaintenance(async (db) => {
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'",
    );
    return { tables: row?.count ?? 0, database: 'Forge SQLite' };
  });
}
