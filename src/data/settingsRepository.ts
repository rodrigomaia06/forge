import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SettingsPreferences } from '../types';

const SETTINGS_PREFERENCES_KEY = '@forge/settings-preferences';

export const defaultSettingsPreferences: SettingsPreferences = {
  appearance: 'light',
  units: 'metric',
  weekStartsOn: 1,
};

export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  const value = await AsyncStorage.getItem(SETTINGS_PREFERENCES_KEY);
  if (!value) return defaultSettingsPreferences;

  const parsed = JSON.parse(value) as Partial<SettingsPreferences>;
  return {
    appearance: parsed.appearance === 'light' ? parsed.appearance : 'light',
    units: parsed.units === 'metric' ? parsed.units : 'metric',
    weekStartsOn: parsed.weekStartsOn === 0 ? 0 : 1,
  };
}

export function saveSettingsPreferences(preferences: SettingsPreferences): Promise<void> {
  return AsyncStorage.setItem(SETTINGS_PREFERENCES_KEY, JSON.stringify(preferences));
}
