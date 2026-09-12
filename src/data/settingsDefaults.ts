import type { SettingsPreferences } from '../types';

/** Static first-install settings; persistence and upgrade behavior live in the repository. */
export const defaultSettingsPreferences: SettingsPreferences = {
  appearance: 'system',
  units: 'metric',
  bodyweightKg: 0,
  weekStartsOn: 1,
  showRestTimer: true,
  defaultRestSeconds: 90,
  keepRestTimerRunning: true,
  restTimerSound: true,
  restTimerHaptic: true,
  unfinishedWorkoutReminderEnabled: false,
  unfinishedWorkoutReminderDelay: 1800,
  exerciseRestSeconds: {},
  dailyMeasurementDefinitions: [],
  dailyMeasurementEntries: [],
  workoutTypes: [
    { id: 'strength', name: 'Strength', color: '#687CF2', source: 'builtIn' },
    { id: 'calisthenics', name: 'Calisthenics', color: '#4D9C8A', source: 'builtIn' },
    { id: 'cardio', name: 'Cardio', color: '#EF715F', source: 'builtIn' },
    { id: 'mobility', name: 'Mobility', color: '#62C98A', source: 'builtIn' },
    { id: 'functional', name: 'Functional', color: '#B27BDA', source: 'builtIn' },
    { id: 'olympic-weightlifting', name: 'Olympic weightlifting', color: '#5478D8', source: 'builtIn' },
    { id: 'plyometrics', name: 'Plyometrics', color: '#D78543', source: 'builtIn' },
    { id: 'court-sport', name: 'Court sport', color: '#E3A346', source: 'builtIn' },
    { id: 'field-sport', name: 'Field sport', color: '#4C9B5D', source: 'builtIn' },
    { id: 'martial-arts', name: 'Martial arts', color: '#C56BE6', source: 'builtIn' },
  ],
};
