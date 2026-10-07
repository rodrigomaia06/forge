import type { ForgeTheme, IconName, Workout, WorkoutTypePreference } from '../../types';
import { builtInWorkoutTypeColors } from './workoutTypeDefaults';
import { resolveWorkoutTypeIcon } from './workoutTypeMetadata';

const FALLBACK_TYPES: Record<string, { color: string }> = {
  strength: { color: builtInWorkoutTypeColors.strength },
  calisthenics: { color: builtInWorkoutTypeColors.calisthenics },
  mobility: { color: builtInWorkoutTypeColors.mobility },
  cardio: { color: builtInWorkoutTypeColors.cardio },
  functional: { color: builtInWorkoutTypeColors.functional },
  'olympic weightlifting': { color: builtInWorkoutTypeColors['olympic-weightlifting'] },
  plyometrics: { color: builtInWorkoutTypeColors.plyometrics },
  'court sport': { color: builtInWorkoutTypeColors['court-sport'] },
  'field sport': { color: builtInWorkoutTypeColors['field-sport'] },
  'martial arts': { color: builtInWorkoutTypeColors['martial-arts'] },
};

export function formatCompactDuration(seconds = 0): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}h`;
}

export function countWorkoutSets(workout: Pick<Workout, 'exercises'>): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

export function getWorkoutTypePresentation(
  type: string,
  workoutTypes: WorkoutTypePreference[],
  theme: ForgeTheme,
  backgroundOpacity: number,
): { icon: IconName; color: string; background: string } {
  const normalizedType = type.trim().toLowerCase();
  const preference = workoutTypes.find(
    (item) => item.name.trim().toLowerCase() === normalizedType || item.id.toLowerCase() === normalizedType,
  );
  const fallback = FALLBACK_TYPES[normalizedType];
  const color = preference?.color ?? fallback?.color ?? theme.muted;
  const icon = resolveWorkoutTypeIcon(type, workoutTypes);
  return { icon, color, background: translucent(color, backgroundOpacity) };
}

function translucent(color: string, opacity: number): string {
  const value = color.trim().replace('#', '');
  const expanded = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return `rgba(138,150,158,${opacity.toFixed(2)})`;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${opacity.toFixed(2)})`;
}
