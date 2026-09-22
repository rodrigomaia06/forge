import type { ExerciseCatalogItem } from './exerciseCatalog';
import { exerciseCatalog } from './exerciseCatalog';
import { bundledLegacyIdMap } from './catalog/loadCatalog';
import { createExerciseSnapshot } from '../domain/exercises/exerciseSnapshot';
import type { Workout, WorkoutExercise, WorkoutExerciseInput, WorkoutRoutine } from '../types';

type ExerciseLike = WorkoutExercise | WorkoutExerciseInput;
type ExerciseRecord = Record<string, unknown> & {
  id?: unknown;
  exerciseId?: unknown;
  name?: unknown;
  trackingType?: unknown;
  exerciseSnapshot?: unknown;
};

/**
 * Approved identifiers from the pre-v3 Forge catalogue. These are a curated
 * compatibility table, never a similarity search: unknown custom ids and
 * names therefore remain user-owned data.
 */
const approvedLegacyExerciseIds: Readonly<Record<string, string>> = {
  'bench-press': 'barbell-bench-press',
  'bench-press-dumbbell': 'dumbbell-bench-press',
  'biceps-curl-with-dumbbell': 'dumbbell-curl',
  'biceps-hammer-curl-with-dumbbell': 'dumbbell-hammer-curl',
  'butterfly-machine': 'pec-deck',
  'cable-crossover': 'cable-chest-fly',
  'chin-ups': 'chin-up',
  'close-grip-barbell-bench-press': 'close-grip-bench-press',
  'dumbbell-flyes': 'dumbbell-chest-fly',
  'front-cable-raises': 'cable-front-raise',
  'front-dumbbell-raises': 'dumbbell-front-raise',
  'hack-squat-machine': 'machine-hack-squat',
  'incline-bench-press': 'incline-barbell-bench-press',
  'incline-dumbbell-flyes': 'incline-dumbbell-chest-fly',
  'machine-bench-press': 'machine-chest-press',
  'overhead-press': 'barbell-overhead-press',
  'pull-ups': 'pull-up',
  'push-ups': 'push-up',
  'rear-deltoid-row-dumbbell': 'dumbbell-row',
  'seated-cable-row': 'seated-cable-row',
  'seated-overhead-press': 'seated-barbell-overhead-press',
  'seated-shoulder-press-machine': 'machine-shoulder-press',
  'shoulder-shrugs': 'dumbbell-shrug',
  'smith-machine-bench-press': 'smith-machine-bench-press',
  't-bar-rows': 't-bar-row',
  'triceps-kickback-with-dumbbell': 'dumbbell-kickback',
  'triceps-pushdown-with-cable': 'cable-triceps-pushdown',
  'triceps-pushdown-with-rope-and-cable': 'rope-triceps-pushdown',
  'wide-grip-lat-pull-down': 'wide-grip-lat-pulldown',
};

/** Confirmed legacy display aliases whose historic id was absent or unstable. */
const approvedLegacyExerciseAliases: Readonly<Record<string, string>> = {
  'biceps curl dumbbell hammer': 'dumbbell-hammer-curl',
  'chest press machine': 'machine-chest-press',
  'chest press machine incline': 'incline-machine-chest-press',
  'flyes machine': 'pec-deck',
  'pec deck fly': 'pec-deck',
};

function identity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const byId = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]));
const uniqueAliases = new Map<string, ExerciseCatalogItem>();
const ambiguousAliases = new Set<string>();
for (const exercise of exerciseCatalog) {
  for (const alias of [exercise.name, ...exercise.aliases]) {
    const key = identity(alias);
    const existing = uniqueAliases.get(key);
    if (existing && existing.id !== exercise.id) {
      uniqueAliases.delete(key);
      ambiguousAliases.add(key);
    } else if (!ambiguousAliases.has(key)) uniqueAliases.set(key, exercise);
  }
}

/** The same words in any order (e.g. legacy "Lateral Raise: Cable"). */
function tokenSetKey(value: string): string {
  return identity(value).split(' ').filter(Boolean).sort().join(' ');
}
const uniqueNameTokenSets = new Map<string, ExerciseCatalogItem>();
const ambiguousNameTokenSets = new Set<string>();
for (const exercise of exerciseCatalog) {
  const key = tokenSetKey(exercise.name);
  if (!key) continue;
  const existing = uniqueNameTokenSets.get(key);
  if (existing && existing.id !== exercise.id) {
    uniqueNameTokenSets.delete(key);
    ambiguousNameTokenSets.add(key);
  } else if (!ambiguousNameTokenSets.has(key)) uniqueNameTokenSets.set(key, exercise);
}

/**
 * Matches a display name that is exactly one catalogue name's words reordered
 * (Forge's older imports stored "Base: Equipment (Variation)"). This is exact
 * set equality, never a similarity search, so a unique reorder resolves while
 * any extra or missing word — or a genuine custom name — stays user-owned.
 */
function resolveByExactNameTokens(value: unknown): ExerciseCatalogItem | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return uniqueNameTokenSets.get(tokenSetKey(value));
}

/** Resolves only v3 ids, audited old ids, and unambiguous confirmed aliases. */
export function resolveCanonicalExercise(value: string | undefined): ExerciseCatalogItem | undefined {
  if (!value?.trim()) return undefined;
  const direct = byId.get(value);
  if (direct) return direct;
  const legacyId = approvedLegacyExerciseIds[value] ?? bundledLegacyIdMap[value as keyof typeof bundledLegacyIdMap];
  if (legacyId) return byId.get(legacyId);
  const aliasId = approvedLegacyExerciseAliases[identity(value)];
  if (aliasId) return byId.get(aliasId);
  return uniqueAliases.get(identity(value));
}

function resolveApprovedLegacyAlias(value: unknown): ExerciseCatalogItem | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const id = approvedLegacyExerciseAliases[identity(value)];
  return id ? byId.get(id) : undefined;
}

function preferredCanonicalExercise(exercise: ExerciseRecord): ExerciseCatalogItem | undefined {
  // Ids are stronger evidence than display copy. If no id survives, only an
  // explicitly registered, unique alias may identify an old record.
  const snapshot = exercise.exerciseSnapshot && typeof exercise.exerciseSnapshot === 'object'
    ? exercise.exerciseSnapshot as { id?: unknown; name?: unknown }
    : undefined;
  const storedName = typeof exercise.name === 'string' ? exercise.name : undefined;
  const snapshotName = typeof snapshot?.name === 'string' ? snapshot.name : undefined;
  const instanceIdCandidate = resolveCanonicalExercise(typeof exercise.id === 'string' ? exercise.id : undefined);
  // Some earliest exports stored the catalogue slug in `id`. It is safe to
  // honour only when the saved display name independently matches that same
  // canonical record, so a custom exercise instance is never claimed by id.
  if (instanceIdCandidate && [storedName, snapshotName].some((name) => name && identity(name) === identity(instanceIdCandidate.name))) {
    return instanceIdCandidate;
  }
  const byIdOrAlias = resolveCanonicalExercise(typeof exercise.exerciseId === 'string' ? exercise.exerciseId : undefined)
    ?? resolveCanonicalExercise(typeof snapshot?.id === 'string' ? snapshot.id : undefined)
    ?? resolveApprovedLegacyAlias(storedName)
    ?? resolveApprovedLegacyAlias(snapshotName);
  if (byIdOrAlias) return byIdOrAlias;
  // Only a record that carries no identifier at all may be matched by name.
  // A present id — even an unrecognised custom one — is respected, so a custom
  // exercise named like a catalogue one is never claimed.
  const hasIdClaim = Boolean(
    (typeof exercise.exerciseId === 'string' && exercise.exerciseId.trim())
    || (typeof snapshot?.id === 'string' && snapshot.id.trim()),
  );
  if (hasIdClaim) return undefined;
  // A pure legacy record whose name is exactly a catalogue name reordered
  // (e.g. imported "Lateral Raise: Cable" -> "Cable Lateral Raise").
  return resolveByExactNameTokens(storedName) ?? resolveByExactNameTokens(snapshotName);
}

/** Replaces catalogue-owned identity while preserving all set/order/user fields. */
export function canonicalizeExercise<T extends ExerciseLike>(exercise: T): T {
  return canonicalizeExerciseRecord(exercise);
}

/** Runtime-safe form for SQLite and JSON records before their schema is trusted. */
export function canonicalizeExerciseRecord<T extends object>(exercise: T): T {
  const record = exercise as ExerciseRecord;
  const canonical = preferredCanonicalExercise(record);
  if (!canonical) return exercise;
  return {
    ...record,
    exerciseId: canonical.id,
    name: canonical.name,
    trackingType: canonical.trackingType,
    exerciseSnapshot: createExerciseSnapshot(canonical),
  } as T;
}

export function canonicalizeRoutine(routine: WorkoutRoutine): WorkoutRoutine {
  return {
    ...routine,
    exercises: Array.isArray(routine.exercises) ? routine.exercises.map(canonicalizeExercise) : [],
  };
}

export function canonicalizeWorkout(workout: Workout): Workout {
  return {
    ...workout,
    exercises: Array.isArray(workout.exercises) ? workout.exercises.map(canonicalizeExercise) : [],
  };
}

export function canonicalizePlansState<T extends { plans: unknown; standaloneRoutines: unknown }>(state: T): T {
  const plans = Array.isArray(state.plans)
    ? state.plans.map((plan) => {
      if (!plan || typeof plan !== 'object') return plan;
      const value = plan as { routines?: WorkoutRoutine[] };
      return { ...value, routines: Array.isArray(value.routines) ? value.routines.map(canonicalizeRoutine) : [] };
    })
    : [];
  return {
    ...state,
    plans,
    standaloneRoutines: Array.isArray(state.standaloneRoutines)
      ? state.standaloneRoutines.map(canonicalizeRoutine)
      : [],
  } as T;
}

export function canonicalizeWorkoutState<T extends { activeWorkout: Workout | null; completedWorkouts: Workout[] }>(state: T): T {
  return {
    ...state,
    activeWorkout: state.activeWorkout ? canonicalizeWorkout(state.activeWorkout) : null,
    completedWorkouts: Array.isArray(state.completedWorkouts)
      ? state.completedWorkouts.map(canonicalizeWorkout)
      : [],
  };
}

export const auditedLegacyExerciseIdMap = approvedLegacyExerciseIds;
