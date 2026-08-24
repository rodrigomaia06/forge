import { workoutsByDate } from '../../data/mockWorkouts';

export interface WorkoutTypeSummary {
  type: string;
  count: number;
  minutes: number;
  duration: string;
  color: string;
}

export function summarizeWorkoutTypes(): WorkoutTypeSummary[] {
  const summary: Record<string, { type: string; count: number; minutes: number }> = {};
  Object.values(workoutsByDate)
    .flat()
    .forEach((workout) => {
      const minutes = parseDuration(workout.duration || '');
      if (!summary[workout.type]) summary[workout.type] = { type: workout.type, count: 0, minutes };
      else summary[workout.type].minutes += minutes;
      summary[workout.type].count += 1;
    });
  return Object.values(summary).map((item) => ({
    ...item,
    duration: formatDuration(item.minutes),
    color: item.type === 'Strength' ? '#8290F4' : '#ED7C82',
  }));
}

function parseDuration(value: string): number {
  const hours = Number(value.match(/(\d+)\s*h/)?.[1] || 0);
  const minutes = Number(value.match(/(\d+)\s*min/)?.[1] || 0);
  return hours * 60 + minutes;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${String(remainder).padStart(2, '0')}m` : `${remainder}m`;
}
