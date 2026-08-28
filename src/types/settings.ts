export type AppearancePreference = 'light';
export type UnitsPreference = 'metric';
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
  weekStartsOn: WeekStartsOn;
  workoutTypes: WorkoutTypePreference[];
}

export interface SettingsContextValue {
  ready: boolean;
  preferences: SettingsPreferences;
  updatePreferences: (changes: Partial<SettingsPreferences>) => void;
}
