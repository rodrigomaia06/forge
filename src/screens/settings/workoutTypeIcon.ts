import type { IconName, WorkoutTypePreference } from '../../types';

export function workoutTypeIcon(type: WorkoutTypePreference): IconName {
  if (type.id === 'strength') return 'fitness';
  if (type.id === 'calisthenics') return 'activity';
  if (type.id === 'mobility') return 'stretching';
  if (type.id === 'cardio') return 'running';
  if (type.id === 'functional') return 'task-list';
  if (type.id === 'olympic-weightlifting') return 'weight';
  if (type.id === 'plyometrics') return 'activity';
  if (type.id === 'court-sport') return 'tennis-ball';
  if (type.id === 'field-sport') return 'basketball';
  if (type.id === 'martial-arts') return 'warm-up';
  return 'layers';
}
