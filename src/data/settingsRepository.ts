import type { SettingsPreferences } from '../types';
import { database, withDatabaseTransaction } from './database';
export { defaultSettingsPreferences } from './settingsDefaults';
import { parseSettingsPreferences } from './settingsPreferences';
import { uniqueById } from './uniqueById';

export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  const row = await (await database()).getFirstAsync<{ value_json: string }>('SELECT value_json FROM preferences WHERE id = 1');
  return parseSettingsPreferences(row?.value_json ?? null);
}

export async function saveSettingsPreferences(preferences: SettingsPreferences): Promise<void> {
  const normalized: SettingsPreferences = {
    ...preferences,
    workoutTypes: uniqueById(preferences.workoutTypes),
    dailyMeasurementDefinitions: uniqueById(preferences.dailyMeasurementDefinitions),
    dailyMeasurementEntries: uniqueById(preferences.dailyMeasurementEntries),
  };
  await withDatabaseTransaction(async (db) => {
    await db.runAsync('INSERT OR REPLACE INTO preferences (id, value_json) VALUES (1, ?)', JSON.stringify(normalized));
    await db.runAsync('DELETE FROM workout_types');
    for (const [position, type] of normalized.workoutTypes.entries()) await db.runAsync('INSERT INTO workout_types (id, archived, position, value_json) VALUES (?, ?, ?, ?)', type.id, type.hidden ? 1 : 0, position, JSON.stringify(type));
  });
}
