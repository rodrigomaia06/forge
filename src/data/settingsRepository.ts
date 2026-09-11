import type { SettingsPreferences } from '../types';
import { database, withDatabaseTransaction } from './database';
export { defaultSettingsPreferences } from './settingsDefaults';
import { defaultSettingsPreferences } from './settingsDefaults';

export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  const row = await (await database()).getFirstAsync<{ value_json: string }>('SELECT value_json FROM preferences WHERE id = 1');
  if (!row) return defaultSettingsPreferences;
  const value = row.value_json;

  const parsed = JSON.parse(value) as Partial<SettingsPreferences>;
  return {
    appearance: parsed.appearance === 'light' || parsed.appearance === 'dark' || parsed.appearance === 'system' ? parsed.appearance : 'system',
    units: parsed.units === 'imperial' ? parsed.units : 'metric',
    bodyweightKg: typeof parsed.bodyweightKg === 'number' && parsed.bodyweightKg >= 0 ? parsed.bodyweightKg : 0,
    weekStartsOn: parsed.weekStartsOn === 0 ? 0 : 1,
    showRestTimer: parsed.showRestTimer !== false,
    defaultRestSeconds: typeof parsed.defaultRestSeconds === 'number' && parsed.defaultRestSeconds >= 0 ? parsed.defaultRestSeconds : 90,
    keepRestTimerRunning: parsed.keepRestTimerRunning === true,
    restTimerSound: parsed.restTimerSound !== false,
    restTimerHaptic: parsed.restTimerHaptic !== false,
    unfinishedWorkoutReminderEnabled: parsed.unfinishedWorkoutReminderEnabled === true,
    unfinishedWorkoutReminderDelay: [900, 1800, 3600, 7200].includes(parsed.unfinishedWorkoutReminderDelay as number) ? parsed.unfinishedWorkoutReminderDelay as number : 1800,
    exerciseRestSeconds:
      parsed.exerciseRestSeconds && typeof parsed.exerciseRestSeconds === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.exerciseRestSeconds).filter(
              ([, value]) => typeof value === 'number' && value >= 0,
            ),
          )
        : {},
    workoutTypes: Array.isArray(parsed.workoutTypes)
      ? ([...parsed.workoutTypes.flatMap((item) =>
          typeof item?.id === 'string' && typeof item.name === 'string' && typeof item.color === 'string'
            ? [{
                id: item.id,
                name: item.name,
                color: item.color,
                hidden: item.hidden === true,
                hasReferencedData: item.hasReferencedData === true,
                source: item.source === 'builtIn' || item.source === 'custom'
                  ? item.source
                  : defaultSettingsPreferences.workoutTypes.some((type) => type.id === item.id)
                    ? 'builtIn'
                    : 'custom',
              }]
            : [],
        ), ...defaultSettingsPreferences.workoutTypes.filter((defaultType) => !parsed.workoutTypes?.some((item) => item?.id === defaultType.id))] as SettingsPreferences['workoutTypes'])
      : defaultSettingsPreferences.workoutTypes,
  };
}

export async function saveSettingsPreferences(preferences: SettingsPreferences): Promise<void> {
  await withDatabaseTransaction(async (db) => {
    await db.runAsync('INSERT OR REPLACE INTO preferences (id, value_json) VALUES (1, ?)', JSON.stringify(preferences));
    await db.runAsync('DELETE FROM workout_types');
    for (const [position, type] of preferences.workoutTypes.entries()) await db.runAsync('INSERT INTO workout_types (id, archived, position, value_json) VALUES (?, ?, ?, ?)', type.id, type.hidden ? 1 : 0, position, JSON.stringify(type));
  });
}
