export type AppearancePreference = 'light';
export type UnitsPreference = 'metric';
export type WeekStartsOn = 0 | 1;

export interface SettingsPreferences {
  appearance: AppearancePreference;
  units: UnitsPreference;
  weekStartsOn: WeekStartsOn;
}

export interface SettingsContextValue {
  ready: boolean;
  preferences: SettingsPreferences;
  updatePreferences: (changes: Partial<SettingsPreferences>) => void;
}
