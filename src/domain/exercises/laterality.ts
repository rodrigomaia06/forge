import type { WorkoutExercise } from '../../types';

/**
 * A unilateral exercise is trained one side at a time (e.g. a single-arm row),
 * so its sets complete per side. Detection uses the laterality captured in the
 * exercise snapshot; bilateral, alternating, and legacy (unsnapshotted) rows are
 * treated as a single completion.
 */
export function isUnilateralExercise(exercise: Pick<WorkoutExercise, 'exerciseSnapshot'>): boolean {
  return exercise.exerciseSnapshot?.laterality === 'unilateral';
}

/** The initial per-side completion state for a unilateral set. */
export const emptySideCompletion = { left: false, right: false } as const;
