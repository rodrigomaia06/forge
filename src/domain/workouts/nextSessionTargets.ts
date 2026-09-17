import { measurementText, trackingFields } from '../exercises/tracking';
import type { SetMeasurementKind, SetTarget, Workout, WorkoutExerciseInput, WorkoutRoutine, WorkoutSet, WorkoutSetInput } from '../../types';

/**
 * Builds the next live-workout snapshot for a routine.
 *
 * A next-session target belongs to the completed workout that authored it. It
 * applies once: the next run uses the latest completed workout for this
 * routine, while the following run reads the just-completed workout instead.
 * Routine intervals stay intact for fields without a next-session override.
 */
export function routineExercisesWithNextSessionTargets(
  routine: WorkoutRoutine,
  completedWorkouts: readonly Workout[],
): WorkoutExerciseInput[] {
  const source = completedWorkouts
    .filter((workout) => workout.routineId === routine.id && workout.completedAt !== null && !workout.excludeFromTargets)
    .sort((left, right) => completedAt(right) - completedAt(left))[0];
  if (!source) return routine.exercises;

  const consumedSourceExercises = new Set<number>();
  return routine.exercises.map((exercise) => {
    const sourceExerciseIndex = source.exercises.findIndex((candidate, index) =>
      !consumedSourceExercises.has(index)
      && ((exercise.exerciseId && candidate.exerciseId === exercise.exerciseId)
        || sameExerciseName(candidate.name, exercise.name)),
    );
    if (sourceExerciseIndex < 0) return exercise;
    consumedSourceExercises.add(sourceExerciseIndex);
    const sourceExercise = source.exercises[sourceExerciseIndex];
    return {
      ...exercise,
      sets: (exercise.sets ?? []).map((set, index) =>
        withPreviousSessionData(
          withNextSessionTargets(set, sourceExercise.sets[index], exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType),
          sourceExercise.sets[index],
          exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType,
        ),
      ),
    };
  });
}

function withPreviousSessionData(
  routineSet: WorkoutSetInput,
  previousSet: WorkoutSet | undefined,
  trackingType: WorkoutExerciseInput['trackingType'],
): WorkoutSetInput {
  if (!previousSet) return routineSet;
  const values = trackingFields[trackingType ?? 'weight-reps']
    .map((kind) => measurementText(previousSet, kind))
    .filter(Boolean);
  return values.length ? { ...routineSet, previous: values.join(' × ') } : routineSet;
}

function completedAt(workout: Workout): number {
  return workout.completedAt ?? workout.startedAt;
}

function sameExerciseName(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), undefined, { sensitivity: 'accent' }) === 0;
}

function withNextSessionTargets(
  routineSet: WorkoutSetInput,
  previousSet: WorkoutSet | undefined,
  trackingType: WorkoutExerciseInput['trackingType'],
): WorkoutSetInput {
  if (!previousSet) return routineSet;
  const overrides = nextSessionTargets(previousSet, trackingType);
  if (!overrides.length) return routineSet;

  const overriddenKinds = new Set(overrides.map((target) => target.kind));
  const plannedTargets = [
    ...(routineSet.plannedTargets ?? []).filter((target) => !overriddenKinds.has(target.kind)),
    ...overrides.map((target) => ({
      ...target,
      // A routine set can be reused, so this generated snapshot target must
      // not borrow an ID from history or alter its persisted interval.
      id: `${routineSet.id ?? 'routine-set'}-next-${target.kind}`,
    })),
  ];
  return { ...routineSet, plannedTargets };
}

function nextSessionTargets(
  set: WorkoutSet,
  trackingType: WorkoutExerciseInput['trackingType'],
): SetTarget[] {
  const permitted = new Set<SetMeasurementKind>(trackingFields[trackingType ?? 'weight-reps']);
  const explicit = (set.targets ?? []).filter((target) => permitted.has(target.kind) && target.minValue !== undefined);
  const coveredKinds = new Set(explicit.map((target) => target.kind));
  const legacyCandidates = [
    legacyTarget(set.id, 'reps', set.targetReps),
    legacyTarget(set.id, 'weight', set.targetWeight),
  ];
  const legacy: SetTarget[] = [];
  for (const target of legacyCandidates) {
    if (target && permitted.has(target.kind) && !coveredKinds.has(target.kind)) legacy.push(target);
  }
  return [...explicit, ...legacy];
}

function legacyTarget(setId: string, kind: 'reps' | 'weight', text: string | undefined): SetTarget | null {
  if (!text?.trim()) return null;
  const values = text.split(/[-–—]/).map((part) => Number(part.trim())).filter(Number.isFinite);
  if (!values.length) return null;
  return {
    id: `${setId}-legacy-next-${kind}`,
    kind,
    unit: kind === 'reps' ? 'count' : 'kg',
    minValue: values[0],
    maxValue: values[1] ?? values[0],
  };
}
