import type { ExerciseCatalogItem } from './exerciseCatalog';
import { loadCustomExercises, saveCustomExercises } from './exerciseRepository';
import { loadPlansState, savePlansState } from './plansRepository';
import { loadSettingsPreferences, saveSettingsPreferences } from './settingsRepository';
import { loadWorkoutState, saveActiveWorkout, saveCompletedWorkouts } from './workoutRepository';
import type { PlansState, SettingsPreferences, WorkoutState } from '../types';

export const FORGE_TRANSFER_VERSION = 1;
export type ForgeDataTransfer = { format: 'forge-data'; version: number; exportedAt: string; settings: SettingsPreferences; plans: PlansState; workouts: WorkoutState; customExercises: ExerciseCatalogItem[] };
export type BackupInspection = { bytes: Uint8Array; workoutCount: number; activeWorkout: boolean; planCount: number; customExerciseCount: number };

function download(name: string, type: string, body: string): void {
  const blob = new Blob([body], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
export async function createDataTransfer(): Promise<ForgeDataTransfer> {
  const [settings, plans, workouts, customExercises] = await Promise.all([loadSettingsPreferences(), loadPlansState(), loadWorkoutState(), loadCustomExercises()]);
  return { format: 'forge-data', version: FORGE_TRANSFER_VERSION, exportedAt: new Date().toISOString(), settings, plans, workouts, customExercises };
}
export async function exportJson(): Promise<void> { download('forge-data.json', 'application/json', JSON.stringify(await createDataTransfer(), null, 2)); }
export async function exportText(): Promise<void> { const data = await createDataTransfer(); download('forge-data.txt', 'text/plain', `Forge training data\nExported: ${data.exportedAt}\nCompleted workouts: ${data.workouts.completedWorkouts.length}\nPlans: ${data.plans.plans.length}\nCustom exercises: ${data.customExercises.length}`); }
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
export function parseDataTransfer(raw: string): ForgeDataTransfer { let value: unknown; try { value = JSON.parse(raw); } catch { throw new Error('This is not valid Forge JSON.'); } if (!isObject(value) || value.format !== 'forge-data' || value.version !== FORGE_TRANSFER_VERSION || !isObject(value.settings) || !isObject(value.plans) || !isObject(value.workouts) || !Array.isArray(value.customExercises)) throw new Error('This JSON is not a compatible Forge data export.'); return value as unknown as ForgeDataTransfer; }
async function chooseJson(): Promise<string | null> { return new Promise((resolve) => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json'; input.onchange = () => { const file = input.files?.[0]; if (!file) return resolve(null); const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => resolve(null); reader.readAsText(file); }; input.click(); }); }
export async function pickJsonTransfer(): Promise<ForgeDataTransfer | null> { const raw = await chooseJson(); return raw ? parseDataTransfer(raw) : null; }
export async function mergeDataTransfer(incoming: ForgeDataTransfer): Promise<{ workouts: number; exercises: number }> { const [settings, plans, workouts, exercises] = await Promise.all([loadSettingsPreferences(), loadPlansState(), loadWorkoutState(), loadCustomExercises()]); const merge = <T extends { id: string }>(a: T[], b: T[]): T[] => [...a, ...b.filter((item) => !a.some((existing) => existing.id === item.id))]; const completed = merge(workouts.completedWorkouts, incoming.workouts.completedWorkouts); const custom = merge(exercises, incoming.customExercises); await Promise.all([saveSettingsPreferences({ ...settings, workoutTypes: merge(settings.workoutTypes, incoming.settings.workoutTypes ?? []), dailyMeasurementDefinitions: merge(settings.dailyMeasurementDefinitions, incoming.settings.dailyMeasurementDefinitions ?? []), dailyMeasurementEntries: merge(settings.dailyMeasurementEntries, incoming.settings.dailyMeasurementEntries ?? []) }), savePlansState({ plans: merge(plans.plans, incoming.plans.plans), standaloneRoutines: merge(plans.standaloneRoutines, incoming.plans.standaloneRoutines) }), saveCompletedWorkouts(completed), saveCustomExercises(custom), !workouts.activeWorkout && incoming.workouts.activeWorkout ? saveActiveWorkout(incoming.workouts.activeWorkout) : Promise.resolve()]); return { workouts: completed.length - workouts.completedWorkouts.length, exercises: custom.length - exercises.length }; }
export async function importJson(): Promise<{ workouts: number; exercises: number }> { const incoming = await pickJsonTransfer(); return incoming ? mergeDataTransfer(incoming) : { workouts: 0, exercises: 0 }; }
export async function createSqliteBackup(): Promise<void> { throw new Error('Full SQLite backups are available in iOS and Android builds, not on web.'); }
export async function pickSqliteBackup(): Promise<BackupInspection | null> { throw new Error('Full SQLite restore is available in iOS and Android builds, not on web.'); }
export async function restoreSqliteBackup(): Promise<void> { throw new Error('Full SQLite restore is available in iOS and Android builds, not on web.'); }
export async function databaseStatus(): Promise<{ tables: number; database: string }> { return { tables: 0, database: 'Browser storage' }; }
