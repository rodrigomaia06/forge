import type { PlansState, Workout, WorkoutPlan, WorkoutRoutine } from '../types';
import type { WorkoutExerciseInput } from '../types';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import type { ForgeDataTransfer, ShareKind } from './transferFormat';
import { contentSignature } from './importMatch';
import { normalizeName } from './dataTransferPlans';

export type ShareChangeType = 'added' | 'removed' | 'changed';
/** Which section a change unit belongs to: a scalar field or a child record. */
export type ShareChangeGroup = 'field' | 'child';

/**
 * One individually-toggleable "change unit". `type` drives the +/−/~ marker and
 * colour; `detail` carries the before→after (scalar) or count change (child).
 * Each unit carries a stable `id` and everything `applyShareUpdate` needs to
 * apply it on its own, so the review can include/exclude changes one by one.
 */
export type ShareChange = {
  /** Stable, deterministic id used by the review's checkboxes and by apply. */
  id: string;
  label: string;
  type: ShareChangeType;
  detail?: string;
  group: ShareChangeGroup;
  /** Field unit: the target property key and the incoming value to assign (empty/undefined clears). */
  field?: { key: string; value: unknown };
  /** Child unit: the on-device match name and the incoming child to add/replace (absent for a removal). */
  child?: { name: string; incoming?: unknown };
  /** A child's own workout type (routines), for the per-kind leading icon. */
  childType?: string;
};

/**
 * A shared single item whose name already exists on device but whose content
 * differs — i.e. an *update* of an item the recipient already has, not an
 * identical re-import (skipped) and not a brand-new item. Drives the
 * per-change selective merge (Update) plus Keep both / Skip in the import review.
 */
export type ShareConflict = {
  kind: ShareKind;
  /** The incoming item's display name. */
  name: string;
  /** Id of the matched on-device item, so an Update can replace it in place. */
  existingId: string;
  /** The incoming item's workout type (routine/workout), for the lead icon. */
  type?: string;
  /** One-line rollup, e.g. "2 exercises changed · 1 added". */
  summary: string;
  changes: ShareChange[];
};

export type ShareCurrentState = {
  plans: PlansState;
  workouts: readonly Workout[];
  exercises: readonly ExerciseCatalogItem[];
};

/**
 * The user's decision for a shared single-item conflict. `'update'` replaces the
 * whole item (every change applied); the object form applies only the checked
 * change units. `'keepBoth'` imports the incoming as a numbered copy, `'skip'`
 * imports nothing.
 */
export type ShareResolution =
  | 'update'
  | 'keepBoth'
  | 'skip'
  | { kind: 'update'; selectedIds: readonly string[] };
/** The applied decision, for the post-import summary. */
export type ShareResolutionResult = { action: 'updated' | 'keptBoth' | 'skipped'; name: string };

/** True when a resolution replaces the on-device item in place (whole or selective). */
export function isUpdateResolution(
  resolution: ShareResolution | undefined,
): resolution is 'update' | { kind: 'update'; selectedIds: readonly string[] } {
  return resolution === 'update' || (typeof resolution === 'object' && resolution?.kind === 'update');
}

/** Translate a resolved conflict into the reportable action, or undefined when none applied. */
export function shareResolutionResult(
  conflict: ShareConflict | null,
  resolution: ShareResolution | undefined,
): ShareResolutionResult | undefined {
  if (!conflict || !resolution) return undefined;
  const action = isUpdateResolution(resolution)
    ? 'updated'
    : resolution === 'skip'
      ? 'skipped'
      : 'keptBoth';
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

type FieldSpec = { label: string; key: string; before: unknown; after: unknown; value?: unknown };

/** before→after for a scalar field, or an added/removed marker when one side is empty. */
function fieldUnit(spec: FieldSpec): ShareChange | null {
  const b = text(spec.before);
  const a = text(spec.after);
  if (b === a) return null;
  const type: ShareChangeType = !b ? 'added' : !a ? 'removed' : 'changed';
  const detail = type === 'added' ? a : type === 'removed' ? b : `${b} → ${a}`;
  const value = 'value' in spec ? spec.value : spec.after;
  return { id: `field:${spec.key}`, label: spec.label, type, detail, group: 'field', field: { key: spec.key, value } };
}

function scalarChanges(specs: FieldSpec[]): ShareChange[] {
  return specs.map(fieldUnit).filter((change): change is ShareChange => change !== null);
}

type Child = { name: string; signature: string; count: number; raw: unknown; type?: string };

/**
 * Compare two child collections by name: entries only in the incoming set are
 * added, entries only on device are removed, and matched entries whose content
 * signature differs are changed (with a set/exercise count before→after when the
 * counts differ). Each unit carries the incoming child object so an "Update" can
 * apply that single change. Deliberately not a word-level text diff.
 */
function childChanges(incoming: readonly Child[], existing: readonly Child[], unit: string): ShareChange[] {
  const existingByName = new Map(existing.map((item) => [normalizeName(item.name), item]));
  const incomingNames = new Set(incoming.map((item) => normalizeName(item.name)));
  const changes: ShareChange[] = [];
  for (const item of incoming) {
    const key = normalizeName(item.name);
    const match = existingByName.get(key);
    if (!match) {
      changes.push({
        id: `child:added:${key}`,
        label: item.name,
        type: 'added',
        group: 'child',
        child: { name: item.name, incoming: item.raw },
        childType: item.type,
      });
      continue;
    }
    if (match.signature !== item.signature) {
      const detail =
        match.count !== item.count
          ? `${match.count} → ${item.count} ${unit}${item.count === 1 ? '' : 's'}`
          : 'edited';
      changes.push({
        id: `child:changed:${key}`,
        label: item.name,
        type: 'changed',
        detail,
        group: 'child',
        child: { name: item.name, incoming: item.raw },
        childType: item.type,
      });
    }
  }
  for (const item of existing) {
    const key = normalizeName(item.name);
    if (!incomingNames.has(key))
      changes.push({
        id: `child:removed:${key}`,
        label: item.name,
        type: 'removed',
        group: 'child',
        child: { name: item.name },
        childType: item.type,
      });
  }
  return changes;
}

const exerciseChild = (exercise: WorkoutExerciseInput | Workout['exercises'][number]): Child => ({
  name: exercise.name,
  signature: contentSignature(exercise),
  count: exercise.sets?.length ?? 0,
  raw: exercise,
});
const routineChild = (routine: WorkoutRoutine): Child => ({
  name: routine.name,
  signature: contentSignature(routine),
  count: routine.exercises?.length ?? 0,
  raw: routine,
  type: routine.type,
});

/** One-line rollup, child changes first (the common case), scalar-only otherwise. */
function rollup(childNoun: string | null, fieldChanges: ShareChange[], children: ShareChange[]): string {
  const segments: string[] = [];
  if (childNoun && children.length) {
    const count = (type: ShareChangeType) => children.filter((change) => change.type === type).length;
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
    diff: (incomingItem: T, existingItem: T) => {
      fields: ShareChange[];
      children: ShareChange[];
      childNoun: string | null;
      type?: string;
    },
  ): ShareConflict | null => {
    if (!item) return null;
    const match = candidates.find((candidate) => normalizeName(candidate.name) === normalizeName(item.name));
    if (!match) return null; // new item, not a conflict
    if (contentSignature(item) === contentSignature(match)) return null; // identical, skipped upstream
    const { fields, children, childNoun, type } = diff(item, match);
    return {
      kind,
      name: item.name,
      existingId: match.id,
      type,
      summary: rollup(childNoun, fields, children),
      changes: [...fields, ...children],
    };
  };

  switch (kind) {
    case 'routine':
      return build(firstRoutine(incoming.plans), allRoutines(current.plans), (incomingItem, existingItem) => ({
        fields: scalarChanges([
          { label: 'Name', key: 'name', before: existingItem.name, after: incomingItem.name },
          { label: 'Type', key: 'type', before: existingItem.type, after: incomingItem.type },
          { label: 'Note', key: 'note', before: existingItem.note, after: incomingItem.note },
        ]),
        children: childChanges(
          (incomingItem.exercises ?? []).map(exerciseChild),
          (existingItem.exercises ?? []).map(exerciseChild),
          'set',
        ),
        childNoun: 'exercise',
        type: incomingItem.type,
      }));
    case 'plan':
      return build(incoming.plans.plans[0], current.plans.plans, (incomingItem, existingItem) => ({
        fields: scalarChanges([
          { label: 'Name', key: 'name', before: existingItem.name, after: incomingItem.name },
          { label: 'Description', key: 'description', before: existingItem.description, after: incomingItem.description },
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
          { label: 'Name', key: 'name', before: existingItem.name, after: incomingItem.name },
          { label: 'Type', key: 'type', before: existingItem.type, after: incomingItem.type },
          { label: 'Note', key: 'note', before: existingItem.note, after: incomingItem.note },
        ]),
        children: childChanges(
          (incomingItem.exercises ?? []).map(exerciseChild),
          (existingItem.exercises ?? []).map(exerciseChild),
          'set',
        ),
        childNoun: 'exercise',
        type: incomingItem.type,
      }));
    case 'exercise':
      return build(incoming.customExercises[0], current.exercises, (incomingItem, existingItem) => ({
        fields: scalarChanges([
          { label: 'Name', key: 'name', before: existingItem.name, after: incomingItem.name },
          { label: 'Muscle', key: 'primaryMuscle', before: existingItem.primaryMuscle, after: incomingItem.primaryMuscle },
          { label: 'Equipment', key: 'equipment', before: existingItem.equipment, after: incomingItem.equipment },
          { label: 'Category', key: 'category', before: existingItem.category, after: incomingItem.category },
          {
            label: 'Rest',
            key: 'restSeconds',
            before: restLabel(existingItem.restSeconds),
            after: restLabel(incomingItem.restSeconds),
            value: incomingItem.restSeconds,
          },
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

const CHILD_KEY: Record<ShareKind, 'routines' | 'exercises' | null> = {
  plan: 'routines',
  routine: 'exercises',
  workout: 'exercises',
  exercise: null,
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Merge a conflict onto the existing on-device item by applying only the checked
 * change units. Starts from a deep clone of `existing` (so its id / planId /
 * position / timestamps are preserved by the caller writing it back in place),
 * then, for each selected unit: sets a scalar field, appends an added child,
 * replaces a changed child (matched by normalized name), or drops a removed one.
 * Nothing new is introduced beyond checked "added" children. Pure.
 */
export function applyShareUpdate<T>(
  existing: T,
  conflict: ShareConflict,
  selectedIds: ReadonlySet<string> | readonly string[],
): T {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds as readonly string[]);
  const clone = deepClone(existing) as Record<string, unknown>;
  const childKey = CHILD_KEY[conflict.kind];
  for (const unit of conflict.changes) {
    if (!selected.has(unit.id)) continue;
    if (unit.group === 'field' && unit.field) {
      clone[unit.field.key] = unit.field.value;
      continue;
    }
    if (unit.group === 'child' && childKey && unit.child) {
      const list = Array.isArray(clone[childKey]) ? (clone[childKey] as { name: string }[]) : [];
      const target = normalizeName(unit.child.name);
      if (unit.type === 'removed') {
        clone[childKey] = list.filter((child) => normalizeName(child.name) !== target);
      } else if (unit.type === 'added') {
        clone[childKey] = [...list, deepClone(unit.child.incoming)];
      } else {
        clone[childKey] = list.map((child) =>
          normalizeName(child.name) === target ? deepClone(unit.child!.incoming) : child,
        );
      }
    }
  }
  return clone as T;
}

/** Locate the matched on-device item a conflict refers to, so it can be cloned and merged. */
export function findShareUpdateTarget(
  conflict: ShareConflict,
  current: ShareCurrentState,
): WorkoutRoutine | WorkoutPlan | Workout | ExerciseCatalogItem | undefined {
  switch (conflict.kind) {
    case 'routine':
      return allRoutines(current.plans).find((routine) => routine.id === conflict.existingId);
    case 'plan':
      return current.plans.plans.find((plan) => plan.id === conflict.existingId);
    case 'workout':
      return current.workouts.find((workout) => workout.id === conflict.existingId);
    case 'exercise':
      return current.exercises.find((exercise) => exercise.id === conflict.existingId);
    default:
      return undefined;
  }
}

/** Replace the one shared item inside a transfer with a merged version, keeping its slot. */
export function withSharedItemReplaced(
  incoming: ForgeDataTransfer,
  kind: ShareKind,
  merged: unknown,
): ForgeDataTransfer {
  switch (kind) {
    case 'routine': {
      if (incoming.plans.standaloneRoutines.length > 0) {
        const [, ...rest] = incoming.plans.standaloneRoutines;
        return { ...incoming, plans: { ...incoming.plans, standaloneRoutines: [merged as WorkoutRoutine, ...rest] } };
      }
      let replaced = false;
      const plans = incoming.plans.plans.map((plan) => {
        if (replaced || plan.routines.length === 0) return plan;
        replaced = true;
        const [, ...rest] = plan.routines;
        return { ...plan, routines: [merged as WorkoutRoutine, ...rest] };
      });
      return { ...incoming, plans: { ...incoming.plans, plans } };
    }
    case 'plan': {
      const [, ...rest] = incoming.plans.plans;
      return { ...incoming, plans: { ...incoming.plans, plans: [merged as WorkoutPlan, ...rest] } };
    }
    case 'workout': {
      const [, ...rest] = incoming.workouts.completedWorkouts;
      return {
        ...incoming,
        workouts: { ...incoming.workouts, completedWorkouts: [merged as Workout, ...rest] },
      };
    }
    case 'exercise': {
      const [, ...rest] = incoming.customExercises;
      return { ...incoming, customExercises: [merged as ExerciseCatalogItem, ...rest] };
    }
    default:
      return incoming;
  }
}

/**
 * Thread a selective "Update" through a transfer: clone the matched on-device
 * item, apply the checked change units, and swap the merged result into the
 * transfer's shared-item slot. The whole-item update path then replaces the
 * on-device record in place with this merged content, keeping its id.
 */
export function applySelectiveShareUpdate(
  incoming: ForgeDataTransfer,
  conflict: ShareConflict,
  selectedIds: readonly string[],
  current: ShareCurrentState,
): ForgeDataTransfer {
  const target = findShareUpdateTarget(conflict, current);
  if (!target) return incoming;
  const merged = applyShareUpdate(target, conflict, selectedIds);
  return withSharedItemReplaced(incoming, conflict.kind, merged);
}
