import type { PlansState, Workout, WorkoutPlan, WorkoutRoutine } from '../types';
import type { WorkoutExerciseInput } from '../types';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import type { ForgeDataTransfer, ShareKind } from './transferFormat';
import { contentSignature } from './importMatch';
import { normalizeName } from './dataTransferPlans';

/**
 * A single line in the "what changed" list. `type` drives the +/−/~ marker and
 * colour; `detail` carries the before→after (scalar) or count change (child).
 */
export type ShareChange = { label: string; type: 'added' | 'removed' | 'changed'; detail?: string };

/**
 * A shared single item whose name already exists on device but whose content
 * differs — i.e. an *update* of an item the recipient already has, not an
 * identical re-import (skipped) and not a brand-new item. Drives the
 * Update / Keep both / Skip decision in the import review.
 */
export type ShareConflict = {
  kind: ShareKind;
  /** The incoming item's display name. */
  name: string;
  /** Id of the matched on-device item, so an Update can replace it in place. */
  existingId: string;
  /** One-line rollup, e.g. "2 exercises changed · 1 added". */
  summary: string;
  changes: ShareChange[];
};

export type ShareCurrentState = {
  plans: PlansState;
  workouts: readonly Workout[];
  exercises: readonly ExerciseCatalogItem[];
};

/** The user's decision for a shared single-item conflict. */
export type ShareResolution = 'update' | 'keepBoth' | 'skip';
/** The applied decision, for the post-import summary. */
export type ShareResolutionResult = { action: 'updated' | 'keptBoth' | 'skipped'; name: string };

/** Translate a resolved conflict into the reportable action, or undefined when none applied. */
export function shareResolutionResult(
  conflict: ShareConflict | null,
  resolution: ShareResolution | undefined,
): ShareResolutionResult | undefined {
  if (!conflict || !resolution) return undefined;
  const action = resolution === 'update' ? 'updated' : resolution === 'skip' ? 'skipped' : 'keptBoth';
  return { action, name: conflict.name };
}

/** Empty the one category a single-item share carries, so a 'skip' imports nothing. */
export function dropSharedItem(incoming: ForgeDataTransfer, kind: ShareKind): ForgeDataTransfer {
  switch (kind) {
    case 'routine':
    case 'plan':
      return { ...incoming, plans: { plans: [], standaloneRoutines: [] } };
    case 'workout':
      return { ...incoming, workouts: { ...incoming.workouts, completedWorkouts: [] } };
    case 'exercise':
      return { ...incoming, customExercises: [] };
    default:
      return incoming;
  }
}

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

/** before→after for a scalar field, or an added/removed marker when one side is empty. */
function fieldChange(label: string, before: unknown, after: unknown): ShareChange | null {
  const b = text(before);
  const a = text(after);
  if (b === a) return null;
  if (!b) return { label, type: 'added', detail: a };
  if (!a) return { label, type: 'removed', detail: b };
  return { label, type: 'changed', detail: `${b} → ${a}` };
}

function scalarChanges(fields: ReadonlyArray<[string, unknown, unknown]>): ShareChange[] {
  return fields
    .map(([label, before, after]) => fieldChange(label, before, after))
    .filter((change): change is ShareChange => change !== null);
}

type Child = { name: string; signature: string; count: number };

/**
 * Compare two child collections by name: entries only in the incoming set are
 * added, entries only on device are removed, and matched entries whose content
 * signature differs are changed (with a set/exercise count before→after when the
 * counts differ). Deliberately not a word-level text diff.
 */
function childChanges(incoming: readonly Child[], existing: readonly Child[], unit: string): ShareChange[] {
  const existingByName = new Map(existing.map((item) => [normalizeName(item.name), item]));
  const incomingNames = new Set(incoming.map((item) => normalizeName(item.name)));
  const changes: ShareChange[] = [];
  for (const item of incoming) {
    const match = existingByName.get(normalizeName(item.name));
    if (!match) {
      changes.push({ label: item.name, type: 'added' });
      continue;
    }
    if (match.signature !== item.signature) {
      const detail =
        match.count !== item.count
          ? `${match.count} → ${item.count} ${unit}${item.count === 1 ? '' : 's'}`
          : 'edited';
      changes.push({ label: item.name, type: 'changed', detail });
    }
  }
  for (const item of existing) {
    if (!incomingNames.has(normalizeName(item.name))) changes.push({ label: item.name, type: 'removed' });
  }
  return changes;
}

const exerciseChild = (exercise: WorkoutExerciseInput | Workout['exercises'][number]): Child => ({
  name: exercise.name,
  signature: contentSignature(exercise),
  count: exercise.sets?.length ?? 0,
});
const routineChild = (routine: WorkoutRoutine): Child => ({
  name: routine.name,
  signature: contentSignature(routine),
  count: routine.exercises?.length ?? 0,
});

/** One-line rollup, child changes first (the common case), scalar-only otherwise. */
function rollup(childNoun: string | null, fieldChanges: ShareChange[], children: ShareChange[]): string {
  const segments: string[] = [];
  if (childNoun && children.length) {
    const count = (type: ShareChange['type']) => children.filter((change) => change.type === type).length;
    let leading = true;
    const push = (n: number, verb: string): void => {
      if (!n) return;
      segments.push(leading ? `${n} ${n === 1 ? childNoun : `${childNoun}s`} ${verb}` : `${n} ${verb}`);
      leading = false;
    };
    push(count('changed'), 'changed');
    push(count('added'), 'added');
    push(count('removed'), 'removed');
  }
  if (!segments.length && fieldChanges.length) {
    const n = fieldChanges.length;
    segments.push(`${n} detail${n === 1 ? '' : 's'} changed`);
  }
  return segments.join(' · ') || 'Updated';
}

function firstRoutine(plans: PlansState): WorkoutRoutine | undefined {
  return [...plans.standaloneRoutines, ...plans.plans.flatMap((plan) => plan.routines)][0];
}
function allRoutines(plans: PlansState): WorkoutRoutine[] {
  return [...plans.standaloneRoutines, ...plans.plans.flatMap((plan) => plan.routines)];
}

/** null when the shared item is identical (would be skipped) or new; a conflict when same name + different content. */
function conflictFor(kind: ShareKind, incoming: ForgeDataTransfer, current: ShareCurrentState): ShareConflict | null {
  const build = <T extends { id: string; name: string }>(
    item: T | undefined,
    candidates: readonly T[],
    diff: (incomingItem: T, existingItem: T) => { fields: ShareChange[]; children: ShareChange[]; childNoun: string | null },
  ): ShareConflict | null => {
    if (!item) return null;
    const match = candidates.find((candidate) => normalizeName(candidate.name) === normalizeName(item.name));
    if (!match) return null; // new item, not a conflict
    if (contentSignature(item) === contentSignature(match)) return null; // identical, skipped upstream
    const { fields, children, childNoun } = diff(item, match);
    return {
      kind,
      name: item.name,
      existingId: match.id,
      summary: rollup(childNoun, fields, children),
      changes: [...fields, ...children],
    };
  };

  switch (kind) {
    case 'routine':
      return build(firstRoutine(incoming.plans), allRoutines(current.plans), (incomingItem, existingItem) => ({
        fields: scalarChanges([
          ['Name', existingItem.name, incomingItem.name],
          ['Type', existingItem.type, incomingItem.type],
          ['Note', existingItem.note, incomingItem.note],
        ]),
        children: childChanges(
          (incomingItem.exercises ?? []).map(exerciseChild),
          (existingItem.exercises ?? []).map(exerciseChild),
          'set',
        ),
        childNoun: 'exercise',
      }));
    case 'plan':
      return build(incoming.plans.plans[0], current.plans.plans, (incomingItem, existingItem) => ({
        fields: scalarChanges([
          ['Name', existingItem.name, incomingItem.name],
          ['Description', existingItem.description, incomingItem.description],
        ]),
        children: childChanges(
          (incomingItem.routines ?? []).map(routineChild),
          (existingItem.routines ?? []).map(routineChild),
          'exercise',
        ),
        childNoun: 'routine',
      }));
    case 'workout':
      return build(incoming.workouts.completedWorkouts[0], current.workouts, (incomingItem, existingItem) => ({
        fields: scalarChanges([
          ['Name', existingItem.name, incomingItem.name],
          ['Type', existingItem.type, incomingItem.type],
          ['Note', existingItem.note, incomingItem.note],
        ]),
        children: childChanges(
          (incomingItem.exercises ?? []).map(exerciseChild),
          (existingItem.exercises ?? []).map(exerciseChild),
          'set',
        ),
        childNoun: 'exercise',
      }));
    case 'exercise':
      return build(incoming.customExercises[0], current.exercises, (incomingItem, existingItem) => ({
        fields: scalarChanges([
          ['Name', existingItem.name, incomingItem.name],
          ['Muscle', existingItem.primaryMuscle, incomingItem.primaryMuscle],
          ['Equipment', existingItem.equipment, incomingItem.equipment],
          ['Category', existingItem.category, incomingItem.category],
          ['Rest', restLabel(existingItem.restSeconds), restLabel(incomingItem.restSeconds)],
        ]),
        children: [],
        childNoun: null,
      }));
    default:
      return null;
  }
}

function restLabel(seconds: number | undefined): string {
  return seconds === undefined ? '' : `${seconds}s`;
}

/**
 * Detect whether the incoming single-item share updates an item the device
 * already has (same name, different content). Returns null for a new item, an
 * identical re-import, or a multi-item / whole-data transfer.
 */
export function detectShareConflict(
  incoming: ForgeDataTransfer,
  current: ShareCurrentState,
): ShareConflict | null {
  const kind = incoming.share?.kind;
  if (!kind) return null;
  return conflictFor(kind, incoming, current);
}
