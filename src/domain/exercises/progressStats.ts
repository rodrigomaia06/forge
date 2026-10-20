import type { TrackingType } from '../../types';
import { effectiveTracking } from './tracking';
import {
  completedProgressSets,
  progressInRange,
  type ExerciseSession,
  type ProgressMetric,
  type ProgressPoint,
} from './progress';

export type ProgressRecord = Pick<ProgressPoint, 'value' | 'date' | 'workoutId'>;
export type ProgressChange = { absolute: number; percent?: number };

export function estimatedOneRepMax(
  sessions: readonly ExerciseSession[],
  days: number | 'all',
  now = Date.now(),
): ProgressRecord | undefined {
  const candidates = sessions.flatMap((session) => {
    const eligible = {
      ...session,
      exercises: session.exercises.filter(
        (exercise) => effectiveTracking(exercise) === 'weight-reps',
      ),
    };
    const estimates = completedProgressSets(eligible, 'weight-reps').flatMap((set) => {
      const { weight, reps } = set;
      if (weight === undefined || reps === undefined || weight <= 0 || reps < 1) return [];
      const value = reps === 1 ? weight : weight + (weight / 30) * reps;
      return Number.isFinite(value) ? [value] : [];
    });
    if (!estimates.length) return [];
    return [
      {
        workoutId: session.workout.id,
        date: session.workout.startedAt,
        value: estimates.reduce((best, next) => Math.max(best, next)),
        automatic: false,
        excluded: false,
      },
    ];
  });
  return progressRecord(progressInRange(candidates, days, now), 'load', 'weight-reps');
}

export function progressRecord(
  points: readonly ProgressPoint[],
  metric: ProgressMetric,
  mode: TrackingType,
): ProgressRecord | undefined {
  const lower = metric === 'pace' || (metric === 'load' && mode.startsWith('assisted'));
  return includedChronologically(points).reduce<ProgressRecord | undefined>((best, point) => {
    if (!best || (lower ? point.value < best.value : point.value > best.value)) return point;
    return best;
  }, undefined);
}

export function progressChange(points: readonly ProgressPoint[]): ProgressChange | undefined {
  const included = includedChronologically(points);
  if (included.length < 2) return undefined;
  const first = included[0].value;
  const absolute = included[included.length - 1].value - first;
  const percent = first !== 0 ? (absolute / first) * 100 : undefined;
  return { absolute, ...(percent !== undefined && Number.isFinite(percent) ? { percent } : {}) };
}

function includedChronologically(points: readonly ProgressPoint[]) {
  return points
    .filter((point) => !point.excluded && Number.isFinite(point.value))
    .sort((a, b) => a.date - b.date || a.workoutId.localeCompare(b.workoutId));
}
