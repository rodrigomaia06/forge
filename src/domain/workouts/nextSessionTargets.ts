import { measurementText, trackingFields } from '../exercises/tracking';
import type { SetMeasurementKind, SetTarget, Workout, WorkoutExercise, WorkoutExerciseInput, WorkoutRoutine, WorkoutSet, WorkoutSetInput } from '../../types';

/**
 * Fills each set's `previous` for a completed workout being viewed in history,
 * derived live from the most recent earlier session of the same exercise. Live
 * workouts capture `previous` at start, but imported/legacy sessions never did —
 * computing it here keeps the History "Previous" column accurate for every
 * workout without a data backfill, matching by exercise id (name as a fallback).
 */
export function exercisesWithHistoricalPrevious(
  workout: Workout,
  completedWorkouts: readonly Workout[],
): WorkoutExercise[] {
  const priorHistory = completedWorkouts
    .filter((candidate) => candidate.id !== workout.id && completedAt(candidate) < completedAt(workout))
    .sort((left, right) => completedAt(right) - completedAt(left));
  if (!priorHistory.length) return workout.exercises;
  return workout.exercises.map((exercise) => {
    const trackingType = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType;
    const previousSets = latestSetsForExercise(exercise, priorHistory);
    if (!previousSets) return exercise;
    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => {
        const previousSet = previousSets[index];
        if (!previousSet) return set;
        const values = trackingFields[trackingType ?? 'weight-reps']
          .map((kind) => measurementText(previousSet, kind))
          .filter(Boolean);
        return values.length ? { ...set, previous: values.join(' × ') } : set;
      }),
    };
  });
}

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
  const history = completedWorkouts
    .filter((workout) => workout.completedAt !== null && !workout.excludeFromTargets)
    .sort((left, right) => completedAt(right) - completedAt(left));
  if (!history.length) return routine.exercises;

  return routine.exercises.map((exercise) => {
    const trackingType = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType;
    // Match by the movement itself, not by which routine authored the session,
    // so "previous" reflects the last time this exercise was actually done —
    // including workouts imported from JSON or logged under another routine.
    const previousSets = latestSetsForExercise(exercise, history);
    if (!previousSets) return exercise;
    return {
      ...exercise,
      sets: (exercise.sets ?? []).map((set, index) =>
        withPreviousSessionData(
          withNextSessionTargets(set, previousSets[index], trackingType),
          previousSets[index],
          trackingType,
        ),
      ),
    };
  });
}

function latestSetsForExercise(
  exercise: WorkoutExerciseInput,
  workoutsNewestFirst: readonly Workout[],
): WorkoutSet[] | undefined {
  for (const workout of workoutsNewestFirst) {
    const match = workout.exercises.find((candidate) =>
      (exercise.exerciseId && candidate.exerciseId === exercise.exerciseId)
      || sameExerciseName(candidate.name, exercise.name),
    );
    if (match) return match.sets;
  }
  return undefined;
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
