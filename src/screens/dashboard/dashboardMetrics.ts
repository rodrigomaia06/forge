import { getWorkoutTypePresentation } from '../../domain/workouts/presentation';
import type { ForgeTheme, Workout, WorkoutTypePreference } from '../../types';

export interface WorkoutTypeSummary {
  type: string;
  count: number;
  minutes: number;
  duration: string;
  color: string;
}

export function summarizeWorkoutTypes(
  workoutTypes: WorkoutTypePreference[],
  theme: ForgeTheme,
  workouts: Workout[],
): WorkoutTypeSummary[] {
  const summary: Record<string, { type: string; count: number; minutes: number }> = {};
  workouts.forEach((workout) => {
      const minutes = Math.round((workout.durationSeconds ?? 0) / 60);
      if (!summary[workout.type]) summary[workout.type] = { type: workout.type, count: 0, minutes };
      else summary[workout.type].minutes += minutes;
      summary[workout.type].count += 1;
    });
  return Object.values(summary).map((item) => ({
    ...item,
    duration: formatDuration(item.minutes),
    color: getWorkoutTypePresentation(item.type, workoutTypes, theme, 1).color,
  }));
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${String(remainder).padStart(2, '0')}m` : `${remainder}m`;
}
