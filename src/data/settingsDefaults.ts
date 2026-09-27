import type { SettingsPreferences } from '../types';
import { builtInWorkoutTypeColors } from '../domain/workouts/workoutTypeDefaults';

/** Static first-install settings; persistence and upgrade behavior live in the repository. */
export const defaultSettingsPreferences: SettingsPreferences = {
  appearance: 'system',
  units: 'metric',
  bodyweightKg: 0,
  weekStartsOn: 1,
  showRestTimer: true,
  defaultRestSeconds: 90,
  defaultUnilateralRestSeconds: 30,
  keepRestTimerRunning: true,
  restTimerSound: true,
  restTimerHaptic: true,
  unfinishedWorkoutReminderEnabled: false,
  unfinishedWorkoutReminderDelay: 1800,
  exerciseRestSeconds: {},
  exerciseUnilateralRestSeconds: {},
  exerciseLeadSide: {},
  dailyMeasurementDefinitions: [],
  dailyMeasurementEntries: [],
  muscleHeatmap: { windowDays: 30, gender: 'male', breakdown: 'group' },
  workoutTypes: [
    { id: 'strength', name: 'Strength', color: builtInWorkoutTypeColors.strength, source: 'builtIn' },
    { id: 'calisthenics', name: 'Calisthenics', color: builtInWorkoutTypeColors.calisthenics, source: 'builtIn' },
    { id: 'cardio', name: 'Cardio', color: builtInWorkoutTypeColors.cardio, source: 'builtIn' },
    { id: 'mobility', name: 'Mobility', color: builtInWorkoutTypeColors.mobility, source: 'builtIn' },
    { id: 'functional', name: 'Functional', color: builtInWorkoutTypeColors.functional, source: 'builtIn' },
    { id: 'olympic-weightlifting', name: 'Olympic weightlifting', color: builtInWorkoutTypeColors['olympic-weightlifting'], source: 'builtIn' },
    { id: 'plyometrics', name: 'Plyometrics', color: builtInWorkoutTypeColors.plyometrics, source: 'builtIn' },
    { id: 'court-sport', name: 'Court sport', color: builtInWorkoutTypeColors['court-sport'], source: 'builtIn' },
    { id: 'field-sport', name: 'Field sport', color: builtInWorkoutTypeColors['field-sport'], source: 'builtIn' },
    { id: 'martial-arts', name: 'Martial arts', color: builtInWorkoutTypeColors['martial-arts'], source: 'builtIn' },
  ],
};
