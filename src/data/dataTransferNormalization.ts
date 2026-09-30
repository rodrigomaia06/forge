import { uniqueById } from './uniqueById';
import { canonicalizeExerciseRecord } from './exerciseCanonicalization';
import type { DailyMeasurementDefinition, DailyMeasurementEntry } from '../types';

/**
 * Merges imported daily-measurement definitions and entries into the current
 * ones without producing duplicates across devices: definitions reconcile by
 * normalized name (so two independently-created "Weight" metrics collapse), and
 * entries reconcile by (definition, date) after remapping to the surviving
 * definition id. Existing records always win, matching the rest of import.
 */
export function reconcileMeasurements(
  currentDefinitions: readonly DailyMeasurementDefinition[],
  currentEntries: readonly DailyMeasurementEntry[],
  incomingDefinitions: readonly DailyMeasurementDefinition[],
  incomingEntries: readonly DailyMeasurementEntry[],
): { definitions: DailyMeasurementDefinition[]; entries: DailyMeasurementEntry[] } {
  const normalizeName = (name: string): string => name.trim().toLocaleLowerCase();
  const definitions = [...currentDefinitions];
  const currentIds = new Set(definitions.map((definition) => definition.id));
  const idByName = new Map(definitions.map((definition) => [normalizeName(definition.name), definition.id]));
  const idRemap = new Map<string, string>();
  for (const incoming of incomingDefinitions) {
    if (currentIds.has(incoming.id)) continue; // same id already on device — existing wins
    const existingId = idByName.get(normalizeName(incoming.name));
    if (existingId) {
      idRemap.set(incoming.id, existingId); // same metric under a different id
      continue;
    }
    definitions.push(incoming);
    currentIds.add(incoming.id);
    idByName.set(normalizeName(incoming.name), incoming.id);
  }
  const entries = [...currentEntries];
  const entryIds = new Set(entries.map((entry) => entry.id));
  const dateKeys = new Set(entries.map((entry) => `${entry.definitionId}\u0000${entry.date}`));
  for (const incoming of incomingEntries) {
    if (entryIds.has(incoming.id)) continue;
    const definitionId = idRemap.get(incoming.definitionId) ?? incoming.definitionId;
    const key = `${definitionId}\u0000${incoming.date}`;
    if (dateKeys.has(key)) continue; // one value per definition per day — existing wins
    entries.push({ ...incoming, definitionId });
    entryIds.add(incoming.id);
    dateKeys.add(key);
  }
  return { definitions, entries };
}

type TransferRecord = Record<string, unknown>;

function isObject(value: unknown): value is TransferRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** UUIDs let a hand-authored import become durable without a central service. */
export function createImportId(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assignId<T extends TransferRecord>(item: T): T & { id: string } {
  return {
    ...item,
    id: typeof item.id === 'string' && item.id.trim() ? item.id : createImportId(),
  };
}

/**
 * The previous Forge exporter described every strength exercise as reps-only,
 * even when its legacy snapshot named an externally loaded implement. Those
 * snapshots have no catalogue version, so leave current Forge records and
 * explicit custom tracking choices untouched.
 */
function isLegacyExternalLoadExercise(exercise: TransferRecord): boolean {
  const snapshot = exercise.exerciseSnapshot;
  if (
    !isObject(snapshot)
    || exercise.trackingType !== 'reps-only'
    || snapshot.trackingType !== 'reps-only'
    || snapshot.catalogueVersion !== undefined
  ) return false;
  const equipment = [snapshot.primaryEquipment, ...(Array.isArray(snapshot.equipment) ? snapshot.equipment : [])];
  return equipment.some((item) => typeof item === 'string' && /(^|[\s:-])(barbell|dumbbell|kettlebell|cable|machine|smith|plate|resistance band)(?=$|[\s:-])/i.test(item));
}

function normalizeLegacyTracking<T extends TransferRecord>(exercise: T): T {
  if (!isLegacyExternalLoadExercise(exercise)) return exercise;
  const snapshot = exercise.exerciseSnapshot as TransferRecord;
  return {
    ...exercise,
    trackingType: 'weight-reps',
    exerciseSnapshot: { ...snapshot, trackingType: 'weight-reps' },
  } as T;
}

/**
 * Keeps a valid JSON transfer structurally safe before either persistence
 * repository consumes it. Array transformations deliberately preserve source
 * order; duplicate ids retain their first source record.
 */
export function normalizeDataTransfer<T>(transfer: T): T {
  const value = transfer as TransferRecord;
  const settings = value.settings as TransferRecord;
  const transferPlans = value.plans as TransferRecord;
  const workouts = value.workouts as TransferRecord;
  const records = <U extends TransferRecord>(items: unknown): Array<U & { id: string }> =>
    Array.isArray(items) ? items.filter(isObject).map((item) => assignId(item as U)) : [];
  const normalizeExercise = (exercise: TransferRecord): TransferRecord & { id: string } => {
    const normalized = canonicalizeExerciseRecord(normalizeLegacyTracking(assignId(exercise)));
    return {
      ...normalized,
      sets: uniqueById(records<TransferRecord>(normalized.sets)),
    };
  };
  const normalizeWorkout = <U extends TransferRecord>(workout: U): U & { id: string } => ({
    ...assignId(workout),
    exercises: uniqueById(records<TransferRecord>(workout.exercises).map(normalizeExercise)),
  });
  const normalizeRoutine = <U extends TransferRecord>(routine: U): U & { id: string } => ({
    ...assignId(routine),
    exercises: uniqueById(records<TransferRecord>(routine.exercises).map(normalizeExercise)),
  });
  const plans = records<TransferRecord>(transferPlans.plans).map((plan) => ({
    ...plan,
    routines: uniqueById(
      records<TransferRecord>(plan.routines).map((routine) => ({
        ...normalizeRoutine(routine),
        planId: plan.id,
      })),
    ),
  }));
  const planRoutineIds = new Set(
    plans.flatMap((plan) => plan.routines.map((routine) => routine.id)),
  );
  const completed = uniqueById(
    records<TransferRecord>(workouts.completedWorkouts).map(normalizeWorkout),
  );
  const activeCandidate = isObject(workouts.activeWorkout)
    ? normalizeWorkout(workouts.activeWorkout)
    : null;
  const active =
    activeCandidate && !completed.some((workout) => workout.id === activeCandidate.id)
      ? activeCandidate
      : null;

  return {
    ...value,
    settings: {
      ...settings,
      workoutTypes: uniqueById(records<TransferRecord>(settings.workoutTypes)),
      dailyMeasurementDefinitions: uniqueById(
        records<TransferRecord>(settings.dailyMeasurementDefinitions),
      ),
      dailyMeasurementEntries: uniqueById(
        records<TransferRecord>(settings.dailyMeasurementEntries),
      ),
    },
    plans: {
      plans,
      standaloneRoutines: uniqueById(
        records<TransferRecord>(transferPlans.standaloneRoutines).map(normalizeRoutine),
      ).filter((routine) => !planRoutineIds.has(routine.id)),
    },
    workouts: { activeWorkout: active, completedWorkouts: completed },
    customExercises: uniqueById(records<TransferRecord>(value.customExercises)),
  } as T;
}
