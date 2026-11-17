import type {
  Workout,
  WorkoutSet,
  WorkoutExercise,
  SetMeasurement,
  TrackingType,
} from '../../types';
import { readCsv, readCsvAsync } from './csv';
import { adaptRow, detectCsvSource, type CsvRecord } from './adapters';
import type { CsvDraft, CsvOptions } from './types';

/** Two independent lanes make stable ids without truncating identity to a date. */
export function csvId(text: string): string {
  let first = 2166136261,
    second = 5381;
  for (let i = 0; i < text.length; i++) {
    first = Math.imul(first ^ text.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ text.charCodeAt(i);
  }
  return `csv-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
}
export function exerciseKey(source: string, name: string): string {
  return `${source}:${name.trim().normalize('NFKC').toLowerCase()}`;
}
class NeedsChoice extends Error {
  constructor(public requirement: NonNullable<CsvDraft['requirements']>[number]) {
    super(`Choose ${requirement} before review.`);
  }
}
const unitAliases: Record<string, string> = {
  kgs: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  lbs: 'lb', pound: 'lb', pounds: 'lb',
  meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  kms: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
  mile: 'mi', miles: 'mi', foot: 'ft', feet: 'ft', yard: 'yd', yards: 'yd', yds: 'yd',
  inch: 'in', inches: 'in',
};
/** Source apps spell units as kgs, lbs., mi. or full words; Forge compares one canonical code. */
export function canonicalUnit(text: string): string {
  const unit = text.trim().toLowerCase().replace(/\.$/, '');
  return Object.hasOwn(unitAliases, unit) ? unitAliases[unit] : unit;
}
const distanceKilometres: Record<string, number> = {
  km: 1, m: 0.001, cm: 0.00001, in: 0.0000254, ft: 0.0003048, yd: 0.0009144, mi: 1.609344,
};
const months: Record<string, number> = {
  jan: 1,
  january: 1,
  janeiro: 1,
  enero: 1,
  januar: 1,
  janvier: 1,
  feb: 2,
  february: 2,
  fevereiro: 2,
  febrero: 2,
  februar: 2,
  fevrier: 2,
  mar: 3,
  march: 3,
  marco: 3,
  marzo: 3,
  marz: 3,
  mars: 3,
  apr: 4,
  april: 4,
  abril: 4,
  avril: 4,
  may: 5,
  maio: 5,
  mayo: 5,
  mai: 5,
  jun: 6,
  june: 6,
  junho: 6,
  junio: 6,
  juni: 6,
  juin: 6,
  jul: 7,
  july: 7,
  julho: 7,
  julio: 7,
  juli: 7,
  juillet: 7,
  aug: 8,
  august: 8,
  agosto: 8,
  aout: 8,
  sep: 9,
  september: 9,
  setembro: 9,
  septiembre: 9,
  septembre: 9,
  oct: 10,
  october: 10,
  outubro: 10,
  octubre: 10,
  oktober: 10,
  octobre: 10,
  nov: 11,
  november: 11,
  novembro: 11,
  noviembre: 11,
  novembre: 11,
  dec: 12,
  december: 12,
  dezembro: 12,
  diciembre: 12,
  dezember: 12,
  decembre: 12,
  janv: 1,
  fevr: 2,
  avr: 4,
  juil: 7,
  sept: 9,
  fev: 2,
  abr: 4,
  ago: 8,
  set: 9,
  out: 10,
  dez: 12,
  ene: 1,
};
function dateValue(text: string, options: CsvOptions): number {
  if (!text?.trim()) throw new Error('Date is missing.');
  const value = text.trim();
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    dateValue(value.slice(0, 10), options);
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) throw new Error('Invalid timestamp.');
    return timestamp;
  }
  const clock = value.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  const date = (clock ? value.slice(0, clock.index) : value).replace(/[,\s]+$/, '').trim();
  let year: number, month: number, day: number;
  const iso = date.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const numeric = date.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (numeric) {
    const first = Number(numeric[1]),
      second = Number(numeric[2]);
    year = Number(numeric[3]);
    if (first <= 12 && second <= 12 && first !== second && !options.dateOrder)
      throw new NeedsChoice('dateOrder');
    const dayFirst = first > 12 || (second <= 12 && options.dateOrder !== 'month-first');
    day = dayFirst ? first : second;
    month = dayFirst ? second : first;
  } else {
    const normalized = date
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[.,]/g, '');
    const monthFirst = normalized.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/);
    const words =
      normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/) ??
      (monthFirst ? ['', monthFirst[2], monthFirst[1], monthFirst[3]] : null);
    if (!words || !months[words[2]]) throw new Error('Unsupported or invalid date.');
    day = Number(words[1]);
    month = months[words[2]];
    year = Number(words[3]);
  }
  let hour = clock ? Number(clock[1]) : 12;
  const minute = clock ? Number(clock[2]) : 0,
    second = clock ? Number(clock[3] ?? 0) : 0;
  if (clock?.[4]) {
    if (hour < 1 || hour > 12) throw new Error('Invalid clock time.');
    hour = (hour % 12) + (clock[4].toUpperCase() === 'PM' ? 12 : 0);
  }
  const result = new Date(year, month - 1, day, hour, minute, second);
  if (
    year < 1900 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  )
    throw new Error('Invalid date or clock time.');
  return result.getTime();
}
function numeric(text: string, field: string): number | undefined {
  if (!text?.trim()) return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(text.trim()))
    throw new Error(`${field} must be a nonnegative number.`);
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) throw new Error(`${field} is too large.`);
  return value;
}
function seconds(text: string): number | undefined {
  if (!text?.trim()) return undefined;
  if (/^\d+(?:[.,]\d+)?$/.test(text.trim())) return numeric(text, 'Duration');
  if (/^\d+(?::\d{1,2}){1,2}$/.test(text.trim())) {
    const parts = text.trim().split(':').map(Number);
    if (parts.slice(1).some((part) => part >= 60)) throw new Error('Invalid duration.');
    return parts.reduce((total, part) => total * 60 + part, 0);
  }
  const duration = text.trim().match(/^(?:(\d+)\s*h\s*)?(?:(\d+)\s*m(?:in)?\s*)?(?:(\d+)\s*s)?$/i);
  if (!duration || !duration.slice(1).some(Boolean)) throw new Error('Invalid duration.');
  return Number(duration[1] ?? 0) * 3600 + Number(duration[2] ?? 0) * 60 + Number(duration[3] ?? 0);
}
export function inferTracking(sets: WorkoutSet[]): TrackingType {
  const kinds = new Set(
    sets.flatMap(
      (set) =>
        set.measurements
          ?.filter((entry) => entry.kind === 'reps' || entry.value !== 0)
          .map((entry) => entry.kind) ?? [],
    ),
  );
  if (kinds.has('distance'))
    return kinds.has('duration')
      ? 'distance-duration'
      : kinds.has('weight')
        ? 'weight-distance'
        : 'distance';
  if (kinds.has('duration')) return kinds.has('weight') ? 'duration-weight' : 'duration';
  return kinds.has('weight') ? 'weight-reps' : 'reps-only';
}
export function parseWorkoutCsv(text: string, options: CsvOptions = {}): CsvDraft {
  const chunks = parseChunks(readCsv(text), options);
  let next = chunks.next();
  while (!next.done) next = chunks.next();
  return next.value;
}
export async function parseWorkoutCsvAsync(
  text: string,
  options: CsvOptions = {},
): Promise<CsvDraft> {
  const chunks = parseChunks(await readCsvAsync(text), options);
  let next = chunks.next();
  while (!next.done) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    next = chunks.next();
  }
  return next.value;
}
function* parseChunks(
  { headers, rows }: ReturnType<typeof readCsv>,
  options: CsvOptions,
): Generator<void, CsvDraft> {
  const source = detectCsvSource(headers);
  const draft: CsvDraft = {
    source,
    workouts: [],
    issues: [],
    excluded: 0,
    requirements: [],
    skipped: [],
    limitations: [
      'Dates without a timezone use this device’s local timezone. Source-only fields are retained as import metadata.',
      'Imported sessions use the Strength workout type. You can change it in History after importing.',
      ...(source.startsWith('fitnotes')
        ? [
            'FitNotes exports without session IDs are grouped by date. Separate sessions on that date cannot be reconstructed.',
          ]
        : []),
    ],
  };
  const groups = new Map<
    string,
    {
      workout?: Workout;
      invalid: boolean;
      records: CsvRecord[];
      blocks: Map<string, WorkoutExercise>;
      name: string;
      date?: number;
      uncertainIdentity?: boolean;
      /** Block identity uses the source exercise note, not notes attached from Strong note rows. */
      blockNotes: Map<WorkoutExercise, string>;
      pendingNotes: Map<string, string[]>;
      firstRow: number;
    }
  >();
  let restRows = 0,
    orphanNotes = 0;
  let processed = 0;
  for (const row of rows) {
    if (++processed % 400 === 0) yield;
    const record = Object.fromEntries(headers.map((header, i) => [header, row.values[i] ?? '']));
    const adapted = adaptRow(source, record);
    for (const key of [
      'date',
      'session',
      'name',
      'exercise',
      'weightUnit',
      'distanceUnit',
      'superset',
      'tag',
    ] as const)
      adapted[key] = adapted[key]?.trim() ?? '';
    const rawKey = JSON.stringify(
      adapted.session ? [source, adapted.session] : [source, adapted.date, adapted.name],
    );
    const group = groups.get(rawKey) ?? {
      invalid: false,
      records: [],
      blocks: new Map<string, WorkoutExercise>(),
      name: adapted.name,
      blockNotes: new Map<WorkoutExercise, string>(),
      pendingNotes: new Map<string, string[]>(),
      firstRow: row.row,
    };
    groups.set(rawKey, group);
    group.records.push(record);
    let field = 'Record';
    try {
      if (row.values.length !== headers.length)
        throw new Error(`Expected ${headers.length} columns, found ${row.values.length}.`);
      field = 'Date';
      const startedAt = dateValue(adapted.date, options);
      group.date = startedAt;
      field = 'Exercise';
      if (!adapted.exercise) throw new Error('Exercise name is missing.');
      field = 'Workout';
      if (!adapted.name) throw new Error('Workout name is missing.');
      const sessionKey = JSON.stringify(
        adapted.session ? [source, adapted.session] : [source, startedAt, adapted.name],
      );
      const id = csvId(sessionKey);
      field = 'Duration';
      let duration = seconds(adapted.duration);
      if (duration !== undefined && adapted.durationUnit === 'min' && /^\d+(?:[.,]\d+)?$/.test(adapted.duration.trim()))
        duration *= 60;
      field = 'End time';
      const end = adapted.end
        ? dateValue(adapted.end, options)
        : startedAt + (duration ?? 0) * 1000;
      if (end < startedAt) throw new Error('End time precedes the start.');
      if (!group.workout)
        group.workout = {
          id,
          name: adapted.name,
          type: 'Strength',
          startedAt,
          completedAt: end,
          durationSeconds: duration ?? (adapted.end ? (end - startedAt) / 1000 : undefined),
          automaticTimeTracking: false,
          note: adapted.note,
          exercises: [],
          importSource: {
            source,
            sessionKey,
            fingerprint: '',
            dateOnly: !/\d:\d/.test(adapted.date),
          },
        };
      const workout = group.workout;
      if (
        workout.startedAt !== startedAt ||
        workout.name !== adapted.name ||
        workout.completedAt !== end ||
        workout.note !== adapted.note
      )
        throw new Error('Conflicting session details across rows.');
      const blockKey = exerciseKey(source, adapted.exercise);
      if (adapted.kind === 'rest') {
        restRows++;
        continue;
      }
      if (adapted.kind === 'note') {
        const text = adapted.comment;
        if (text.trim()) {
          const target = [...workout.exercises].reverse().find((entry) => entry.importKey === blockKey);
          if (target) target.note = target.note ? `${target.note}\n\n${text}` : text;
          else group.pendingNotes.set(blockKey, [...(group.pendingNotes.get(blockKey) ?? []), text]);
        }
        continue;
      }
      const measurements: SetMeasurement[] = [];
      const setId = `${id}-set-${group.records.length}`;
      const add = (kind: SetMeasurement['kind'], unit: SetMeasurement['unit'], value?: number) => {
        if (value !== undefined) measurements.push({ id: `${setId}-${kind}`, kind, unit, value });
      };
      field = 'Weight';
      let weight = numeric(adapted.weight, field);
      if (weight !== undefined) {
        const unit = canonicalUnit(adapted.weightUnit) || options.weightUnit;
        if (!unit) throw new NeedsChoice('weightUnit');
        if (unit !== 'kg' && unit !== 'lb') throw new Error('Unsupported weight unit.');
        if (unit === 'lb') weight *= 0.45359237;
      }
      add('weight', 'kg', weight);
      field = 'Reps';
      const reps = numeric(adapted.reps, field);
      if (reps !== undefined && !Number.isSafeInteger(reps))
        throw new Error('Reps must be a whole number.');
      add('reps', 'count', reps);
      field = 'Distance';
      let distance = numeric(adapted.distance, field);
      if (distance !== undefined && distance !== 0) {
        const unit = canonicalUnit(adapted.distanceUnit) || options.distanceUnit;
        if (!unit) throw new NeedsChoice('distanceUnit');
        if (!Object.hasOwn(distanceKilometres, unit))
          throw new Error('Unsupported distance unit.');
        distance *= distanceKilometres[unit];
      }
      add('distance', 'km', distance);
      field = 'Set duration';
      add('duration', 'sec', seconds(adapted.seconds));
      field = 'RPE';
      const rpe = numeric(adapted.rpe, field);
      if (rpe !== undefined && rpe > 10) throw new Error('RPE must be between 0 and 10.');
      add('rpe', 'rpe', rpe);
      if (!measurements.some((entry) => entry.kind !== 'rpe'))
        throw new Error('Set has no measurements.');
      const previous = workout.exercises[workout.exercises.length - 1];
      const groupedKey = JSON.stringify([blockKey, adapted.superset, adapted.exerciseNote]);
      const grouped = adapted.superset ? group.blocks.get(groupedKey) : previous;
      const exercise =
        grouped?.importKey === blockKey &&
        grouped.supersetId === (adapted.superset || undefined) &&
        group.blockNotes.get(grouped) === adapted.exerciseNote
          ? grouped
          : {
              id: `${id}-exercise-${workout.exercises.length}`,
              name: adapted.exercise,
              importKey: blockKey,
              note: adapted.exerciseNote,
              supersetId: adapted.superset || undefined,
              sets: [] as WorkoutSet[],
            };
      if (exercise !== grouped) {
        group.blockNotes.set(exercise, adapted.exerciseNote);
        const pending = group.pendingNotes.get(blockKey);
        if (pending) {
          exercise.note = [exercise.note, ...pending].filter(Boolean).join('\n\n');
          group.pendingNotes.delete(blockKey);
        }
        workout.exercises.push(exercise);
      }
      if (adapted.superset) group.blocks.set(groupedKey, exercise);
      const warmup = /^(w|warm.?up)$/i.test(adapted.tag);
      exercise.sets.push({
        id: setId,
        weight: weight === undefined ? '' : String(weight),
        reps: reps === undefined ? '' : String(reps),
        completed: true,
        measurements,
        comment: adapted.comment,
        tag: warmup
          ? 'Warm Up'
          : /^(d|drop.?set)$/i.test(adapted.tag)
            ? 'Drop Set'
            : /^(f|failure)$/i.test(adapted.tag)
              ? 'Failure'
              : /^(b|back.?off)$/i.test(adapted.tag)
                ? 'Back-Off'
                : undefined,
        importMetadata: record,
      });
    } catch (error) {
      group.invalid = true;
      if (error instanceof NeedsChoice) {
        if (!draft.requirements.includes(error.requirement))
          draft.requirements.push(error.requirement);
      } else {
        if (!adapted.session && (field === 'Date' || !adapted.name)) group.uncertainIdentity = true;
        draft.issues.push({
          row: row.row,
          field,
          message: `${error instanceof Error ? error.message : 'Invalid record.'}${group.uncertainIdentity ? ' Workouts sharing the available session name or date are also excluded to avoid partial sessions.' : ''}`,
          sessionKey: rawKey,
        });
      }
    }
  }
  // A row without a usable session identity must not leave a plausible session partially imported.
  const uncertainNames = new Set<string>(),
    uncertainDates = new Set<number>();
  let excludeAll = false;
  for (const group of groups.values())
    if (group.uncertainIdentity) {
      if (group.name) uncertainNames.add(group.name);
      if (group.date !== undefined) uncertainDates.add(group.date);
      if (!group.name && group.date === undefined) excludeAll = true;
    }
  for (const candidate of groups.values())
    if (
      excludeAll ||
      uncertainNames.has(candidate.name) ||
      (candidate.date !== undefined && uncertainDates.has(candidate.date))
    )
      candidate.invalid = true;
  for (const [rawKey, group] of groups) {
    if (!group.invalid && group.workout && !group.workout.exercises.length) {
      group.invalid = true;
      draft.issues.push({
        row: group.firstRow,
        field: 'Workout',
        message: 'Workout has no recorded sets.',
        sessionKey: rawKey,
      });
    }
    if (group.invalid || !group.workout) {
      draft.excluded++;
      continue;
    }
    for (const notes of group.pendingNotes.values()) orphanNotes += notes.length;
    group.workout.importSource!.fingerprint = csvId(JSON.stringify(group.records));
    for (const exercise of group.workout.exercises)
      exercise.trackingType = inferTracking(exercise.sets);
    draft.workouts.push(group.workout);
  }
  if (restRows)
    draft.skipped!.push({
      key: 'rest-timer',
      count: restRows,
      title: `${restRows} rest timer row${restRows === 1 ? '' : 's'} not imported`,
      detail: 'Strong stores rest periods as separate rows. They are not sets, so Forge skips them.',
    });
  if (orphanNotes)
    draft.skipped!.push({
      key: 'orphan-note',
      count: orphanNotes,
      title: `${orphanNotes} exercise note${orphanNotes === 1 ? '' : 's'} not imported`,
      detail: 'These Strong notes belong to exercises with no recorded sets in their workout.',
    });
  return draft;
}
