import type { CsvSource } from './types';

export type CsvRecord = Record<string, string>;
export interface AdaptedRow {
  date: string;
  end?: string;
  session: string;
  name: string;
  exercise: string;
  weight: string;
  weightUnit: string;
  reps: string;
  distance: string;
  distanceUnit: string;
  seconds: string;
  duration: string;
  note: string;
  exerciseNote: string;
  comment: string;
  tag: string;
  superset: string;
  rpe: string;
  metadata: CsvRecord;
}
const has = (headers: string[], fields: string[]) =>
  fields.every((field) => headers.includes(field));
export function detectCsvSource(headers: string[]): CsvSource {
  if (has(headers, ['title', 'start_time', 'exercise_title', 'set_index'])) {
    requireHeaders(headers, ['end_time']);
    if (
      !headers.some((field) =>
        ['weight_kg', 'reps', 'duration_seconds', 'distance_km'].includes(field),
      )
    )
      throw new Error('Hevy CSV is missing its measurement columns.');
    return 'hevy';
  }
  if (has(headers, ['workout name', 'exercise name', 'set order'])) {
    requireHeaders(headers, ['date', 'reps']);
    if (!headers.some((value) => /^weight(?: \((?:kg|lbs?)\))?$/.test(value)))
      throw new Error('Strong CSV is missing its Weight column.');
    return 'strong';
  }
  if (has(headers, ['date', 'exercise', 'category', 'reps'])) {
    if (['weight (kg)', 'weight (lbs)', 'weight(kg)', 'weight(lbs)'].some((header) => headers.includes(header))) {
      return 'fitnotes-ios';
    }
    requireHeaders(headers, ['weight']);
    return 'fitnotes';
  }
  throw new Error(
    'Unsupported CSV headers. Choose a workout-history export from Hevy, Strong, or FitNotes.',
  );
}
function requireHeaders(headers: string[], fields: string[]) {
  const missing = fields.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`);
}
export function adaptRow(source: CsvSource, record: CsvRecord): AdaptedRow {
  const base: AdaptedRow = {
    date: '',
    session: '',
    name: '',
    exercise: '',
    weight: '',
    weightUnit: '',
    reps: '',
    distance: '',
    distanceUnit: '',
    seconds: '',
    duration: '',
    note: '',
    exerciseNote: '',
    comment: '',
    tag: '',
    superset: '',
    rpe: '',
    metadata: record,
  };
  if (source === 'hevy')
    return {
      ...base,
      date: record.start_time,
      end: record.end_time,
      session: record.workout_id ?? '',
      name: record.title,
      exercise: record.exercise_title,
      weight: record.weight_kg,
      weightUnit: 'kg',
      reps: record.reps,
      distance: record.distance_km,
      distanceUnit: 'km',
      seconds: record.duration_seconds,
      note: record.description ?? '',
      exerciseNote: record.exercise_notes ?? '',
      tag: record.set_type ?? '',
      superset: record.superset_id ?? '',
      rpe: record.rpe ?? '',
    };
  if (source === 'strong')
    return {
      ...base,
      date: record.date,
      session: record['workout #'] ?? record['workout#'] ?? '',
      name: record['workout name'],
      exercise: record['exercise name'],
      weight:
        record['weight (kg)'] ?? record['weight (lbs)'] ?? record['weight (lb)'] ?? record.weight,
      weightUnit:
        record['weight (kg)'] !== undefined
          ? 'kg'
          : record['weight (lbs)'] !== undefined || record['weight (lb)'] !== undefined
            ? 'lb'
            : (record['weight unit'] ?? ''),
      reps: record.reps,
      distance: record['distance (meters)'] ?? record.distance ?? '',
      distanceUnit: record['distance (meters)'] !== undefined ? 'm' : record['distance unit'] ?? '',
      seconds: record.seconds ?? '',
      duration: record['duration (sec)'] ?? record.durationsec ?? record.duration ?? '',
      note: record['workout notes'] ?? '',
      comment: record.notes ?? '',
      rpe: record.rpe ?? '',
      tag: record['set type'] ?? record['set order'] ?? '',
    };
  const ios = source === 'fitnotes-ios';
  const kg = record['weight (kg)'] ?? record['weight(kg)'],
    lb = record['weight (lbs)'] ?? record['weight(lbs)'];
  return {
    ...base,
    date: record.date,
    name: 'FitNotes workout',
    exercise: record.exercise,
    weight: ios ? (kg?.trim() ? kg : (lb ?? '')) : record.weight,
    weightUnit: ios ? (kg?.trim() ? 'kg' : 'lb') : (record['weight unit'] ?? ''),
    reps: record.reps,
    distance: record.distance ?? '',
    distanceUnit: record['distance unit'] ?? '',
    seconds: record.time ?? '',
    comment: record.comment ?? record.notes ?? '',
    tag: record.kind ?? '',
  };
}
