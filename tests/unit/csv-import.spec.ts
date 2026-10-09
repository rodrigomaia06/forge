import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseWorkoutCsv, parseWorkoutCsvAsync } from '../../src/data/csvImport/parse';
import { readCsv } from '../../src/data/csvImport/csv';
import { csvSessionChanges } from '../../src/data/csvImport/changes';
import {
  applyCsvResolutions,
  customCsvExercise,
  matchCsvSessions,
  prepareCsvCommit,
  resolveCsvExercises,
  reviewStamp,
} from '../../src/data/csvImport/review';
import { recoverCsvImport, writeCsvImport } from '../../src/data/csvImport/webStorage';
import type { CsvDraft, CsvImportRequest } from '../../src/data/csvImport/types';
import type { ExerciseCatalogItem } from '../../src/data/exerciseCatalog';
import { normalizeDataTransfer } from '../../src/data/dataTransferNormalization';
import { effectiveTracking, measurementsFor } from '../../src/domain/exercises/tracking';

const header =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';
const record = (
  name = 'Morning',
  date = '2026-09-20 08:00:00',
  weight = '50',
  exercise = 'Bench Press',
) =>
  `${name},${date},2026-09-20 09:00:00,Session note,${exercise},1,Exercise note,0,warmup,${weight},8,,,8`;
const csv = (weight = '50') => `${header}\n${record('Morning', undefined, weight)}`;
const bench: ExerciseCatalogItem = {
  id: 'bench',
  name: 'Bench Press',
  aliases: ['Barbell Bench'],
  group: 'Bench Press',
  category: 'Strength',
  equipment: 'Barbell',
  primaryMuscle: 'Chest',
  secondaryMuscles: [],
  workoutTypeIds: [],
  trackingType: 'weight-reps',
};
function request(
  draft: CsvDraft,
  current: Parameters<typeof matchCsvSessions>[1] = [],
): CsvImportRequest {
  const resolutions = resolveCsvExercises(draft, [bench], {});
  for (const resolution of resolutions)
    if (!resolution.exercise) {
      resolution.custom = true;
      resolution.exercise = customCsvExercise(resolution);
    }
  const incoming = applyCsvResolutions(draft, resolutions);
  return {
    draft,
    selected: incoming.map((workout) => workout.id),
    resolutions,
    choices: {},
    acknowledged: true,
    reviewed: Object.fromEntries(
      matchCsvSessions(incoming, current).map((match) => [match.workout.id, reviewStamp(match)]),
    ),
  };
}
test('Hevy retains notes, supersets, source fields, measurements and warm-up tags', () => {
  const draft = parseWorkoutCsv(csv());
  expect(draft.source).toBe('hevy');
  expect(draft.issues).toEqual([]);
  const workout = draft.workouts[0],
    exercise = workout.exercises[0],
    set = exercise.sets[0];
  expect(workout.durationSeconds).toBe(3600);
  expect(workout.note).toBe('Session note');
  expect(exercise.note).toBe('Exercise note');
  expect(exercise.supersetId).toBe('1');
  expect(set.tag).toBe('Warm Up');
  expect(set.measurements?.map((entry) => entry.value)).toEqual([50, 8, 8]);
  expect(set.importMetadata?.set_index).toBe('0');
});
test('mixed imported measurements survive resolution and backup beyond the selected tracking mode', () => {
  const draft = parseWorkoutCsv(`${header}\nMorning,2026-09-20 08:00:00,2026-09-20 09:00:00,,Timed lift,,,0,normal,50,8,1,30,8`);
  for (const trackingType of ['weight-reps', 'weighted-bodyweight', 'assisted-bodyweight-duration'] as const) {
    const target = { ...bench, trackingType };
    const resolutions = resolveCsvExercises(draft, [target], {});
    resolutions[0].exercise = target;
    const block = applyCsvResolutions(draft, resolutions)[0].exercises[0];
    const set = block.sets[0];
    expect(measurementsFor(effectiveTracking(block), set).map((entry) => entry.kind)).toEqual([
      'weight', 'reps', 'distance', 'duration', 'rpe',
    ]);
    const restored = normalizeDataTransfer({ settings: {}, plans: {}, workouts: { completedWorkouts: [applyCsvResolutions(draft, resolutions)[0]] } });
    expect(restored.workouts.completedWorkouts[0].exercises[0].sets[0].measurements).toEqual(set.measurements);
  }
});
test('changed-session review exposes measurements, notes and removed sets', () => {
  const before = parseWorkoutCsv(csv()).workouts[0];
  const after = parseWorkoutCsv(csv('55')).workouts[0];
  after.note = 'Changed note';
  expect(csvSessionChanges(before, after)).toEqual([
    { label: 'Session note', before: 'Session note', after: 'Changed note' },
    {
      label: 'Bench Press, set 1',
      before: '50 kg · 8 reps · 8 RPE · Warm Up',
      after: '55 kg · 8 reps · 8 RPE · Warm Up',
    },
  ]);
  after.exercises[0].sets = [];
  expect(csvSessionChanges(before, after).at(-1)?.after).toBe('No set');
  expect(csvSessionChanges(before, before)).toEqual([]);
});
test('cooperative parsing yields to other work and preserves synchronous results', async () => {
  const text = `${header}\n${Array.from({ length: 900 }, (_, index) => record(`Session ${index}`)).join('\n')}`;
  let ticks = 0;
  const ticker = setInterval(() => ticks++, 0);
  try {
    expect(await parseWorkoutCsvAsync(text)).toEqual(parseWorkoutCsv(text));
  } finally {
    clearInterval(ticker);
  }
  expect(ticks).toBeGreaterThan(2);
});
test('multiple candidate identities cannot replace an ambiguous session', () => {
  const original = parseWorkoutCsv(csv());
  const first = prepareCsvCommit(request(original), [], [], [bench]).workouts[0];
  const current = [
    first,
    {
      ...first,
      id: 'second',
      note: 'Different',
      importSource: { ...first.importSource!, fingerprint: 'other' },
    },
  ];
  const changed = parseWorkoutCsv(csv('65')),
    req = request(changed, current);
  expect(matchCsvSessions(applyCsvResolutions(changed, req.resolutions), current)[0].status).toBe(
    'ambiguous',
  );
  req.choices[changed.workouts[0].id] = 'replace';
  expect(() => prepareCsvCommit(req, current, [], [bench])).toThrow('ambiguous');
});
test('BOM, escaped quotes, quoted commas and multiline records retain source row numbers', () => {
  const { headers, rows } = readCsv(
    '\uFEFFName,Notes\r\n"A, B","first\nsecond ""quoted"""\r\nC,end',
  );
  expect(headers).toEqual(['name', 'notes']);
  expect(rows[0].values[1]).toBe('first\nsecond "quoted"');
  expect(rows[1].row).toBe(4);
});
for (const date of [
  '03 Mar 2025, 18:00',
  '3 févr. 2025, 18:00',
  '3 août 2025, 18:00',
  '3 set. 2025, 18:00',
  '3 diciembre 2025, 18:00',
  'Aug 3, 2025, 18:00',
]) {
  test(`Hevy localized quoted timestamp ${date}`, () => {
    const draft = parseWorkoutCsv(
      `title,start_time,end_time,exercise_title,set_index,weight_kg,reps\nPush,"${date}","${date}",Bench Press,0,50,8`,
    );
    expect(draft.issues).toEqual([]);
    expect(draft.workouts).toHaveLength(1);
  });
}
test('interleaved Hevy supersets preserve first exercise order and each exercise’s set order', () => {
  const lines = ['A', 'B', 'A', 'B'].map(
    (name, index) => `Push,"3 févr. 2025, 18:00","3 févr. 2025, 19:00",${name},0,${index},50,8`,
  );
  const draft = parseWorkoutCsv(
    `title,start_time,end_time,exercise_title,superset_id,set_index,weight_kg,reps\n${lines.join('\n')}`,
  );
  expect(draft.workouts[0].exercises.map((exercise) => exercise.name)).toEqual(['A', 'B']);
  expect(draft.workouts[0].exercises[0].sets.map((set) => set.importMetadata?.set_index)).toEqual([
    '0',
    '2',
  ]);
});
test('source metadata and notes keep whitespace and embedded newlines', () => {
  const text = csv().replace('Session note', '"  line one\nline two  "');
  const workout = parseWorkoutCsv(text).workouts[0];
  expect(workout.note).toBe('  line one\nline two  ');
  expect(workout.exercises[0].sets[0].importMetadata?.description).toBe(workout.note);
});
for (const text of [
  '',
  'Date,Date\n1,2',
  'Date,\n1,2',
  'Date,Exercise',
  'Date,Exercise\n"broken,entry',
]) {
  test(`rejects malformed or empty CSV ${JSON.stringify(text)}`, () =>
    expect(() => parseWorkoutCsv(text)).toThrow());
}
test('Strong legacy asks for source weight units and date order', () => {
  const text =
    'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n09/10/2026,Push,1h 5m,Bench Press,1,100,8,,0,Set note,Workout note,9';
  expect(parseWorkoutCsv(text).requirements).toContain('dateOrder');
  expect(parseWorkoutCsv(text, { dateOrder: 'day-first' }).requirements).toEqual(['weightUnit']);
  const draft = parseWorkoutCsv(text, { dateOrder: 'day-first', weightUnit: 'lb' });
  expect(draft.workouts[0].durationSeconds).toBe(3900);
  expect(draft.workouts[0].exercises[0].sets[0].measurements?.[0].value).toBeCloseTo(45.359237);
  expect(draft.workouts[0].exercises[0].trackingType).toBe('weight-reps');
});
test('Strong current semicolon/decimal comma handles distinct same-day session IDs', () => {
  const text =
    'Workout#;Date;Workout Name;DurationSec;Exercise Name;Set Order;Weight;Reps;Distance;Seconds\n1;2026-09-20 08:00:00;Push;1200;Bench Press;1;50,5;8;;\n2;2026-09-20 08:00:00;Push;600;Bench Press;1;55;6;;';
  const draft = parseWorkoutCsv(text, { weightUnit: 'kg' });
  expect(draft.workouts).toHaveLength(2);
  expect(draft.workouts[0].id).not.toBe(draft.workouts[1].id);
  expect(draft.workouts[0].exercises[0].sets[0].weight).toBe('50.5');
});
test('FitNotes Android converts units and groups by date with a disclosed limitation', () => {
  const text =
    'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment\n2026-09-20,Run,Cardio,,, ,1,mi,05:30,Outdoor\n2026-09-20,Bench Press,Chest,50,kg,8,,,,Work';
  const draft = parseWorkoutCsv(text);
  expect(draft.workouts).toHaveLength(1);
  expect(draft.limitations.join(' ')).toContain('cannot be reconstructed');
  expect(draft.workouts[0].exercises[0].sets[0].measurements?.map((entry) => entry.value)).toEqual([
    1.609344, 330,
  ]);
  expect(draft.workouts[0].durationSeconds).toBeUndefined();
});
test('FitNotes iOS recognizes explicit weight columns, Kind and Notes', () => {
  const draft = parseWorkoutCsv(
    'Date,Exercise,Category,Weight(kg),Weight(lbs),Reps,Distance,Distance Unit,Time,Notes,Kind\n2026-09-20,Bench Press,Chest,,100,8,,,,Note,W',
  );
  expect(draft.source).toBe('fitnotes-ios');
  expect(draft.workouts[0].exercises[0].sets[0].weight).toBe('45.359237');
  expect(draft.workouts[0].exercises[0].sets[0].comment).toBe('Note');
});
for (const [file, source, count, options] of [
  ['hevy-sample.csv', 'hevy', 2, {}],
  ['strong-classic-sample.csv', 'strong', 1, { weightUnit: 'kg' }],
  ['strong-modern-semicolon-sample.csv', 'strong', 1, {}],
  ['fitnotes-android-sample.csv', 'fitnotes', 1, {}],
  ['fitnotes-ios-sample.csv', 'fitnotes-ios', 2, {}],
] as const) {
  test(`user-provided ${file} preserves its workouts, set order and measurements`, () => {
    const draft = parseWorkoutCsv(readFileSync(resolve('tests/fixtures/csv-import', file), 'utf8'), options);
    expect(draft.source).toBe(source);
    expect(draft.issues).toEqual([]);
    expect(draft.requirements).toEqual([]);
    expect(draft.workouts).toHaveLength(count);
    const sets = draft.workouts[0].exercises[0].sets;
    expect(sets.map((set) => set.weight)).toEqual(source === 'hevy' ? ['40', '80', '82.5'] : ['80', '85']);
    if (source === 'strong') expect(draft.workouts[0].durationSeconds).toBe(3300);
    if (source === 'fitnotes-ios') {
      const run = draft.workouts[1].exercises[0].sets[0];
      expect(run.measurements?.map(({ kind, value }) => [kind, value])).toEqual([['distance', 5], ['duration', 1800]]);
      expect(run.comment).toBe('Easy pace');
    }
  });
}
for (const [unit, expected] of [['km', 100], ['m', 0.1], ['cm', 0.001], ['in', 0.00254], ['ft', 0.03048], ['yd', 0.09144], ['mi', 160.9344]] as const) {
  test(`FitNotes iOS converts documented ${unit} distances`, () => {
    const draft = parseWorkoutCsv(`Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind\n2026-09-20,Walk,Cardio,,,,100,${unit},01:00,,dt`);
    expect(draft.issues).toEqual([]);
    expect(draft.workouts[0].exercises[0].sets[0].measurements?.find((entry) => entry.kind === 'distance')?.value).toBeCloseTo(expected, 8);
  });
}
test('Strong spaced session ID, duration and metre headers preserve identity and values', () => {
  const text = 'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,Distance (meters),Seconds\n7,2026-09-20 08:00:00,Run,3300,Run,1,,,1500,600';
  const draft = parseWorkoutCsv(text);
  expect(draft.issues).toEqual([]);
  expect(draft.workouts[0].durationSeconds).toBe(3300);
  expect(draft.workouts[0].importSource?.sessionKey).toBe('["strong","7"]');
  expect(draft.workouts[0].exercises[0].sets[0].measurements?.map(({ kind, value }) => [kind, value])).toEqual([['distance', 1.5], ['duration', 600]]);
  expect(parseWorkoutCsv(text.replace(',Run,3300,', ',Renamed run,3300,')).workouts[0].id).toBe(draft.workouts[0].id);
});
test('bad row excludes its complete session but preserves independent valid sessions', () => {
  const draft = parseWorkoutCsv(
    `${csv()}\n${record('Morning', undefined, 'Infinity')}\n${record('Evening')}`,
  );
  expect(draft.workouts.map((workout) => workout.name)).toEqual(['Evening']);
  expect(draft.excluded).toBe(1);
  expect(draft.issues[0]).toMatchObject({ row: 3, field: 'Weight' });
  const req = request(draft);
  req.acknowledged = false;
  expect(() => prepareCsvCommit(req, [], [], [bench])).toThrow('Acknowledge');
});
test('missing session identity never leaves a plausible workout partially imported', () => {
  const draft = parseWorkoutCsv(
    `${csv()}\n${record('Morning', 'invalid-date')}\n${record('Evening')}`,
  );
  expect(draft.workouts.map((workout) => workout.name)).toEqual(['Evening']);
  expect(draft.issues[0].field).toBe('Date');
});
test('invalid date, measurement, unit, end time and missing columns produce actionable errors', () => {
  expect(
    parseWorkoutCsv(csv().replace('2026-09-20 08:00:00', '2026-02-31 08:00:00')).issues[0].field,
  ).toBe('Date');
  expect(parseWorkoutCsv(csv().replace(',8,,,8', ',8.5,,,8')).issues[0].field).toBe('Reps');
  expect(parseWorkoutCsv(csv().replace(',8,,,8', ',8,,,11')).issues[0].field).toBe('RPE');
  expect(parseWorkoutCsv(csv().replace('09:00:00', '07:00:00')).issues[0].field).toBe('End time');
  expect(() => parseWorkoutCsv('title,start_time,exercise_title,set_index\nA,B,C,D')).toThrow(
    'required columns',
  );
});
test('matches only unique exact names/aliases and revalidates remembered exercise targets', () => {
  const draft = parseWorkoutCsv(csv());
  const duplicate = { ...bench, id: 'other', aliases: [] };
  expect(resolveCsvExercises(draft, [bench, duplicate], {})[0].exercise).toBeUndefined();
  expect(resolveCsvExercises(draft, [bench], { 'hevy:bench press': 'removed' })[0].remembered).toBe(
    false,
  );
  expect(resolveCsvExercises(draft, [bench], { 'hevy:bench press': 'bench' })[0].remembered).toBe(
    true,
  );
  expect(
    resolveCsvExercises(parseWorkoutCsv(csv().replace('Bench Press', 'Bench')), [bench], {})[0]
      .exercise,
  ).toBeUndefined();
});
test('catalogue resolution preserves imported measurements across incompatible and loaded tracking modes', () => {
  const draft = parseWorkoutCsv(csv());
  const resolution = resolveCsvExercises(draft, [bench], {});
  resolution[0].exercise = { ...bench, trackingType: 'reps-only' };
  const incompatible = applyCsvResolutions(draft, resolution)[0].exercises[0];
  expect(incompatible.trackingOverride).toBe('weight-reps');
  expect(incompatible.sets[0].measurements).toEqual(
    draft.workouts[0].exercises[0].sets[0].measurements,
  );
  resolution[0].exercise = { ...bench, trackingType: 'weighted-bodyweight' };
  const loaded = applyCsvResolutions(draft, resolution)[0].exercises[0];
  expect(loaded.sets[0].measurements?.[0]).toMatchObject({
    kind: 'addedWeight',
    value: 50,
    unit: 'kg',
  });
  expect(loaded.trackingOverride).toBeUndefined();
});
test('unknown exercise creates one custom definition only when selected sessions reference it', () => {
  const draft = parseWorkoutCsv(csv().replace('Bench Press', 'Mystery Lift'));
  const req = request(draft),
    next = prepareCsvCommit(req, [], [], [bench]);
  expect(next.additions).toHaveLength(1);
  expect(next.additions[0].primaryMuscle).toBe('');
  req.selected = [];
  expect(prepareCsvCommit(req, [], [], [bench]).additions).toEqual([]);
});
test('custom definitions reuse the provider’s variation identity and retired IDs are not reclaimed', () => {
  const draft = parseWorkoutCsv(csv().replace('Bench Press', 'Mystery Lift'));
  const req = request(draft);
  const existing = { ...req.resolutions[0].exercise!, id: 'existing-custom' };
  const next = prepareCsvCommit(req, [], [existing], [bench, existing]);
  expect(next.additions).toEqual([]);
  expect(next.writes[0].exercises[0].exerciseId).toBe('existing-custom');
  const fresh = customCsvExercise(req.resolutions[0]);
  expect(fresh.id).not.toBe(existing.id);
  expect(fresh.id).not.toBe(req.resolutions[0].exercise!.id);
});
test('reimport skips duplicates even after local edits; changed sources require explicit choices', () => {
  const draft = parseWorkoutCsv(csv());
  const first = prepareCsvCommit(request(draft), [], [], [bench]);
  const edited = first.workouts.map((workout) => ({ ...workout, note: 'Local edit' }));
  expect(prepareCsvCommit(request(draft, edited), edited, [], [bench]).result.duplicates).toBe(1);
  const changed = parseWorkoutCsv(csv('55')),
    req = request(changed, edited);
  expect(prepareCsvCommit(req, edited, [], [bench]).writes).toEqual([]);
  req.choices[changed.workouts[0].id] = 'replace';
  expect(prepareCsvCommit(req, edited, [], [bench]).result.replaced).toBe(1);
  req.choices[changed.workouts[0].id] = 'both';
  const both = prepareCsvCommit(req, edited, [], [bench]);
  expect(both.workouts).toHaveLength(2);
  expect(
    matchCsvSessions(applyCsvResolutions(changed, req.resolutions), both.workouts)[0].status,
  ).toBe('duplicate');
});
test('source session IDs survive renamed sessions and source-only changes require review', () => {
  const text = `workout_id,${csv().replace('\n', '\nsource-1,')}`;
  const draft = parseWorkoutCsv(text);
  const existing = prepareCsvCommit(request(draft), [], [], [bench]).workouts;
  const renamed = parseWorkoutCsv(text.replace('Morning', 'Renamed'));
  expect(renamed.workouts[0].id).toBe(draft.workouts[0].id);
  expect(
    matchCsvSessions(applyCsvResolutions(renamed, request(renamed).resolutions), existing)[0]
      .status,
  ).toBe('changed');
  const metadataOnly = parseWorkoutCsv(text.replace(',warmup,', ',W,'));
  expect(
    matchCsvSessions(
      applyCsvResolutions(metadataOnly, request(metadataOnly).resolutions),
      existing,
    )[0].status,
  ).toBe('changed');
  const manual = { ...existing[0], importSource: undefined };
  expect(matchCsvSessions(existing, [manual])[0].status).toBe('duplicate');
});
test('commit detects changes since review and removed exercise mappings', () => {
  const draft = parseWorkoutCsv(csv()),
    req = request(draft);
  const prior = prepareCsvCommit(req, [], [], [bench]).workouts;
  expect(() =>
    prepareCsvCommit(
      req,
      prior.map((workout) => ({
        ...workout,
        note: 'Changed after review',
        importSource: { ...workout.importSource!, fingerprint: 'other' },
      })),
      [],
      [bench],
    ),
  ).toThrow('changed during review');
  expect(() => prepareCsvCommit(req, [], [], [])).toThrow('no longer available');
});
test('provenance and source-only fields survive Forge transfer normalization', () => {
  const workout = parseWorkoutCsv(csv()).workouts[0];
  const transfer = normalizeDataTransfer({
    settings: {},
    plans: {},
    workouts: { completedWorkouts: [workout] },
  });
  expect(transfer.workouts.completedWorkouts[0].importSource).toEqual(workout.importSource);
  expect(transfer.workouts.completedWorkouts[0].exercises[0].sets[0].importMetadata).toEqual(
    workout.exercises[0].sets[0].importMetadata,
  );
});
function storage(initial: Record<string, string> = {}) {
  const values = { ...initial };
  let fail = '';
  return {
    values,
    failNext: (key: string) => {
      fail = key;
    },
    getItem: async (key: string) => values[key] ?? null,
    setItem: async (key: string, value: string) => {
      if (fail === key) {
        fail = '';
        throw new Error('Storage full');
      }
      values[key] = value;
    },
    removeItem: async (key: string) => {
      delete values[key];
    },
  };
}
test('duplicate-only reviews save confirmed matches atomically without rewriting workouts', async () => {
  const draft = parseWorkoutCsv(csv());
  const original = applyCsvResolutions(draft, resolveCsvExercises(draft, [bench], {}));
  const req = request(draft, original);
  const resolution = req.resolutions[0];
  resolution.confirmed = true;
  resolution.custom = true;
  resolution.exercise = customCsvExercise({ ...resolution, name: 'My confirmed bench' });
  req.confirmedMappingKeys = [resolution.key];
  req.selected = [];
  const before = JSON.stringify(original);
  const store = storage({ '@forge/completed-workouts': before, '@forge/csv-exercise-mappings-v1': JSON.stringify({ unrelated: 'kept', [resolution.key]: bench.id }) });
  store.failNext('@forge/csv-exercise-mappings-v1');
  await expect(writeCsvImport(store, req, [bench])).rejects.toThrow('Storage full');
  expect(store.values['@forge/completed-workouts']).toBe(before);
  expect(store.values['@forge/custom-exercises']).toBeUndefined();
  expect(JSON.parse(store.values['@forge/csv-exercise-mappings-v1'])[resolution.key]).toBe(bench.id);
  const result = await writeCsvImport(store, req, [bench]);
  expect(result).toMatchObject({ added: 0, replaced: 0, duplicates: 1, mappingsSaved: 1, customExercises: 1 });
  expect(store.values['@forge/completed-workouts']).toBe(before);
  const custom = JSON.parse(store.values['@forge/custom-exercises']);
  const mappings = JSON.parse(store.values['@forge/csv-exercise-mappings-v1']);
  expect(mappings.unrelated).toBe('kept');
  expect(resolveCsvExercises(draft, [bench, ...custom], mappings)[0].exercise?.id).toBe(resolution.exercise.id);
  resolution.exercise = customCsvExercise({ ...resolution, name: 'My confirmed bench' });
  expect(prepareCsvCommit(req, original, custom, [bench, ...custom]).result.customExercises).toBe(0);
  req.reviewed = {};
  expect(() => prepareCsvCommit(req, original, [], [bench])).toThrow('Workouts changed');
});
test('mapping-only reviews reject removed targets and unconfirmed source identities', () => {
  const draft = parseWorkoutCsv(csv());
  const current = applyCsvResolutions(draft, resolveCsvExercises(draft, [bench], {}));
  const req = request(draft, current);
  req.resolutions[0].confirmed = true;
  req.confirmedMappingKeys = [req.resolutions[0].key];
  expect(() => prepareCsvCommit(req, current, [], [])).toThrow('no longer available');
  req.confirmedMappingKeys = ['not-in-this-file'];
  expect(() => prepareCsvCommit(req, current, [], [bench])).toThrow('Review the exercise matches');
  req.confirmedMappingKeys = [req.resolutions[0].key];
  req.resolutions[0].confirmed = false;
  expect(() => prepareCsvCommit(req, current, [], [bench])).toThrow('Review the exercise matches');
});
test('browser save rolls back all touched keys and can retry', async () => {
  const store = storage({
    '@forge/completed-workouts': '[]',
    '@forge/settings-preferences': 'keep',
  });
  store.failNext('@forge/custom-exercises');
  const req = request(parseWorkoutCsv(csv()));
  let failure;
  try {
    await writeCsvImport(store, req, [bench]);
  } catch (error) {
    failure = error;
  }
  expect(String(failure)).toContain('Storage full');
  expect(store.values['@forge/completed-workouts']).toBe('[]');
  expect(store.values['@forge/csv-exercise-mappings-v1']).toBeUndefined();
  const result = await writeCsvImport(store, req, [bench]);
  expect(result.added).toBe(1);
  expect(store.values['@forge/settings-preferences']).toBe('keep');
});
test('browser interrupted journal restores originals and rejects corrupt archives before writing', async () => {
  const original: [string, string | null][] = [
    ['@forge/completed-workouts', '[]'],
    ['@forge/custom-exercises', null],
    ['@forge/csv-exercise-mappings-v1', null],
  ];
  const store = storage({
    '@forge/csv-import-recovery-v1': JSON.stringify(original),
    '@forge/completed-workouts': '[{"id":"partial"}]',
  });
  await recoverCsvImport(store);
  expect(store.values['@forge/completed-workouts']).toBe('[]');
  store.values['@forge/completed-workouts'] = '{broken';
  let failure;
  try {
    await writeCsvImport(store, request(parseWorkoutCsv(csv())), [bench]);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeTruthy();
  expect(store.values['@forge/completed-workouts']).toBe('{broken');
});
test('native CSV import uses one transaction and rolls back when a mapping write fails', async () => {
  const source = ts.transpileModule(readFileSync('src/data/csvImportRepository.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, any> = {};
  let stored: string[] = [],
    transactions = 0,
    fail = true;
  let archive: ReturnType<typeof applyCsvResolutions> = [];
  const db = {
    getAllAsync: async (sql: string) => sql.includes('is_active = 0') ? archive.map((workout) => ({ value_json: JSON.stringify(workout) })) : [],
    getFirstAsync: async () => null,
    runAsync: async (sql: string) => {
      stored.push(sql);
      if (fail && sql.includes('forge_meta')) throw new Error('Disk full');
    },
  };
  const mocks: Record<string, unknown> = {
    './database': {
      database: async () => db,
      withDatabaseTransaction: async (work: (db: unknown) => Promise<void>) => {
        transactions++;
        const before = [...stored];
        try {
          await work(db);
        } catch (error) {
          stored = before;
          throw error;
        }
      },
    },
    './exerciseCatalog': { exerciseCatalog: [bench] },
    './workoutRepository': { completedWorkoutUpsert: 'INSERT INTO workouts' },
    './workoutNormalization': { normalizePersistedWorkout: (value: unknown) => value },
    './csvImport/review': { prepareCsvCommit },
  };
  runInNewContext(source, { exports, require: (name: string) => mocks[name] });
  let failure;
  try {
    await exports.commitCsvImport(request(parseWorkoutCsv(csv())));
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeTruthy();
  expect(transactions).toBe(1);
  expect(stored).toEqual([]);
  fail = false;
  expect((await exports.commitCsvImport(request(parseWorkoutCsv(csv())))).added).toBe(1);
  expect(transactions).toBe(2);
  const draft = parseWorkoutCsv(csv());
  archive = applyCsvResolutions(draft, resolveCsvExercises(draft, [bench], {}));
  const req = request(draft, archive);
  req.resolutions[0] = { ...req.resolutions[0], confirmed: true, custom: true, exercise: customCsvExercise({ ...req.resolutions[0], name: 'Native mapping target' }) };
  req.confirmedMappingKeys = [req.resolutions[0].key];
  stored = [];
  fail = true;
  failure = undefined;
  try { await exports.commitCsvImport(req); } catch (error) { failure = error; }
  expect(String(failure)).toContain('Disk full');
  expect(stored).toEqual([]);
  fail = false;
  expect(await exports.commitCsvImport(req)).toMatchObject({ added: 0, replaced: 0, mappingsSaved: 1, customExercises: 1 });
  expect(stored.some((sql) => sql.includes('INSERT INTO workouts'))).toBe(false);
  expect(stored.some((sql) => sql.includes('INSERT INTO custom_exercises'))).toBe(true);
  expect(transactions).toBe(4);
});
