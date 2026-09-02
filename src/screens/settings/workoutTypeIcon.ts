import type { IconName, WorkoutTypePreference } from '../../types';

export function workoutTypeIcon(type: WorkoutTypePreference): IconName {
  if (type.id === 'strength') return 'fitness';
  if (type.id === 'mobility') return 'stretching';
  if (type.id === 'cardio') return 'running';
  if (type.id === 'court-sport') return 'tennis-ball';
  return 'layers';
}
