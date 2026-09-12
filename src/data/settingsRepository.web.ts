import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SettingsPreferences } from '../types';
export { defaultSettingsPreferences } from './settingsDefaults';
import { parseSettingsPreferences } from './settingsPreferences';

const KEY = '@forge/settings-preferences';

/** Web avoids Expo SQLite's OPFS-only worker and persists through AsyncStorage. */
export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  return parseSettingsPreferences(await AsyncStorage.getItem(KEY));
}

export async function saveSettingsPreferences(preferences: SettingsPreferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(preferences));
}
