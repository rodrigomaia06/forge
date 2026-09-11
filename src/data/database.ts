import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import { bundledCatalogTaxonomies, bundledCatalogVersion, bundledExercises, bundledLegacyIdMap } from './catalog/loadCatalog';
import type { PlansState, SettingsPreferences, WorkoutState } from '../types';

const DATABASE = 'forge.db';
export const BUNDLED_CATALOG_VERSION = bundledCatalogVersion;
const LEGACY_KEYS = ['@forge/active-workout', '@forge/completed-workouts', '@forge/plans-v1', '@forge/settings-preferences', '@forge/custom-exercises'];
let opening: Promise<SQLite.SQLiteDatabase> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

export type ForgeDatabase = SQLite.SQLiteDatabase;

/** Expo SQLite uses one native connection; serialize transaction starts across repositories. */
export function withDatabaseTransaction(work: (db: ForgeDatabase) => Promise<void>): Promise<void> {
  const next = writeQueue.catch(() => undefined).then(async () => {
    const db = await openForgeDatabase();
    await db.withTransactionAsync(async () => work(db));
  });
  writeQueue = next;
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
  await migrateLegacyExerciseIds(db);
  await db.runAsync('INSERT OR REPLACE INTO forge_meta (key, value) VALUES (?, ?)', 'bundled-catalog-version', String(BUNDLED_CATALOG_VERSION));
}

function migrateExerciseIds<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(migrateExerciseIds) as T;
  const record = value as Record<string, unknown>;
  const migrated = Object.fromEntries(Object.entries(record).map(([key, child]) => [key, migrateExerciseIds(child)]));
  if (typeof migrated.exerciseId === 'string' && bundledLegacyIdMap[migrated.exerciseId as keyof typeof bundledLegacyIdMap]) migrated.exerciseId = bundledLegacyIdMap[migrated.exerciseId as keyof typeof bundledLegacyIdMap];
  if (migrated.exerciseSnapshot && typeof migrated.exerciseSnapshot === 'object') {
    const snapshot = migrated.exerciseSnapshot as Record<string, unknown>;
    if (typeof snapshot.id === 'string' && bundledLegacyIdMap[snapshot.id as keyof typeof bundledLegacyIdMap]) snapshot.id = bundledLegacyIdMap[snapshot.id as keyof typeof bundledLegacyIdMap];
  }
  return migrated as T;
}
async function migrateLegacyExerciseIds(db: ForgeDatabase): Promise<void> {
  for (const table of ['workouts', 'routines']) {
    const rows = await db.getAllAsync<{ id: string; value_json: string }>(`SELECT id, value_json FROM ${table}`);
    for (const row of rows) {
      try {
        const migrated = migrateExerciseIds(JSON.parse(row.value_json));
        if (JSON.stringify(migrated) !== row.value_json) await db.runAsync(`UPDATE ${table} SET value_json = ? WHERE id = ?`, JSON.stringify(migrated), row.id);
      } catch { /* Corrupt user data is handled by each repository's reader. */ }
    }
  }
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
  if (prefs) await db.runAsync('INSERT INTO preferences (id, value_json) VALUES (1, ?)', JSON.stringify(prefs));
  for (const [position, plan] of planState.plans.entries()) await db.runAsync('INSERT INTO plans (id, position, value_json) VALUES (?, ?, ?)', plan.id, position, JSON.stringify({ ...plan, routines: undefined }));
  for (const routine of [...planState.standaloneRoutines, ...planState.plans.flatMap((plan) => plan.routines)]) await db.runAsync('INSERT INTO routines (id, plan_id, position, value_json) VALUES (?, ?, ?, ?)', routine.id, routine.planId ?? null, 0, JSON.stringify(routine));
  if (workoutState.activeWorkout) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 1, NULL, ?, ?)', workoutState.activeWorkout.id, workoutState.activeWorkout.startedAt, JSON.stringify(workoutState.activeWorkout));
  for (const workout of workoutState.completedWorkouts) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 0, ?, ?, ?)', workout.id, workout.completedAt, workout.startedAt, JSON.stringify(workout));
  for (const exercise of exercises) await db.runAsync('INSERT INTO custom_exercises (id, value_json) VALUES (?, ?)', exercise.id, JSON.stringify(exercise));
  if (prefs) for (const [position, type] of prefs.workoutTypes.entries()) await db.runAsync('INSERT INTO workout_types (id, archived, position, value_json) VALUES (?, ?, ?, ?)', type.id, type.hidden ? 1 : 0, position, JSON.stringify(type));
  await db.runAsync('INSERT INTO forge_meta (key, value) VALUES (?, ?)', 'legacy-v1-migrated', '1');
  await AsyncStorage.multiRemove(LEGACY_KEYS);
}

export async function rows<T>(sql: string, ...params: SQLite.SQLiteBindValue[]): Promise<T[]> {
  return (await openForgeDatabase()).getAllAsync<T>(sql, ...params);
}
export async function database(): Promise<ForgeDatabase> { return openForgeDatabase(); }
