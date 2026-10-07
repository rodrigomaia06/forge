import type { TrackingType, Workout, WorkoutExercise, WorkoutSet } from '../../types';
import { effectiveTracking, measurementText, trackingFields } from './tracking';
import { trackingChoices } from './tracking';
import { exercisesWithAddedPrevious } from '../workouts/nextSessionTargets';

export type TrackingChangeResult =
  | { status: 'confirmation'; exercise: WorkoutExercise }
  | { status: 'applied' | 'unchanged'; blockId: string; mode: TrackingType }
  | { status: 'missing' | 'incompatible' | 'failed' };

/** Evaluated inside the active-state reducer, after queued set edits. */
export function applyLiveTrackingChange(
  workout: Workout | null,
  blockId: string,
  mode: TrackingType,
  confirmed: boolean,
  ids: readonly string[],
  history: readonly Workout[],
): { workout: Workout | null; result: TrackingChangeResult } {
  const exercise = workout?.exercises.find((item) => item.id === blockId);
  if (!workout || !exercise) return { workout, result: { status: 'missing' } };
  if (!trackingChoices(exercise).includes(mode))
    return { workout, result: { status: 'incompatible' } };
  if (effectiveTracking(exercise) === mode)
    return { workout, result: { status: 'unchanged', blockId, mode } };
  const discardSets = hasTrackingSetData(exercise);
  if (!confirmed && discardSets) return { workout, result: { status: 'confirmation', exercise } };
  const exercises = workout.exercises.map((item) =>
    item.id !== blockId
      ? item
      : {
          ...item,
          trackingOverride: mode,
          sets: discardSets
            ? Array.from({ length: 3 }, (_, index) => ({
                id: ids[index],
                weight: '',
                reps: '',
                completed: false,
              }))
            : item.sets.map((set) => cleanSet(set, mode)),
        },
  );
  const matched = exercisesWithAddedPrevious(exercises, [...history]);
  return {
    workout: {
      ...workout,
      exercises: exercises.map((item, position) =>
        workout.exercises.includes(item) ? item : matched[position],
      ),
    },
    result: { status: 'applied', blockId, mode },
  };
}

/** Previous-session hints aren't entered data and don't require discarding. */
export function hasTrackingSetData(exercise: WorkoutExercise): boolean {
  return (
    hasRecordedSets(exercise) ||
    exercise.sets.some(
      (set) =>
        Boolean(
          set.weight.trim() ||
          set.reps.trim() ||
          set.targetWeight?.trim() ||
          set.targetReps?.trim() ||
          set.comment?.trim() ||
          set.tag?.trim(),
        ) || Boolean(set.measurements?.length || set.targets?.length || set.plannedTargets?.length),
    )
  );
}

export function hasRecordedSets(exercise: WorkoutExercise): boolean {
  return exercise.sets.some(
    (set) => set.completed || set.sideCompletion?.left || set.sideCompletion?.right,
  );
}
export function losesTrackingData(exercise: WorkoutExercise, mode: TrackingType): boolean {
  const permitted = trackingFields[mode];
  return exercise.sets.some(
    (set) =>
      (set.measurements ?? []).some(
        (entry) => entry.kind !== 'rpe' && !permitted.includes(entry.kind),
      ) ||
      (!permitted.includes('reps') && Boolean(set.reps.trim())) ||
      (!permitted.includes('weight') &&
        !permitted.includes('addedWeight') &&
        Boolean(set.weight.trim())) ||
      trackingFields[effectiveTracking(exercise)].some(
        (kind) => !permitted.includes(kind) && Boolean(measurementText(set, kind).trim()),
      ) ||
      [...(set.plannedTargets ?? []), ...(set.targets ?? [])].some(
        (target) => !permitted.includes(target.kind),
      ) ||
      (!permitted.includes('reps') && Boolean(set.targetReps)) ||
      (!permitted.includes('weight') &&
        !permitted.includes('addedWeight') &&
        Boolean(set.targetWeight)),
  );
}
function cleanSet(set: WorkoutSet, mode: TrackingType): WorkoutSet {
  const fields = trackingFields[mode];
  return {
    ...set,
    previous: undefined,
    weight: fields.includes('weight') || fields.includes('addedWeight') ? set.weight : '',
    reps: fields.includes('reps') ? set.reps : '',
    measurements: set.measurements?.filter(
      (value) => fields.includes(value.kind) || value.kind === 'rpe',
    ),
    plannedTargets: set.plannedTargets?.filter((value) => fields.includes(value.kind)),
    targets: set.targets?.filter((value) => fields.includes(value.kind)),
    targetWeight:
      fields.includes('weight') || fields.includes('addedWeight') ? set.targetWeight : undefined,
    targetReps: fields.includes('reps') ? set.targetReps : undefined,
  };
}
/** Caller owns confirmation; completed blocks are never modified. */
export function changeExerciseTracking(
  exercises: readonly WorkoutExercise[],
  id: string,
  mode: TrackingType,
  newId: () => string,
): WorkoutExercise[] {
  return exercises.flatMap((exercise) => {
    if (exercise.id !== id || effectiveTracking(exercise) === mode) return [exercise];
    if (hasRecordedSets(exercise)) {
      const blockId = newId();
      return [
        exercise,
        {
          ...exercise,
          id: blockId,
          trackingOverride: mode,
          sets: Array.from({ length: 3 }, () => ({
            id: newId(),
            weight: '',
            reps: '',
            completed: false,
          })),
        },
      ];
    }
    return [
      {
        ...exercise,
        trackingOverride: mode,
        sets: exercise.sets.map((set) => cleanSet(set, mode)),
      },
    ];
  });
}
