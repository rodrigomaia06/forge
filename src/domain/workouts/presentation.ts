import type { ForgeTheme, IconName, Workout } from '../../types';

export function formatCompactDuration(seconds = 0): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}

export function countWorkoutSets(workout: Pick<Workout, 'exercises'>): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

export function getWorkoutTypePresentation(type: string, theme: ForgeTheme, backgroundOpacity: number): { icon: IconName; color: string; background: string } {
  const opacity = backgroundOpacity.toFixed(2);
  const value = type.toLowerCase();
  if (value.includes('mobility')) return { icon: 'stretching', color: '#AA7CE8', background: `rgba(170,124,232,${opacity})` };
  if (value.includes('court')) return { icon: 'tennis-ball', color: theme.iconSport || '#62C98A', background: `rgba(98,201,138,${opacity})` };
  if (value.includes('cardio')) return { icon: 'running', color: theme.iconActivity || '#E99A5B', background: `rgba(233,154,91,${opacity})` };
  return { icon: 'fitness-outline', color: theme.iconStrength || '#6F7FF2', background: `rgba(111,127,242,${opacity})` };
}
