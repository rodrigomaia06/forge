import type { TrackingType, WorkoutExercise, WorkoutSet } from '../../types';
import { effectiveTracking, measurementText, trackingFields } from './tracking';

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
