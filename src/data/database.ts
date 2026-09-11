import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import type { PlansState, SettingsPreferences, WorkoutState } from '../types';

const DATABASE = 'forge.db';
export const BUNDLED_CATALOG_VERSION = 2;
const LEGACY_KEYS = ['@forge/active-workout', '@forge/completed-workouts', '@forge/plans-v1', '@forge/settings-preferences', '@forge/custom-exercises'];
let opening: Promise<SQLite.SQLiteDatabase> | undefined;

export type ForgeDatabase = SQLite.SQLiteDatabase;

export function openForgeDatabase(): Promise<ForgeDatabase> {
  opening ??= SQLite.openDatabaseAsync(DATABASE).then(async (db) => {
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
      CREATE TABLE IF NOT EXISTS set_measurements (id TEXT PRIMARY KEY NOT NULL, owner_set_id TEXT NOT NULL, kind TEXT NOT NULL, unit TEXT NOT NULL, value REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS set_targets (id TEXT PRIMARY KEY NOT NULL, owner_set_id TEXT NOT NULL, kind TEXT NOT NULL, unit TEXT NOT NULL, min_value REAL, max_value REAL);
    `);
    await db.runAsync('INSERT OR IGNORE INTO forge_meta (key, value) VALUES (?, ?)', 'bundled-catalog-version', String(BUNDLED_CATALOG_VERSION));
    await importLegacyOnce(db);
    return db;
  });
  return opening;
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
  await db.withTransactionAsync(async () => {
    if (prefs) await db.runAsync('INSERT INTO preferences (id, value_json) VALUES (1, ?)', JSON.stringify(prefs));
    for (const [position, plan] of planState.plans.entries()) await db.runAsync('INSERT INTO plans (id, position, value_json) VALUES (?, ?, ?)', plan.id, position, JSON.stringify({ ...plan, routines: undefined }));
    for (const routine of [...planState.standaloneRoutines, ...planState.plans.flatMap((plan) => plan.routines)]) await db.runAsync('INSERT INTO routines (id, plan_id, position, value_json) VALUES (?, ?, ?, ?)', routine.id, routine.planId ?? null, 0, JSON.stringify(routine));
    if (workoutState.activeWorkout) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 1, NULL, ?, ?)', workoutState.activeWorkout.id, workoutState.activeWorkout.startedAt, JSON.stringify(workoutState.activeWorkout));
    for (const workout of workoutState.completedWorkouts) await db.runAsync('INSERT INTO workouts (id, is_active, completed_at, started_at, value_json) VALUES (?, 0, ?, ?, ?)', workout.id, workout.completedAt, workout.startedAt, JSON.stringify(workout));
    for (const exercise of exercises) await db.runAsync('INSERT INTO custom_exercises (id, value_json) VALUES (?, ?)', exercise.id, JSON.stringify(exercise));
    if (prefs) for (const [position, type] of prefs.workoutTypes.entries()) await db.runAsync('INSERT INTO workout_types (id, archived, position, value_json) VALUES (?, ?, ?, ?)', type.id, type.hidden ? 1 : 0, position, JSON.stringify(type));
    await db.runAsync('INSERT INTO forge_meta (key, value) VALUES (?, ?)', 'legacy-v1-migrated', '1');
  });
  await AsyncStorage.multiRemove(LEGACY_KEYS);
}

export async function rows<T>(sql: string, ...params: SQLite.SQLiteBindValue[]): Promise<T[]> {
  return (await openForgeDatabase()).getAllAsync<T>(sql, ...params);
}
export async function database(): Promise<ForgeDatabase> { return openForgeDatabase(); }
