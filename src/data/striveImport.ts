import type { SetMeasurement, TrackingType, Workout, WorkoutExercise, WorkoutSet } from '../types';
import type { CsvDraft, CsvOptions } from './csvImport/types';
import { trackingFields } from '../domain/exercises/tracking';
import { csvId } from './csvImport/parse';

export type StriveRow = Record<string, unknown>;
export const striveTables = [
  'routine_logs',
  'routine_exercise_logs',
  'routine_exercise_set_logs',
  'exercises',
  'routine_notes',
  'routine_exercise_notes',
] as const;
export type StriveTable = (typeof striveTables)[number];
export interface StriveSnapshot {
  version: number;
  tables: Record<StriveTable, StriveRow[]>;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
function requiredText(value: unknown, field: string): string {
  if (!text(value).trim()) throw new Error(`${field} is missing.`);
  return text(value);
}
function number(value: unknown, field: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error(`${field} must be a non-negative number.`);
  return value;
}
function epoch(value: unknown, field: string): number {
  const seconds = number(value, field);
  if (seconds === undefined || !Number.isSafeInteger(seconds) || seconds * 1000 > 8640000000000000)
    throw new Error(`${field} is not a valid Unix-seconds date.`);
  return seconds * 1000;
}
function flag(value: unknown, field: string): boolean {
  if (value !== 0 && value !== 1) throw new Error(`${field} must be 0 or 1.`);
  return value === 1;
}
function metadata(row: StriveRow): Record<string, string> {
  return Object.fromEntries(
    Object.keys(row)
      .sort()
      .filter((key) => row[key] !== null && row[key] !== undefined)
      .map((key) => [key, String(row[key])]),
  );
}
function stable(row: StriveRow): string {
  return JSON.stringify(metadata(row));
}
function ordered(rows: StriveRow[]): StriveRow[] {
  const seen = new Set<number>();
  for (const row of rows) {
    const order = number(row.order, 'Order');
    if (order === undefined || !Number.isInteger(order) || seen.has(order))
      throw new Error('Set or exercise ordering is missing or duplicated.');
    seen.add(order);
  }
  return [...rows].sort((a, b) => (a.order as number) - (b.order as number));
}
function index(rows: StriveRow[], field: string): Map<string, StriveRow[]> {
  const result = new Map<string, StriveRow[]>();
  for (const row of rows) {
    const key = requiredText(row[field], field);
    const group = result.get(key) ?? [];
    group.push(row);
    result.set(key, group);
  }
  return result;
}
const tags: Record<string, string | undefined> = {
  none: undefined,
  normal: undefined,
  warmup: 'Warm Up',
  dropset: 'Drop Set',
  failure: 'Failure',
  backoff: 'Back-Off',
};

/** Converts only recorded history. Templates, preferences and photos never enter Forge storage. */
function* parseStriveChunks(
  snapshot: StriveSnapshot,
  options: CsvOptions,
): Generator<void, CsvDraft> {
  if (snapshot.version !== 85)
    throw new Error(
      `Strive database version ${snapshot.version} is not supported. This importer supports version 85.`,
    );
  for (const table of striveTables)
    if (!Array.isArray(snapshot.tables[table]))
      throw new Error(`The Strive backup is missing ${table}.`);
  const t = snapshot.tables;
  const logs = index(t.routine_logs, 'id');
  const blocks = index(t.routine_exercise_logs, 'routine_log_id');
  const sets = index(t.routine_exercise_set_logs, 'routine_exercise_log_id');
  const catalog = index(t.exercises, 'id');
  const workoutNotes = index(
    t.routine_notes.filter((row) => row.pinned === 0),
    'owner_id',
  );
  const exerciseNotes = index(
    t.routine_exercise_notes.filter((row) => row.type === 'log'),
    'owner_id',
  );
  const draft: CsvDraft = {
    source: 'strive',
    workouts: [],
    issues: [],
    excluded: 0,
    requirements: [],
    limitations: [
      'Imports completed workouts only. Plans, routines, measurements, preferences, photos and personal-record tables are not imported.',
      'Strive-only set types, calories, timers and training-max percentages are retained as source metadata. Forge does not interpret them as recorded measurements.',
      'Exercise names use the English catalogue label, falling back to Polish. Archived exercises used in recorded workouts remain importable.',
    ],
  };
  const orphaned =
    t.routine_exercise_logs.some((row) => !logs.has(text(row.routine_log_id))) ||
    t.routine_exercise_set_logs.some(
      (row) =>
        !blocks
          .get(text(row.routine_log_id))
          ?.some((block) => block.id === row.routine_exercise_log_id),
    );
  if (orphaned)
    throw new Error(
      'The Strive backup contains orphaned workout records. Repair or re-export it before importing.',
    );
  const needsDuration = t.routine_exercise_logs.some(
    (block) =>
      catalog.get(text(block.exercise_id))?.[0]?.category === 'duration' &&
      (sets.get(text(block.id)) ?? []).some((set) => set.reps !== null && set.reps !== undefined),
  );
  if (needsDuration && !options.durationUnit) draft.requirements.push('durationUnit');
  const needsDistance = t.routine_exercise_set_logs.some(
    (set) => typeof set.distance === 'number' && set.distance !== 0,
  );
  if (needsDistance && !options.distanceUnit) draft.requirements.push('distanceUnit');
  if (draft.requirements.length) return draft;
  let ordinal = 0;
  for (const [sourceId, candidates] of logs) {
    const rowNumber = ++ordinal;
    if (ordinal % 20 === 0) yield;
    try {
      if (candidates.length !== 1) throw new Error('Workout identity is duplicated.');
      const log = candidates[0];
      const sessionKey = JSON.stringify(['strive', sourceId]);
      const workoutId = csvId(sessionKey);
      const startedAt = epoch(log.started_at, 'Start date'),
        completedAt = epoch(log.ended_at, 'End date');
      if (completedAt < startedAt) throw new Error('End date precedes start date.');
      const sourceBlocks = ordered(blocks.get(sourceId) ?? []);
      if (!sourceBlocks.length) throw new Error('Workout has no recorded exercises.');
      const blockIds = new Set(
        sourceBlocks.map((block) => requiredText(block.id, 'Exercise log ID')),
      );
      if (blockIds.size !== sourceBlocks.length)
        throw new Error('Exercise log identity is duplicated.');
      const parent = new Map([...blockIds].map((id) => [id, id]));
      function root(id: string): string {
        let next = id;
        while (parent.get(next) !== next) next = parent.get(next)!;
        return next;
      }
      for (const block of sourceBlocks)
        if (block.superset_with !== null && block.superset_with !== undefined) {
          const target = requiredText(block.superset_with, 'Superset partner');
          if (!blockIds.has(target) || target === block.id)
            throw new Error('Superset references an exercise outside this workout.');
          const a = root(text(block.id)),
            b = root(target);
          parent.set(a > b ? a : b, a > b ? b : a);
        }
      const supersetCounts = new Map<string, number>();
      for (const id of blockIds)
        supersetCounts.set(root(id), (supersetCounts.get(root(id)) ?? 0) + 1);
      const fingerprints: string[] = [stable(log)];
      const notes = [...(workoutNotes.get(sourceId) ?? [])].sort((a, b) =>
        stable(a).localeCompare(stable(b)),
      );
      fingerprints.push(...notes.map(stable));
      const exercises: WorkoutExercise[] = sourceBlocks.map((block) => {
        const matches = catalog.get(requiredText(block.exercise_id, 'Exercise ID'));
        if (matches?.length !== 1)
          throw new Error('A recorded exercise is missing or duplicated in the Strive catalogue.');
        const sourceExercise = matches[0];
        const name = requiredText(
          text(sourceExercise.name_en).trim() || sourceExercise.name_pl,
          'Exercise name',
        );
        const sourceSets = ordered(sets.get(text(block.id)) ?? []);
        if (!sourceSets.length) throw new Error(`A recorded exercise has no sets: ${name}.`);
        const category = text(sourceExercise.category);
        const duration = category === 'duration';
        const loaded =
          category === 'weigtedBodyweight' ||
          category === 'weightedBodyweight' ||
          category === 'assistedBodyweight';
        const notes = [...(exerciseNotes.get(text(block.id)) ?? [])].sort((a, b) =>
          stable(a).localeCompare(stable(b)),
        );
        fingerprints.push(
          stable(block),
          stable({
            id: sourceExercise.id,
            name_en: sourceExercise.name_en,
            name_pl: sourceExercise.name_pl,
            category: sourceExercise.category,
          }),
          ...notes.map(stable),
          ...sourceSets.map(stable),
        );
        const translated: WorkoutSet[] = sourceSets.map((set) => {
          if (set.routine_log_id !== sourceId || set.exercise_id !== block.exercise_id)
            throw new Error('Set parent links disagree with its exercise or workout.');
          const setId = csvId(JSON.stringify(['strive-set', sourceId, block.id, set.order]));
          const measurements: SetMeasurement[] = [];
          const add = (
            kind: SetMeasurement['kind'],
            unit: SetMeasurement['unit'],
            value: number | undefined,
          ) => {
            if (value !== undefined)
              measurements.push({ id: `${setId}-${kind}`, kind, unit, value });
          };
          let weight = number(set.weight, 'Weight');
          if (weight !== undefined)
            weight *= flag(set.is_weight_unit_metric, 'Weight unit') ? 1 : 0.45359237;
          const reps = number(set.reps, duration ? 'Duration' : 'Repetitions');
          if (!duration && reps !== undefined && !Number.isInteger(reps))
            throw new Error('Repetitions must be a whole number.');
          if (duration) {
            add(
              'duration',
              'sec',
              reps === undefined ? undefined : reps * (options.durationUnit === 'min' ? 60 : 1),
            );
            if (weight) add('weight', 'kg', weight);
          } else {
            if (weight !== undefined && (weight !== 0 || category !== 'reps'))
              add(loaded ? 'addedWeight' : 'weight', 'kg', weight);
            add('reps', 'count', reps);
          }
          const distance = number(set.distance, 'Distance');
          if (distance !== undefined && distance !== 0) {
            const metric = flag(set.is_distance_unit_metric, 'Distance unit');
            if (metric === (options.distanceUnit === 'mi'))
              throw new Error(
                'The chosen distance unit disagrees with this set. Review the source units before importing.',
              );
            add(
              'distance',
              'km',
              distance *
                (options.distanceUnit === 'mi'
                  ? 1.609344
                  : options.distanceUnit === 'm'
                    ? 0.001
                    : 1),
            );
          }
          const rpe = number(set.rpe, 'RPE');
          if (rpe !== undefined && (rpe < 0 || rpe > 10))
            throw new Error('RPE must be between 0 and 10.');
          add('rpe', 'rpe', rpe);
          if (!measurements.some((entry) => entry.kind !== 'rpe'))
            throw new Error('A recorded set has no supported measurements.');
          requiredText(set.type, 'Set type');
          return {
            id: setId,
            weight: weight === undefined ? '' : String(weight),
            reps: duration || reps === undefined ? '' : String(reps),
            completed: true,
            tag: Object.hasOwn(tags, text(set.type)) ? tags[text(set.type)] : undefined,
            measurements,
            importMetadata: {
              ...metadata(set),
              ...Object.fromEntries(
                Object.entries(metadata(log)).map(([key, value]) => [`workout.${key}`, value]),
              ),
              ...Object.fromEntries(
                Object.entries(metadata(block)).map(([key, value]) => [
                  `exerciseLog.${key}`,
                  value,
                ]),
              ),
              'exercise.category': category,
              'exercise.name': name,
            },
          };
        });
        const kinds = new Set(
          translated.flatMap((set) => set.measurements!.map((entry) => entry.kind)),
        );
        let trackingType: TrackingType = duration
          ? kinds.has('weight')
            ? 'duration-weight'
            : 'duration'
          : category === 'assistedBodyweight'
            ? 'assisted-bodyweight'
            : loaded
              ? 'weighted-bodyweight'
              : kinds.has('weight')
                ? 'weight-reps'
                : 'reps-only';
        if (kinds.has('distance'))
          trackingType = kinds.has('duration')
            ? 'distance-duration'
            : kinds.has('weight')
              ? 'weight-distance'
              : 'distance';
        if (
          [...kinds].some((kind) => kind !== 'rpe' && !trackingFields[trackingType].includes(kind))
        )
          throw new Error(`The measurements for ${name} cannot be represented together in Forge.`);
        return {
          id: csvId(JSON.stringify(['strive-exercise', sourceId, block.id])),
          importKey: `strive:${block.exercise_id}`,
          name,
          trackingType,
          sets: translated,
          note: notes
            .map((note) => text(note.note))
            .filter(Boolean)
            .join('\n\n'),
          supersetId:
            supersetCounts.get(root(text(block.id)))! > 1
              ? csvId(JSON.stringify(['strive-superset', sourceId, root(text(block.id))]))
              : undefined,
        };
      });
      const workout: Workout = {
        id: workoutId,
        name: requiredText(log.name, 'Workout name'),
        type: 'Strength',
        startedAt,
        completedAt,
        durationSeconds: (completedAt - startedAt) / 1000,
        automaticTimeTracking: false,
        note: notes
          .map((note) => text(note.note))
          .filter(Boolean)
          .join('\n\n'),
        exercises,
        importSource: {
          source: 'strive',
          sessionKey,
          fingerprint: csvId(
            JSON.stringify([
              options.durationUnit ?? null,
              options.distanceUnit ?? null,
              fingerprints,
            ]),
          ),
        },
      };
      draft.workouts.push(workout);
    } catch (error) {
      draft.excluded++;
      draft.issues.push({
        row: rowNumber,
        field: 'Workout',
        message: error instanceof Error ? error.message : 'Invalid workout.',
        sessionKey: sourceId,
      });
    }
  }
  return draft;
}

export function parseStriveSnapshot(snapshot: StriveSnapshot, options: CsvOptions = {}): CsvDraft {
  const chunks = parseStriveChunks(snapshot, options);
  let next = chunks.next();
  while (!next.done) next = chunks.next();
  return next.value;
}

export async function parseStriveSnapshotAsync(
  snapshot: StriveSnapshot,
  options: CsvOptions = {},
): Promise<CsvDraft> {
  const chunks = parseStriveChunks(snapshot, options);
  let next = chunks.next();
  while (!next.done) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    next = chunks.next();
  }
  return next.value;
}
