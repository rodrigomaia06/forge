import { effectiveTracking, formatDuration, measurementsFor, trackingFields } from '../exercises/tracking';
import type { SetMeasurementKind, Workout, WorkoutExercise, WorkoutSet } from '../../types';

/** A completed set above any of these is almost certainly a typing mistake. */
export const MAX_PLAUSIBLE_WEIGHT_KG = 500;
export const MAX_PLAUSIBLE_REPS = 100;
export const MAX_PLAUSIBLE_DISTANCE_KM = 100;
export const MAX_PLAUSIBLE_SET_DURATION_SECONDS = 6 * 60 * 60;
/** A value more than this multiple of the exercise's previous best is also flagged. */
export const PREVIOUS_BEST_JUMP_FACTOR = 10;

type CheckedKind = Exclude<SetMeasurementKind, 'rpe'>;

const LIMITS: Record<CheckedKind, number> = {
  weight: MAX_PLAUSIBLE_WEIGHT_KG,
  addedWeight: MAX_PLAUSIBLE_WEIGHT_KG,
  reps: MAX_PLAUSIBLE_REPS,
  distance: MAX_PLAUSIBLE_DISTANCE_KM,
  duration: MAX_PLAUSIBLE_SET_DURATION_SECONDS,
};

export interface ImplausibleSetValue {
  exerciseId: string;
  exerciseName: string;
  /** 1-based position of the set within its exercise. */
  setNumber: number;
  kind: CheckedKind;
  value: number;
  reason: 'limit' | 'jump';
  previousBest?: number;
}

function isRecorded(set: WorkoutSet): boolean {
  return set.completed || Boolean(set.sideCompletion?.left || set.sideCompletion?.right);
}

function movementKey(exercise: WorkoutExercise): string {
  const id = exercise.exerciseId ?? exercise.exerciseSnapshot?.id;
  return id ? `id:${id}` : `name:${exercise.name.trim().toLocaleLowerCase()}`;
}

function recordedValues(exercise: WorkoutExercise, set: WorkoutSet): [CheckedKind, number][] {
  const mode = effectiveTracking(exercise);
  const permitted = trackingFields[mode];
  return measurementsFor(mode, set).flatMap((entry) =>
    entry.kind !== 'rpe' && permitted.includes(entry.kind) && Number.isFinite(entry.value)
      ? [[entry.kind, entry.value] as [CheckedKind, number]]
      : [],
  );
}

/** Each movement's best recorded value per measurement, from completed history. */
function previousBests(history: readonly Workout[]): Map<string, Partial<Record<CheckedKind, number>>> {
  const bests = new Map<string, Partial<Record<CheckedKind, number>>>();
  for (const workout of history) {
    if (workout.completedAt === null) continue;
    for (const exercise of workout.exercises) {
      if (exercise.offSession) continue;
      const key = movementKey(exercise);
      const best = bests.get(key) ?? {};
      for (const set of exercise.sets) {
        if (!isRecorded(set)) continue;
        for (const [kind, value] of recordedValues(exercise, set)) {
          if (value > (best[kind] ?? 0)) best[kind] = value;
        }
      }
      bests.set(key, best);
    }
  }
  return bests;
}

/**
 * Completed set values in `workout` that look like typing mistakes: above an
 * absolute limit, or more than `PREVIOUS_BEST_JUMP_FACTOR` times the
 * movement's previous best. `history` should not contain `workout` itself.
 */
export function implausibleSetValues(
  workout: Workout,
  history: readonly Workout[],
): ImplausibleSetValue[] {
  const bests = previousBests(history.filter((candidate) => candidate.id !== workout.id));
  return workout.exercises.flatMap((exercise) => {
    const best = bests.get(movementKey(exercise)) ?? {};
    return exercise.sets.flatMap((set, index) => {
      if (!isRecorded(set)) return [];
      return recordedValues(exercise, set).flatMap(([kind, value]): ImplausibleSetValue[] => {
        const base = { exerciseId: exercise.id, exerciseName: exercise.name, setNumber: index + 1, kind, value };
        if (value > LIMITS[kind]) return [{ ...base, reason: 'limit' }];
        const previousBest = best[kind];
        if (previousBest !== undefined && previousBest > 0 && value > previousBest * PREVIOUS_BEST_JUMP_FACTOR)
          return [{ ...base, reason: 'jump', previousBest }];
        return [];
      });
    });
  });
}

function formatValue(kind: CheckedKind, value: number): string {
  const number = Number(value.toFixed(2)).toLocaleString('en-US');
  if (kind === 'duration') return formatDuration(value);
  if (kind === 'reps') return `${number} reps`;
  if (kind === 'distance') return `${number} km`;
  return `${number} kg`;
}

/** One readable line per flagged value, e.g. "Bench Press, set 2: 1,000 kg". */
export function describeImplausibleSetValue(issue: ImplausibleSetValue): string {
  const detail = issue.reason === 'jump' && issue.previousBest !== undefined
    ? ` (best so far ${formatValue(issue.kind, issue.previousBest)})`
    : '';
  return `${issue.exerciseName}, set ${issue.setNumber}: ${formatValue(issue.kind, issue.value)}${detail}`;
}
