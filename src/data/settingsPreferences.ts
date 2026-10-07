import type {
  DailyMeasurementDefinition,
  DailyMeasurementEntry,
  IconName,
  SettingsPreferences,
} from '../types';
import { defaultSettingsPreferences } from './settingsDefaults';
import { uniqueById } from './uniqueById';
import { isWorkoutTypeIcon } from '../domain/workouts/workoutTypeMetadata';
import {
  builtInWorkoutTypeColors,
  supersededBuiltInWorkoutTypeColors,
} from '../domain/workouts/workoutTypeDefaults';

/** Defensive reader shared by SQLite and web storage implementations. */
export function parseSettingsPreferences(value: string | null): SettingsPreferences {
  if (!value) return defaultSettingsPreferences;
  let parsed: Partial<SettingsPreferences>;
  try {
    parsed = JSON.parse(value) as Partial<SettingsPreferences>;
  } catch {
    return defaultSettingsPreferences;
  }
  // Must stay in sync with the metric-icon picker in DailyMeasurementsScreen —
  // an icon the picker offers but this list omits would silently drop the whole
  // measurement definition on the next load.
  const validIcons: readonly IconName[] = [
    'weight', 'measure', 'heart', 'hydration', 'energy', 'sleep', 'recovery', 'activity',
    'goal', 'running', 'fitness', 'time', 'temperature', 'nutrition', 'mood', 'focus',
  ];
  const definitions: DailyMeasurementDefinition[] = Array.isArray(parsed.dailyMeasurementDefinitions)
    ? parsed.dailyMeasurementDefinitions.flatMap((item) =>
        typeof item?.id === 'string' && typeof item.name === 'string' && item.name.trim() &&
        typeof item.unit === 'string' && typeof item.color === 'string' &&
        validIcons.includes(item.icon as IconName)
          ? [{ id: item.id, name: item.name.trim(), unit: item.unit.trim(), icon: item.icon as IconName, color: item.color }]
          : [],
      )
    : defaultSettingsPreferences.dailyMeasurementDefinitions;
  const uniqueDefinitions = uniqueById(definitions);
  const definitionIds = new Set(uniqueDefinitions.map((item) => item.id));
  const entries: DailyMeasurementEntry[] = Array.isArray(parsed.dailyMeasurementEntries)
    ? parsed.dailyMeasurementEntries.flatMap((item) =>
        typeof item?.id === 'string' && typeof item.definitionId === 'string' &&
        definitionIds.has(item.definitionId) && typeof item.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) && typeof item.value === 'number' && Number.isFinite(item.value)
          ? [{ id: item.id, definitionId: item.definitionId, date: item.date, value: item.value }]
          : [],
      )
    : [];
  const parsedWorkoutTypes = uniqueById(Array.isArray(parsed.workoutTypes)
    ? [...parsed.workoutTypes.flatMap((item) =>
        typeof item?.id === 'string' && typeof item.name === 'string' && typeof item.color === 'string'
          ? [{
              id: item.id,
              name: item.name,
              color: item.color,
              colorCustomized: item.colorCustomized === true,
              icon: isWorkoutTypeIcon(item.icon) ? item.icon : undefined,
              hidden: item.hidden === true,
              hasReferencedData: item.hasReferencedData === true,
              source: item.source === 'builtIn' || item.source === 'custom'
                ? item.source
                : defaultSettingsPreferences.workoutTypes.some((type) => type.id === item.id)
                  ? 'builtIn'
                  : 'custom',
            }]
          : [],
      ), ...defaultSettingsPreferences.workoutTypes.filter((defaultType) => !parsed.workoutTypes?.some((item) => item?.id === defaultType.id))] as SettingsPreferences['workoutTypes']
    : defaultSettingsPreferences.workoutTypes);
  return {
    appearance: parsed.appearance === 'light' || parsed.appearance === 'dark' || parsed.appearance === 'system' ? parsed.appearance : 'system',
    units: parsed.units === 'imperial' ? parsed.units : 'metric',
    bodyweightKg: typeof parsed.bodyweightKg === 'number' && parsed.bodyweightKg >= 0 ? parsed.bodyweightKg : 0,
    weekStartsOn: parsed.weekStartsOn === 0 ? 0 : 1,
    showRestTimer: parsed.showRestTimer !== false,
    defaultRestSeconds: typeof parsed.defaultRestSeconds === 'number' && parsed.defaultRestSeconds >= 0 ? parsed.defaultRestSeconds : 90,
    defaultUnilateralRestSeconds: typeof parsed.defaultUnilateralRestSeconds === 'number' && parsed.defaultUnilateralRestSeconds >= 0 ? parsed.defaultUnilateralRestSeconds : 30,
    disableUnilateralBetweenSidesRest: parsed.disableUnilateralBetweenSidesRest === true,
    // Match Forge's established timer behavior for saved settings predating
    // this flag: an elapsed rest remains visible in destructive red until it
    // is stopped or extended. An explicit false is still respected.
    keepRestTimerRunning: parsed.keepRestTimerRunning !== false,
    restTimerSound: parsed.restTimerSound !== false,
    restTimerHaptic: parsed.restTimerHaptic !== false,
    unfinishedWorkoutReminderEnabled: parsed.unfinishedWorkoutReminderEnabled === true,
    unfinishedWorkoutReminderDelay: [900, 1800, 3600, 7200].includes(parsed.unfinishedWorkoutReminderDelay as number) ? parsed.unfinishedWorkoutReminderDelay as number : 1800,
    exerciseRestSeconds:
      parsed.exerciseRestSeconds && typeof parsed.exerciseRestSeconds === 'object'
        ? Object.fromEntries(Object.entries(parsed.exerciseRestSeconds).filter(([, item]) => typeof item === 'number' && item >= 0))
        : {},
    exerciseUnilateralRestSeconds:
      parsed.exerciseUnilateralRestSeconds && typeof parsed.exerciseUnilateralRestSeconds === 'object'
        ? Object.fromEntries(Object.entries(parsed.exerciseUnilateralRestSeconds).filter(([, item]) => typeof item === 'number' && item >= 0))
        : {},
    exerciseLeadSide:
      parsed.exerciseLeadSide && typeof parsed.exerciseLeadSide === 'object'
        ? Object.fromEntries(Object.entries(parsed.exerciseLeadSide).filter(([, item]) => item === 'left' || item === 'right'))
        : {},
    dailyMeasurementDefinitions: uniqueDefinitions,
    dailyMeasurementEntries: uniqueById(entries),
    muscleHeatmap: {
      windowDays: [7, 30, 90].includes((parsed.muscleHeatmap?.windowDays as number))
        ? (parsed.muscleHeatmap!.windowDays as number)
        : defaultSettingsPreferences.muscleHeatmap.windowDays,
      gender: parsed.muscleHeatmap?.gender === 'female' ? 'female' : 'male',
      breakdown: parsed.muscleHeatmap?.breakdown === 'muscle' ? 'muscle' : 'group',
    },
    // Upgrade only the React Native defaults. A deliberately edited built-in
    // or a custom type keeps the user-selected color.
    workoutTypes: parsedWorkoutTypes.map((item) =>
      item.source === 'builtIn'
        && !item.colorCustomized
        && supersededBuiltInWorkoutTypeColors[item.id]?.toUpperCase() === item.color.trim().toUpperCase()
        ? { ...item, color: builtInWorkoutTypeColors[item.id] }
        : item,
    ),
  };
}
