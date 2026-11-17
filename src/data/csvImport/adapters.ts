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
  /** Unit of the session duration when the header states it. */
  durationUnit: '' | 'sec' | 'min';
  /** Strong writes rest periods and exercise notes as pseudo-set rows. */
  kind: 'set' | 'rest' | 'note';
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
        [
          'weight_kg',
          'weight_lbs',
          'reps',
          'duration_seconds',
          'distance_km',
          'distance_miles',
        ].includes(field),
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
    if (
      ['weight (kg)', 'weight (lbs)', 'weight(kg)', 'weight(lbs)'].some((header) =>
        headers.includes(header),
      )
    ) {
      return 'fitnotes-ios';
    }
    requireHeaders(headers, ['weight']);
    return 'fitnotes';
  }
  throw new Error(
    'Unsupported CSV headers. Choose an unedited workout-history export from Hevy, Strong, or FitNotes. If the app exports in another language, switch it to English and export again.',
  );
}
const firstPresent = (record: CsvRecord, fields: string[]) => {
  const field = fields.find((name) => record[name] !== undefined);
  return field === undefined ? undefined : { field, value: record[field] };
};
const strongDistance: Array<[string, string]> = [
  ['distance (meters)', 'm'],
  ['distance (metres)', 'm'],
  ['distance (m)', 'm'],
  ['distance (km)', 'km'],
  ['distance (miles)', 'mi'],
  ['distance (mi)', 'mi'],
  ['distance (feet)', 'ft'],
  ['distance (ft)', 'ft'],
];
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
    durationUnit: '',
    kind: 'set',
    metadata: record,
  };
  if (source === 'hevy') {
    // Imperial accounts export weight_lbs/distance_miles; prefer the metric column when it has a value.
    const metricWeight = Boolean(record.weight_kg?.trim()) || record.weight_lbs === undefined;
    const metricDistance =
      Boolean(record.distance_km?.trim()) || record.distance_miles === undefined;
    return {
      ...base,
      date: record.start_time,
      end: record.end_time,
      session: record.workout_id ?? '',
      name: record.title,
      exercise: record.exercise_title,
      weight: (metricWeight ? record.weight_kg : record.weight_lbs) ?? '',
      weightUnit: metricWeight ? 'kg' : 'lb',
      reps: record.reps,
      distance: (metricDistance ? record.distance_km : record.distance_miles) ?? '',
      distanceUnit: metricDistance ? 'km' : 'mi',
      seconds: record.duration_seconds,
      note: record.description ?? '',
      exerciseNote: record.exercise_notes ?? '',
      tag: record.set_type ?? '',
      superset: record.superset_id ?? '',
      rpe: record.rpe ?? '',
    };
  }
  if (source === 'strong') {
    const distance = strongDistance.find(([field]) => record[field] !== undefined);
    const duration = firstPresent(record, [
      'duration (sec)',
      'durationsec',
      'duration (min)',
      'duration',
    ]);
    const order = (record['set order'] ?? '').trim().toLowerCase();
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
      distance: (distance ? record[distance[0]] : record.distance) ?? '',
      distanceUnit: distance ? distance[1] : (record['distance unit'] ?? ''),
      seconds: record.seconds ?? '',
      duration: duration?.value ?? '',
      durationUnit:
        duration?.field === 'duration (min)' ? 'min' : duration?.field === 'duration' ? '' : 'sec',
      kind: order === 'rest timer' ? 'rest' : order === 'note' ? 'note' : 'set',
      note: record['workout notes'] ?? '',
      comment: record.notes ?? '',
      rpe: record.rpe ?? '',
      tag: record['set type'] ?? record['set order'] ?? '',
    };
  }
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
