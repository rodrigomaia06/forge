import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SettingsPreferences } from '../types';

const SETTINGS_PREFERENCES_KEY = '@forge/settings-preferences';

export const defaultSettingsPreferences: SettingsPreferences = {
  appearance: 'light',
  units: 'metric',
  bodyweightKg: 0,
  weekStartsOn: 1,
  showRestTimer: true,
  defaultRestSeconds: 90,
  keepRestTimerRunning: false,
  restTimerSound: true,
  restTimerHaptic: true,
  unfinishedWorkoutReminderEnabled: false,
  unfinishedWorkoutReminderDelay: 1800,
  showPlanInWorkoutTitle: true,
  exerciseRestSeconds: {},
  workoutTypes: [
    { id: 'strength', name: 'Strength', color: '#687CF2', source: 'builtIn' },
    { id: 'mobility', name: 'Mobility', color: '#62C98A', source: 'builtIn' },
    { id: 'cardio', name: 'Cardio', color: '#EF715F', source: 'builtIn' },
    { id: 'court-sport', name: 'Court sport', color: '#E3A346', source: 'builtIn' },
  ],
};

export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  const value = await AsyncStorage.getItem(SETTINGS_PREFERENCES_KEY);
  if (!value) return defaultSettingsPreferences;

  const parsed = JSON.parse(value) as Partial<SettingsPreferences>;
  return {
    appearance: parsed.appearance === 'dark' || parsed.appearance === 'system' ? parsed.appearance : 'light',
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
    showPlanInWorkoutTitle: parsed.showPlanInWorkoutTitle !== false,
    exerciseRestSeconds:
      parsed.exerciseRestSeconds && typeof parsed.exerciseRestSeconds === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.exerciseRestSeconds).filter(
              ([, value]) => typeof value === 'number' && value >= 0,
            ),
          )
        : {},
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
