import { effectiveTracking } from '../exercises/tracking';
import { measurementDisplay, measurementText, trackingFields } from '../exercises/tracking';
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
    const trackingType = effectiveTracking(exercise);
    const previousSets = latestSetsForExercise(exercise, priorHistory, true, workout.exercises);
    if (!previousSets) return exercise;
    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => {
        const previousSet = previousSets[index];
        if (!previousSet) return set;
        const values = trackingFields[trackingType ?? 'weight-reps']
          .map((kind) => measurementDisplay(previousSet, kind))
          .filter(Boolean);
        return values.length ? { ...set, previous: values.join(' × ') } : set;
      }),
    };
  });
}

/**
 * Fills each set's `previous` for exercises just added to an in-progress workout,
 * derived from the most recent earlier session of the same movement (matched by
 * exercise id, name as a fallback) — so an ad-hoc add shows the same "previous"
 * a routine-started exercise would, including sessions logged under other routines.
 */
export function exercisesWithAddedPrevious(
  exercises: readonly WorkoutExercise[],
  completedWorkouts: readonly Workout[],
): WorkoutExercise[] {
  const history = completedWorkouts
    .filter((workout) => workout.completedAt !== null)
    .sort((left, right) => completedAt(right) - completedAt(left));
  if (!history.length) return exercises as WorkoutExercise[];
  return exercises.map((exercise) => {
    const trackingType = effectiveTracking(exercise);
    const previousSets = latestSetsForExercise(exercise, history, true, exercises);
    if (!previousSets) return exercise;
    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => {
        const previousSet = previousSets[index];
        if (!previousSet) return set;
        const values = trackingFields[trackingType ?? 'weight-reps']
          .map((kind) => measurementDisplay(previousSet, kind))
          .filter(Boolean);
        return values.length ? { ...set, previous: values.join(' × ') } : set;
      }),
    };
  });
}

/**
 * Fills `previous` only for the trailing `addedCount` exercises of a workout —
 * the ones just appended — leaving earlier exercises (and any values they
 * already captured) untouched. Shared by every add-exercise path so a removed
 * and re-added movement gets its last-session values back.
 */
export function withPreviousForAppended(
  exercises: readonly WorkoutExercise[],
  addedCount: number,
  completedWorkouts: readonly Workout[],
): WorkoutExercise[] {
  if (addedCount <= 0) return exercises as WorkoutExercise[];
  const head = exercises.slice(0, exercises.length - addedCount);
  const filled = exercisesWithAddedPrevious(exercises, completedWorkouts).slice(-addedCount);
  return [...head, ...filled];
}

/**
 * Recomputes `previous` for one exercise whose movement changed (Replace
 * exercise): the old movement's values are dropped, then refilled from the
 * replacement's own history. Other exercises are returned unchanged.
 */
export function withPreviousRefreshed(
  exercises: readonly WorkoutExercise[],
  exerciseId: string,
  completedWorkouts: readonly Workout[],
): WorkoutExercise[] {
  const cleared = exercises.map((exercise) => exercise.id === exerciseId
    ? { ...exercise, sets: exercise.sets.map(({ previous: _previous, ...set }) => set) }
    : exercise);
  const filled = exercisesWithAddedPrevious(cleared, completedWorkouts);
  return cleared.map((exercise, index) => (exercise.id === exerciseId ? filled[index] : exercises[index]));
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
    const trackingType = effectiveTracking(exercise);
    // Match by the movement itself, not by which routine authored the session,
    // so "previous" reflects the last time this exercise was actually done —
    // including workouts imported from JSON or logged under another routine.
    // The next-session target may progress from an off-session effort, but the
    // greyed "previous" placeholder must ignore off-session work — so the two
    // are sourced separately.
    const targetSets = latestSetsForExercise(exercise, history, false, routine.exercises);
    const previousSets = latestSetsForExercise(exercise, history, true, routine.exercises);
    if (!targetSets && !previousSets) return exercise;
    return {
      ...exercise,
      sets: (exercise.sets ?? []).map((set, index) =>
        withPreviousSessionData(
          withNextSessionTargets(set, targetSets?.[index], trackingType),
          previousSets?.[index],
          trackingType,
        ),
      ),
    };
  });
}

function latestSetsForExercise(
  exercise: WorkoutExerciseInput,
  workoutsNewestFirst: readonly Workout[],
  // Off-session exercises never seed the greyed "previous" placeholder, but may
  // still inform the next-session target — so the two lookups differ only here.
  skipOffSession: boolean,
  list: readonly WorkoutExerciseInput[],
): WorkoutSet[] | undefined {
  const ordinal = occurrence(list, exercise);
  for (const workout of workoutsNewestFirst) {
    const match = workout.exercises.filter((candidate) =>
        sameMovement(exercise, candidate)
      &&
        effectiveTracking(candidate) === effectiveTracking(exercise),
    )[ordinal];
    if (skipOffSession && match?.offSession) continue;
    if (match) return match.sets;
  }
  // The greyed "previous" placeholder falls back to the newest session of the
  // same movement logged under a different tracking mode (e.g. an older
  // weight + reps log of a now bodyweight exercise). Callers format only the
  // fields the current mode shares, so nothing foreign is shown. Next-session
  // targets (`skipOffSession === false`) never take this fallback.
  if (!skipOffSession) return undefined;
  // Position among every copy of the movement, regardless of mode, so a
  // second copy never borrows the first copy's history.
  const movementOrdinal = list.slice(0, list.indexOf(exercise)).filter((item) => sameMovement(item, exercise)).length;
  for (const workout of workoutsNewestFirst) {
    const match = workout.exercises.filter((candidate) => sameMovement(exercise, candidate))[movementOrdinal];
    if (match?.offSession) continue;
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
          .map((kind) => measurementDisplay(previousSet, kind))
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

function sameMovement(left: WorkoutExerciseInput, right: WorkoutExerciseInput): boolean {
  const leftId = left.exerciseId ?? left.exerciseSnapshot?.id;
  const rightId = right.exerciseId ?? right.exerciseSnapshot?.id;
  return leftId && rightId ? leftId === rightId : sameExerciseName(left.name, right.name);
}
function occurrence(list: readonly WorkoutExerciseInput[], exercise: WorkoutExerciseInput): number {
  const position = list.indexOf(exercise);
  return list
    .slice(0, position)
    .filter(
      (item) =>
        sameMovement(item, exercise) && effectiveTracking(item) === effectiveTracking(exercise),
    ).length;
}
