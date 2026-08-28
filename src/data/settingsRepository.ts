import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SettingsPreferences } from '../types';

const SETTINGS_PREFERENCES_KEY = '@forge/settings-preferences';

export const defaultSettingsPreferences: SettingsPreferences = {
  appearance: 'light',
  units: 'metric',
  weekStartsOn: 1,
  workoutTypes: [
    { id: 'strength', name: 'Strength', color: '#687CF2', source: 'builtIn' },
    { id: 'mobility', name: 'Mobility', color: '#55BC91', source: 'builtIn' },
    { id: 'cardio', name: 'Cardio', color: '#EF715F', source: 'builtIn' },
    { id: 'court-sport', name: 'Court sport', color: '#E3A346', source: 'builtIn' },
  ],
};

export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  const value = await AsyncStorage.getItem(SETTINGS_PREFERENCES_KEY);
  if (!value) return defaultSettingsPreferences;

  const parsed = JSON.parse(value) as Partial<SettingsPreferences>;
  return {
    appearance: parsed.appearance === 'light' ? parsed.appearance : 'light',
    units: parsed.units === 'metric' ? parsed.units : 'metric',
    weekStartsOn: parsed.weekStartsOn === 0 ? 0 : 1,
    workoutTypes: Array.isArray(parsed.workoutTypes)
      ? parsed.workoutTypes.flatMap((item) =>
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
        )
      : defaultSettingsPreferences.workoutTypes,
  };
}

export function saveSettingsPreferences(preferences: SettingsPreferences): Promise<void> {
  return AsyncStorage.setItem(SETTINGS_PREFERENCES_KEY, JSON.stringify(preferences));
}
