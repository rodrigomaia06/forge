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

/**
 * Resolve a routine/workout's leading icon from its free-text `type`, matching a
 * saved workout-type preference by id or name first, then a small set of
 * built-in fallbacks. Shared so the Plans list and the import review show the
 * same glyph for the same type.
 */
export function resolveWorkoutTypeIcon(
  type: string | undefined,
  workoutTypes: readonly WorkoutTypePreference[],
): IconName {
  const normalized = (type ?? '').trim().toLowerCase();
  if (!normalized) return 'layers';
  const preference = workoutTypes.find(
    (item) => item.id.toLowerCase() === normalized || item.name.toLowerCase() === normalized,
  );
  if (preference) return workoutTypeIcon(preference);
  if (normalized === 'strength') return 'fitness';
  if (normalized === 'calisthenics') return 'activity';
  if (normalized === 'mobility') return 'stretching';
  if (normalized === 'cardio') return 'running';
  if (normalized === 'court sport') return 'tennis-ball';
  return 'layers';
}
