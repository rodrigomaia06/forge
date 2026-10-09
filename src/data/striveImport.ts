import type {
  SetMeasurement,
  TrackingType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutRoutine,
} from '../types';
import type { CsvDraft, CsvOptions } from './csvImport/types';
import { trackingFields } from '../domain/exercises/tracking';
import { csvId } from './csvImport/parse';

export type StriveRow = Record<string, unknown>;
export const striveColumns = {
  routine_logs: ['id', 'name', 'started_at', 'ended_at'],
  routine_exercise_logs: ['id', 'routine_log_id', 'exercise_id', 'order', 'superset_with'],
  routine_exercise_set_logs: [
    'routine_log_id',
    'routine_exercise_log_id',
    'exercise_id',
    'order',
    'reps',
    'weight',
    'distance',
    'type',
    'is_weight_unit_metric',
    'is_distance_unit_metric',
    'rpe',
  ],
  exercises: ['id', 'name_en', 'name_pl', 'name', 'category'],
  routine_notes: ['id', 'owner_id', 'pinned', 'note', 'created_at'],
  routine_exercise_notes: ['id', 'owner_id', 'type', 'note', 'created_at'],
  routines: ['id', 'name', 'description', 'deleted_at', 'created_at'],
  routine_exercises: ['id', 'routine_id', 'exercise_id', 'order', 'superset_with'],
  routine_exercise_sets: [
    'routine_id',
    'routine_exercise_id',
    'exercise_id',
    'order',
    'reps',
    'weight',
    'distance',
    'type',
    'is_weight_unit_metric',
    'is_distance_unit_metric',
    'rpe',
    'reps_min',
    'reps_max',
  ],
} as const;
export const requiredStriveColumns: Partial<Record<keyof typeof striveColumns, readonly string[]>> =
  {
    routine_logs: ['id', 'name', 'started_at', 'ended_at'],
    routine_exercise_logs: ['id', 'routine_log_id', 'exercise_id', 'order'],
    routine_exercise_set_logs: [
      'routine_log_id',
      'routine_exercise_log_id',
      'exercise_id',
      'order',
    ],
    exercises: ['id'],
    routines: ['id', 'name', 'created_at'],
    routine_exercises: ['id', 'routine_id', 'exercise_id', 'order'],
    routine_exercise_sets: ['routine_id', 'routine_exercise_id', 'exercise_id', 'order'],
  };
export const requiredStriveTables = [
  'routine_logs',
  'routine_exercise_logs',
  'routine_exercise_set_logs',
  'exercises',
] as const;
export const striveTables = [
  'routine_logs',
  'routine_exercise_logs',
  'routine_exercise_set_logs',
  'exercises',
  'routine_notes',
  'routine_exercise_notes',
  'routines',
  'routine_exercises',
  'routine_exercise_sets',
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
export function normalizeStriveSnapshot(snapshot: StriveSnapshot): StriveSnapshot {
  const tables = {} as StriveSnapshot['tables'];
  for (const table of striveTables) {
    const source = snapshot.tables[table];
    if (!Array.isArray(source) && (requiredStriveTables as readonly string[]).includes(table))
      throw new Error(`The Strive backup is missing ${table}.`);
    tables[table] = (Array.isArray(source) ? source : []).map((row) =>
      Object.fromEntries(
        striveColumns[table]
          .filter((column) => Object.hasOwn(row, column))
          .map((column) => [column, row[column]]),
      ),
    );
    for (const row of tables[table]) {
      if (table === 'exercises') row.name_en = text(row.name_en).trim() || text(row.name);
      if (table === 'routines' && row.deleted_at === undefined) row.deleted_at = null;
      if (table.endsWith('_sets') || table === 'routine_exercise_set_logs') {
        if (!Object.hasOwn(tags, text(row.type))) row.type = 'none';
        if (typeof row.rpe !== 'number' || !Number.isFinite(row.rpe) || row.rpe < 0 || row.rpe > 10)
          delete row.rpe;
        if (
          row.weight !== undefined &&
          row.weight !== null &&
          row.is_weight_unit_metric === undefined
        ) {
          delete row.weight;
        }
        if (
          row.distance !== undefined &&
          row.distance !== null &&
          row.is_distance_unit_metric === undefined
        ) {
          delete row.distance;
        }
      }
    }
  }
  return { version: snapshot.version, tables };
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

/** Routine templates share measurement validation without requiring recorded set values. */
function* parseStriveChunks(
  snapshot: StriveSnapshot,
  options: CsvOptions,
  templates = false,
): Generator<void, CsvDraft> {
  for (const table of striveTables)
    if (!Array.isArray(snapshot.tables[table]))
      throw new Error(`The Strive backup is missing ${table}.`);
  const t = templates ? routineSnapshot(snapshot).tables : snapshot.tables;
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
      'Imports workout history and active routines as standalone routines. Plan schedules, deleted routines, measurements, preferences, photos and personal-record tables are not imported.',
      'Durations are imported in seconds. Metric distances use kilometres and imperial distances use miles. Routine rep ranges remain planned targets.',
      'Unknown columns, unsupported set types, calories, timers, training-max percentages and progression automation are ignored. Values without a known unit are omitted.',
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
      if (!templates && !sourceBlocks.length) throw new Error('Workout has no recorded exercises.');
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
        if (!templates && !sourceSets.length)
          throw new Error(`A recorded exercise has no sets: ${name}.`);
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
            add('distance', 'km', distance * (metric ? 1 : 1.609344));
          }
          const rpe = number(set.rpe, 'RPE');
          if (rpe !== undefined && (rpe < 0 || rpe > 10))
            throw new Error('RPE must be between 0 and 10.');
          add('rpe', 'rpe', rpe);
          if (!templates && !measurements.some((entry) => entry.kind !== 'rpe'))
            throw new Error('A recorded set has no supported measurements.');
          const min = templates ? number(set.reps_min, 'Minimum repetitions') : undefined;
          const max = templates ? number(set.reps_max, 'Maximum repetitions') : undefined;
          if (
            [min, max].some((value) => value !== undefined && !Number.isInteger(value)) ||
            (min !== undefined && max !== undefined && min > max)
          )
            throw new Error('The routine repetition range is invalid.');
          requiredText(set.type, 'Set type');
          return {
            id: setId,
            weight: weight === undefined ? '' : String(weight),
            reps: duration || reps === undefined ? '' : String(reps),
            completed: true,
            tag: Object.hasOwn(tags, text(set.type)) ? tags[text(set.type)] : undefined,
            measurements,
            ...(min !== undefined || max !== undefined
              ? {
                  plannedTargets: [
                    {
                      id: `${setId}-range`,
                      kind: duration ? ('duration' as const) : ('reps' as const),
                      unit: duration ? ('sec' as const) : ('count' as const),
                      minValue:
                        min === undefined
                          ? undefined
                          : min * (duration && options.durationUnit === 'min' ? 60 : 1),
                      maxValue:
                        max === undefined
                          ? undefined
                          : max * (duration && options.durationUnit === 'min' ? 60 : 1),
                    },
                  ],
                }
              : {}),
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
                : templates && ![...kinds].some((kind) => kind !== 'rpe') && category !== 'reps'
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

function routineSnapshot(snapshot: StriveSnapshot): StriveSnapshot {
  const t = snapshot.tables;
  const allIds = new Set(t.routines.map((routine) => routine.id));
  const blockById = new Map(t.routine_exercises.map((block) => [block.id, block]));
  if (
    t.routine_exercises.some((block) => !allIds.has(block.routine_id)) ||
    t.routine_exercise_sets.some(
      (set) => blockById.get(set.routine_exercise_id)?.routine_id !== set.routine_id,
    )
  )
    throw new Error(
      'The Strive backup contains orphaned routine records. Repair or re-export it before importing.',
    );
  const routines = t.routines.filter((routine) => routine.deleted_at === null);
  const ids = new Set(routines.map((routine) => routine.id));
  const blocks = t.routine_exercises.filter((block) => ids.has(block.routine_id));
  return {
    version: snapshot.version,
    tables: {
      ...t,
      routine_logs: routines.map((routine) => ({
        ...routine,
        id: `routine:${requiredText(routine.id, 'Routine ID')}`,
        name: routine.name,
        started_at: routine.created_at,
        ended_at: routine.created_at,
      })),
      routine_exercise_logs: blocks.map((block) => ({
        ...block,
        routine_log_id: `routine:${block.routine_id}`,
      })),
      routine_exercise_set_logs: t.routine_exercise_sets
        .filter((set) => ids.has(set.routine_id))
        .map((set) => ({
          ...set,
          routine_log_id: `routine:${set.routine_id}`,
          routine_exercise_log_id: set.routine_exercise_id,
        })),
      routine_notes: routines
        .filter((routine) => text(routine.description))
        .map((routine) => ({
          id: routine.id,
          owner_id: `routine:${routine.id}`,
          pinned: 0,
          note: routine.description,
        })),
      routine_exercise_notes: t.routine_exercise_notes
        .filter((note) => note.type === 'routine')
        .map((note) => ({ ...note, type: 'log' })),
    },
  };
}
function combineDrafts(history: CsvDraft, templates: CsvDraft): CsvDraft {
  const routines: WorkoutRoutine[] = templates.workouts.map((record) => ({
    id: record.id,
    name: record.name,
    type: record.type,
    note: record.note,
    createdAt: record.startedAt,
    updatedAt: record.startedAt,
    importSource: record.importSource,
    exercises: record.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map(({ completed, ...set }) => set),
    })),
  }));
  return {
    ...history,
    routines,
    requirements: [...new Set([...history.requirements, ...templates.requirements])],
    excluded: history.excluded + templates.excluded,
    issues: [
      ...history.issues,
      ...templates.issues.map((issue) => ({ ...issue, field: 'Routine' })),
    ],
  };
}

export function parseStriveSnapshot(snapshot: StriveSnapshot, options: CsvOptions = {}): CsvDraft {
  snapshot = normalizeStriveSnapshot(snapshot);
  options = { ...options, durationUnit: 'sec', distanceUnit: undefined };
  const chunks = parseStriveChunks(snapshot, options);
  let next = chunks.next();
  while (!next.done) next = chunks.next();
  const templates = parseStriveChunks(snapshot, options, true);
  let routine = templates.next();
  while (!routine.done) routine = templates.next();
  return combineDrafts(next.value, routine.value);
}

export async function parseStriveSnapshotAsync(
  snapshot: StriveSnapshot,
  options: CsvOptions = {},
): Promise<CsvDraft> {
  snapshot = normalizeStriveSnapshot(snapshot);
  options = { ...options, durationUnit: 'sec', distanceUnit: undefined };
  const chunks = parseStriveChunks(snapshot, options);
  let next = chunks.next();
  while (!next.done) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    next = chunks.next();
  }
  const templates = parseStriveChunks(snapshot, options, true);
  let routine = templates.next();
  while (!routine.done) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    routine = templates.next();
  }
  return combineDrafts(next.value, routine.value);
}
