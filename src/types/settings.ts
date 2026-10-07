import type { IconName } from './icons';
import type { WorkoutSide } from './workout';

export type AppearancePreference = 'light' | 'dark' | 'system';
export type UnitsPreference = 'metric' | 'imperial';
export type WeekStartsOn = 0 | 1;
export interface WorkoutTypePreference {
  id: string;
  name: string;
  color: string;
  colorCustomized?: boolean;
  icon?: IconName;
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
  /** Default between-sides rest for unilateral exercises (fired after the first side). */
  defaultUnilateralRestSeconds: number;
  /** Skip the between-sides rest on unilateral exercises; the normal between-set rest still fires. */
  disableUnilateralBetweenSidesRest: boolean;
  keepRestTimerRunning: boolean;
  restTimerSound: boolean;
  restTimerHaptic: boolean;
  unfinishedWorkoutReminderEnabled: boolean;
  unfinishedWorkoutReminderDelay: number;
  /** Built-in exercise rest-time overrides; omitted keys inherit the General default. */
  exerciseRestSeconds: Record<string, number>;
  /** Per-exercise between-sides rest overrides (unilateral); omitted keys inherit the General default. */
  exerciseUnilateralRestSeconds: Record<string, number>;
  /** Per-exercise leading side for unilateral exercises; omitted keys lead with the left side. */
  exerciseLeadSide: Record<string, WorkoutSide>;
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
  updatePreferences: (changes: Partial<SettingsPreferences>) => Promise<boolean>;
  reload: () => Promise<void>;
}
