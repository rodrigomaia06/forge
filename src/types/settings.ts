import type { IconName } from './icons';

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

/** A user-defined metric recorded once or more per day. Values are stored in the metric's unit. */
export interface DailyMeasurementDefinition {
  id: string;
  name: string;
  unit: string;
  icon: IconName;
  color: string;
}

export interface DailyMeasurementEntry {
  id: string;
  definitionId: string;
  /** Local calendar date (`YYYY-MM-DD`), never a UTC timestamp. */
  date: string;
  value: number;
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
  /** Built-in exercise rest-time overrides; omitted keys inherit the General default. */
  exerciseRestSeconds: Record<string, number>;
  workoutTypes: WorkoutTypePreference[];
  dailyMeasurementDefinitions: DailyMeasurementDefinition[];
  dailyMeasurementEntries: DailyMeasurementEntry[];
  /** Saved view for the muscle-heatmap page. */
  muscleHeatmap: MuscleHeatmapView;
}

export interface MuscleHeatmapView {
  windowDays: number;
  gender: 'male' | 'female';
  breakdown: 'group' | 'muscle';
}

export interface SettingsContextValue {
  ready: boolean;
  preferences: SettingsPreferences;
  updatePreferences: (changes: Partial<SettingsPreferences>) => void;
  reload: () => Promise<void>;
}
