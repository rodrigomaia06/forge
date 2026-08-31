export type AppearancePreference = 'light' | 'dark' | 'system';
export type UnitsPreference = 'metric' | 'imperial';
export type WeekStartsOn = 0 | 1;
export interface WorkoutTypePreference {
  id: string;
  name: string;
  color: string;
  hidden?: boolean;
  source: 'builtIn' | 'custom';
  hasReferencedData?: boolean;
}

export interface SettingsPreferences {
  appearance: AppearancePreference;
  units: UnitsPreference;
  bodyweightKg: number;
  weekStartsOn: WeekStartsOn;
  showRestTimer: boolean;
  defaultRestSeconds: number;
  keepRestTimerRunning: boolean;
  restTimerSound: boolean;
  restTimerHaptic: boolean;
  unfinishedWorkoutReminderEnabled: boolean;
  unfinishedWorkoutReminderDelay: number;
  showPlanInWorkoutTitle: boolean;
  workoutTypes: WorkoutTypePreference[];
}

export interface SettingsContextValue {
  ready: boolean;
  preferences: SettingsPreferences;
  updatePreferences: (changes: Partial<SettingsPreferences>) => void;
}
