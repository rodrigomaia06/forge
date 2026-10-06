import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import { bundledCatalogTaxonomies, bundledCatalogVersion, bundledExercises } from './catalog/loadCatalog';
import type { PlansState, SettingsPreferences, Workout, WorkoutState } from '../types';
import { uniqueById } from './uniqueById';
import { canonicalizeExerciseRecord } from './exerciseCanonicalization';

const DATABASE = 'forge.db';
export const BUNDLED_CATALOG_VERSION = bundledCatalogVersion;
const LEGACY_KEYS = ['@forge/active-workout', '@forge/completed-workouts', '@forge/plans-v1', '@forge/settings-preferences', '@forge/custom-exercises'];
let opening: Promise<SQLite.SQLiteDatabase> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

export type ForgeDatabase = SQLite.SQLiteDatabase;

/** Expo SQLite uses one native connection; serialize transaction starts across repositories. */
export function withDatabaseTransaction(work: (db: ForgeDatabase) => Promise<void>): Promise<void> {
  return withDatabaseMaintenance(async (db) => db.withTransactionAsync(async () => work(db)));
}

/**
 * Serializes maintenance work with ordinary repository writes. Database backup
 * and restore use this to avoid taking a snapshot halfway through a queued edit.
 */
export function withDatabaseMaintenance<T>(work: (db: ForgeDatabase) => Promise<T>): Promise<T> {
  const next = writeQueue.catch(() => undefined).then(async () => work(await openForgeDatabase()));
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

export function openForgeDatabase(): Promise<ForgeDatabase> {
  if (opening) return opening;
  opening = SQLite.openDatabaseAsync(DATABASE).then(async (db) => {
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS forge_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK (id = 1), value_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY NOT NULL, position INTEGER NOT NULL, value_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS routines (id TEXT PRIMARY KEY NOT NULL, plan_id TEXT, position INTEGER NOT NULL, value_json TEXT NOT NULL,
        FOREIGN KEY(plan_id) REFERENCES plans(id) ON DELETE SET NULL);
      CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY NOT NULL, is_active INTEGER NOT NULL, completed_at INTEGER, started_at INTEGER NOT NULL, value_json TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS workouts_one_active ON workouts(is_active) WHERE is_active = 1;
      CREATE INDEX IF NOT EXISTS workouts_completed_at ON workouts(completed_at DESC);
      CREATE TABLE IF NOT EXISTS custom_exercises (id TEXT PRIMARY KEY NOT NULL, archived INTEGER NOT NULL DEFAULT 0, value_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workout_types (id TEXT PRIMARY KEY NOT NULL, archived INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL, value_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bundled_exercises (id TEXT PRIMARY KEY NOT NULL, catalog_version INTEGER NOT NULL, value_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bundled_catalog_taxonomies (catalog_version INTEGER NOT NULL, kind TEXT NOT NULL, value_json TEXT NOT NULL, PRIMARY KEY (catalog_version, kind));
      CREATE TABLE IF NOT EXISTS set_measurements (id TEXT PRIMARY KEY NOT NULL, owner_set_id TEXT NOT NULL, kind TEXT NOT NULL, unit TEXT NOT NULL, value REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS set_targets (id TEXT PRIMARY KEY NOT NULL, owner_set_id TEXT NOT NULL, kind TEXT NOT NULL, unit TEXT NOT NULL, min_value REAL, max_value REAL);
    `);
    await migrateBundledCatalog(db);
    await importLegacyOnce(db);
    await migrateCanonicalExerciseRecords(db);
    return db;
  });
  return opening.catch((error) => {
    opening = undefined;
    throw error;
  });
}

/** Release upgrades replace only Forge-owned baseline rows; user rows stay untouched. */
async function migrateBundledCatalog(db: ForgeDatabase): Promise<void> {
  const current = await db.getFirstAsync<{ value: string }>('SELECT value FROM forge_meta WHERE key = ?', 'bundled-catalog-version');
  if (Number(current?.value ?? 0) >= BUNDLED_CATALOG_VERSION) return;
  // Startup migrations share the open connection with Expo module initialization.
  // Keep these writes serialized and mark completion last instead of nesting a
  // transaction around asynchronous migration work.
  await db.runAsync('DELETE FROM bundled_exercises');
  await db.runAsync('DELETE FROM bundled_catalog_taxonomies WHERE catalog_version = ?', BUNDLED_CATALOG_VERSION);
  for (const exercise of bundledExercises) await db.runAsync('INSERT INTO bundled_exercises (id, catalog_version, value_json) VALUES (?, ?, ?)', exercise.id, BUNDLED_CATALOG_VERSION, JSON.stringify(exercise));
  for (const [kind, value] of Object.entries(bundledCatalogTaxonomies)) await db.runAsync('INSERT INTO bundled_catalog_taxonomies (catalog_version, kind, value_json) VALUES (?, ?, ?)', BUNDLED_CATALOG_VERSION, kind, JSON.stringify(value));
  await db.runAsync('INSERT OR REPLACE INTO forge_meta (key, value) VALUES (?, ?)', 'bundled-catalog-version', String(BUNDLED_CATALOG_VERSION));
}

function canonicalizeStoredValue<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalizeStoredValue) as T;
  const record = value as Record<string, unknown>;
  const migrated = Object.fromEntries(Object.entries(record).map(([key, child]) => [key, canonicalizeStoredValue(child)]));
  if (Array.isArray(migrated.exercises)) {
    migrated.exercises = migrated.exercises.map((exercise) =>
      exercise && typeof exercise === 'object'
        ? canonicalizeExerciseRecord(exercise as Record<string, unknown>)
        : exercise,
    );
  }
  return migrated as T;
}

function legacyRecords<T extends { id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.filter((item): item is T => Boolean(item) && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'));
}

async function migrateCanonicalExerciseRecords(db: ForgeDatabase): Promise<void> {
  // Re-run approved canonicalization so saved catalogue exercises
  // receive reviewed classifications and tracking while all user-entered sets remain intact.
  const completed = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM forge_meta WHERE key = ?',
    'canonical-exercise-records-v5',
  );
  if (completed) return;
  for (const table of ['plans', 'workouts', 'routines']) {
    const rows = await db.getAllAsync<{ id: string; value_json: string }>(`SELECT id, value_json FROM ${table}`);
    for (const row of rows) {
      try {
        const migrated = canonicalizeStoredValue(JSON.parse(row.value_json));
        if (JSON.stringify(migrated) !== row.value_json) await db.runAsync(`UPDATE ${table} SET value_json = ? WHERE id = ?`, JSON.stringify(migrated), row.id);
      } catch { /* Corrupt user data is handled by each repository's reader. */ }
    }
  }
  await db.runAsync('INSERT OR REPLACE INTO forge_meta (key, value) VALUES (?, ?)', 'canonical-exercise-records-v5', '1');
}

async function importLegacyOnce(db: ForgeDatabase): Promise<void> {
  const migrated = await db.getFirstAsync<{ value: string }>('SELECT value FROM forge_meta WHERE key = ?', 'legacy-v1-migrated');
  if (migrated) return;
  const [active, completed, plans, preferences, custom] = await AsyncStorage.multiGet(LEGACY_KEYS);
  if (![active, completed, plans, preferences, custom].some(([, value]) => value)) {
    await db.runAsync('INSERT INTO forge_meta (key, value) VALUES (?, ?)', 'legacy-v1-migrated', 'empty');
    return;
  }
  const parse = <T,>(value: string | null, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
  const planState = parse<PlansState>(plans[1], { plans: [], standaloneRoutines: [] });
  const workoutState: WorkoutState = { activeWorkout: parse(active[1], null), completedWorkouts: parse(completed[1], []) };
  const prefs = parse<SettingsPreferences | null>(preferences[1], null);
  const exercises = parse<ExerciseCatalogItem[]>(custom[1], []);
  const plansToImport = legacyRecords<PlansState['plans'][number]>(planState.plans);
  const routinesToImport = legacyRecords<PlansState['standaloneRoutines'][number]>([
    ...legacyRecords<PlansState['standaloneRoutines'][number]>(planState.standaloneRoutines),
    ...plansToImport.flatMap((plan) => legacyRecords<PlansState['standaloneRoutines'][number]>(plan.routines)),
  ]);
  const completedToImport = legacyRecords<Workout>(workoutState.completedWorkouts);
  // A legacy active row can be stale after a workout finished. A completed row
  // wins so the single SQLite primary key remains a faithful completed record.
  const activeToImport = workoutState.activeWorkout && typeof workoutState.activeWorkout.id === 'string' && !completedToImport.some((workout) => workout.id === workoutState.activeWorkout?.id)
    ? workoutState.activeWorkout
    : null;
  const exercisesToImport = legacyRecords<ExerciseCatalogItem>(exercises);
  const normalizedPrefs = prefs ? {
    ...prefs,
    workoutTypes: legacyRecords<SettingsPreferences['workoutTypes'][number]>(prefs.workoutTypes),
    dailyMeasurementDefinitions: legacyRecords<SettingsPreferences['dailyMeasurementDefinitions'][number]>(prefs.dailyMeasurementDefinitions),
    dailyMeasurementEntries: legacyRecords<SettingsPreferences['dailyMeasurementEntries'][number]>(prefs.dailyMeasurementEntries),
  } : null;
  if (normalizedPrefs) await db.runAsync('INSERT INTO preferences (id, value_json) VALUES (1, ?)', JSON.stringify(normalizedPrefs));
  for (const [position, plan] of plansToImport.entries()) await db.runAsync('INSERT INTO plans (id, position, value_json) VALUES (?, ?, ?)', plan.id, position, JSON.stringify({ ...plan, routines: undefined }));
  for (const [position, routine] of routinesToImport.entries()) await db.runAsync('INSERT INTO routines (id, plan_id, position, value_json) VALUES (?, ?, ?, ?)', routine.id, routine.planId ?? null, position, JSON.stringify(routine));
  if (activeToImport) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 1, NULL, ?, ?)', activeToImport.id, activeToImport.startedAt, JSON.stringify(activeToImport));
  for (const workout of completedToImport) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 0, ?, ?, ?)', workout.id, workout.completedAt, workout.startedAt, JSON.stringify(workout));
  for (const exercise of exercisesToImport) await db.runAsync('INSERT INTO custom_exercises (id, value_json) VALUES (?, ?)', exercise.id, JSON.stringify(exercise));
  if (normalizedPrefs) for (const [position, type] of normalizedPrefs.workoutTypes.entries()) await db.runAsync('INSERT INTO workout_types (id, archived, position, value_json) VALUES (?, ?, ?, ?)', type.id, type.hidden ? 1 : 0, position, JSON.stringify(type));
  await db.runAsync('INSERT INTO forge_meta (key, value) VALUES (?, ?)', 'legacy-v1-migrated', '1');
  await AsyncStorage.multiRemove(LEGACY_KEYS);
}

export async function rows<T>(sql: string, ...params: SQLite.SQLiteBindValue[]): Promise<T[]> {
  return (await openForgeDatabase()).getAllAsync<T>(sql, ...params);
}
export async function database(): Promise<ForgeDatabase> { return openForgeDatabase(); }
