import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canonicalUnit,
  parseWorkoutCsv,
  parseWorkoutCsvAsync,
} from '../../src/data/csvImport/parse';
import {
  applyCsvResolutions,
  customCsvExercise,
  matchCsvSessions,
  prepareCsvCommit,
  resolveCsvExercises,
  reviewStamp,
} from '../../src/data/csvImport/review';
import type { CsvDraft, CsvImportRequest, CsvOptions } from '../../src/data/csvImport/types';
import type { ExerciseCatalogItem } from '../../src/data/exerciseCatalog';
import type { Workout } from '../../src/types';

/** Fixtures follow published format descriptions; see the import compatibility matrix. */
const fixture = (name: string) =>
  readFileSync(resolve('tests/fixtures/import-compat', name), 'utf8');
const values = (workout: Workout, exercise: number, set: number) =>
  workout.exercises[exercise].sets[set].measurements?.map(({ kind, value }) => [kind, value]);
const bench: ExerciseCatalogItem = {
  id: 'bench',
  name: 'Bench Press',
  aliases: [],
  group: 'Bench Press',
  category: 'Strength',
  equipment: 'Barbell',
  primaryMuscle: 'Chest',
  secondaryMuscles: [],
  workoutTypeIds: [],
  trackingType: 'weight-reps',
};
function request(draft: CsvDraft, current: Workout[] = []): CsvImportRequest {
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

test('source unit spellings resolve to one canonical code', () => {
  expect(['kgs', 'KG', 'kilograms'].map(canonicalUnit)).toEqual(['kg', 'kg', 'kg']);
  expect(['lbs', 'lbs.', 'Pounds'].map(canonicalUnit)).toEqual(['lb', 'lb', 'lb']);
  expect(['mi.', 'miles', 'metres', 'meters', 'feet', 'km'].map(canonicalUnit)).toEqual([
    'mi',
    'mi',
    'm',
    'm',
    'ft',
    'km',
  ]);
  expect(canonicalUnit('stone')).toBe('stone');
});

test('Hevy imperial export reads pound and mile columns with notes, tags and supersets', () => {
  const draft = parseWorkoutCsv(fixture('hevy-imperial.csv'));
  expect(draft.source).toBe('hevy');
  expect(draft.issues).toEqual([]);
  expect(draft.requirements).toEqual([]);
  const [upper, run] = draft.workouts;
  expect(upper.note).toBe('Felt strong\nsecond line');
  expect(upper.durationSeconds).toBe(62 * 60);
  expect(upper.exercises.map((exercise) => exercise.name)).toEqual([
    'Bench Press (Barbell)',
    'Seated Cable Row - V Grip (Cable)',
    'Face Pull Rope Thing',
  ]);
  expect(upper.exercises[0].note).toBe('Pause reps');
  expect(upper.exercises[0].sets.map((set) => set.tag)).toEqual(['Warm Up', undefined]);
  expect(values(upper, 0, 1)?.[0][1]).toBeCloseTo(185 * 0.45359237, 8);
  expect(values(upper, 0, 1)?.find(([kind]) => kind === 'rpe')?.[1]).toBe(8.5);
  expect(upper.exercises[1].supersetId).toBe('0');
  expect(upper.exercises[1].sets.map((set) => set.tag)).toEqual([undefined, 'Drop Set']);
  expect(upper.exercises[2].sets[0].tag).toBe('Failure');
  const distance = values(run, 0, 0);
  expect(distance?.find(([kind]) => kind === 'distance')?.[1]).toBeCloseTo(3.1 * 1.609344, 8);
  expect(distance?.find(([kind]) => kind === 'duration')?.[1]).toBe(1980);
  expect(run.exercises[0].trackingType).toBe('distance-duration');
});

test('Hevy prefers a populated kilogram column over its pound twin', () => {
  const draft = parseWorkoutCsv(
    'title,start_time,end_time,exercise_title,set_index,weight_kg,weight_lbs,reps\nA,2025-01-15T10:00:00Z,2025-01-15T11:00:00Z,Bench Press,0,80,176.37,5',
  );
  expect(draft.workouts[0].exercises[0].sets[0].weight).toBe('80');
});

test('Strong rest timer rows are skipped and reported; note rows become exercise notes', () => {
  const draft = parseWorkoutCsv(fixture('strong-rest-timer-semicolon.csv'));
  expect(draft.source).toBe('strong');
  expect(draft.issues).toEqual([]);
  expect(draft.requirements).toEqual([]);
  expect(draft.workouts.map((workout) => workout.name)).toEqual(['Push', 'Cooldown', 'Mobility']);
  const push = draft.workouts[0];
  expect(push.note).toBe('Gym was busy');
  expect(push.durationSeconds).toBe(3720);
  const benchBlock = push.exercises[0];
  expect(benchBlock.note).toBe('Elbows tucked');
  expect(benchBlock.sets.map((set) => [set.weight, set.reps, set.tag, set.comment])).toEqual([
    ['40', '10', 'Warm Up', ''],
    ['82.5', '5', undefined, 'Smooth'],
    ['82.5', '4', 'Failure', ''],
  ]);
  expect(push.exercises.map((exercise) => exercise.name)).toEqual([
    'Bench Press (Barbell)',
    'Triceps Pushdown (Cable - Straight Bar)',
    'Plank',
  ]);
  expect(push.exercises[2].trackingType).toBe('duration');
  expect(draft.workouts[1].exercises[0].trackingType).toBe('distance-duration');
  expect(values(draft.workouts[1], 0, 0)?.find(([kind]) => kind === 'distance')?.[1]).toBe(2);
  expect(draft.workouts[2].exercises.map((exercise) => exercise.name)).toEqual(['Hip Stretch']);
  expect(draft.skipped?.map(({ key, count }) => [key, count])).toEqual([
    ['rest-timer', 2],
    ['orphan-note', 1],
  ]);
});

test('Strong unit columns convert pounds and dotted mile abbreviations without asking', () => {
  const draft = parseWorkoutCsv(fixture('strong-unit-columns.csv'));
  expect(draft.issues).toEqual([]);
  expect(draft.requirements).toEqual([]);
  const [leg] = draft.workouts;
  expect(leg.durationSeconds).toBe(3720);
  expect(Number(leg.exercises[0].sets[0].weight)).toBeCloseTo(225 * 0.45359237, 8);
  expect(leg.exercises[1].sets[0].tag).toBe('Drop Set');
  expect(Number(leg.exercises[1].sets[0].weight)).toBeCloseTo(37.5 * 0.45359237, 8);
  expect(values(leg, 2, 0)).toEqual([
    ['distance', 6.2 * 1.609344],
    ['duration', 1500],
  ]);
});

test('Strong minute duration headers convert to seconds', () => {
  const draft = parseWorkoutCsv(
    'Workout #,Date,Workout Name,Duration (min),Exercise Name,Set Order,Weight (kg),Reps\n1,2025-01-02 10:00:00,A,55,Squat,1,100,5',
  );
  expect(draft.workouts[0].durationSeconds).toBe(3300);
});

test('FitNotes Android kgs/lbs units, clock times and date grouping', () => {
  const draft = parseWorkoutCsv(fixture('fitnotes-android-units.csv'));
  expect(draft.source).toBe('fitnotes');
  expect(draft.issues).toEqual([]);
  expect(draft.workouts).toHaveLength(2);
  const [first, second] = draft.workouts;
  expect(first.exercises.map((exercise) => exercise.name)).toEqual([
    'Flat Barbell Bench Press',
    'Cable Crossover Something',
    'Treadmill',
  ]);
  expect(first.exercises[0].sets.map((set) => set.weight)).toEqual(['60', '62.5']);
  expect(values(first, 2, 0)).toEqual([
    ['distance', 5],
    ['duration', 1880],
  ]);
  expect(Number(second.exercises[0].sets[0].weight)).toBeCloseTo(315 * 0.45359237, 8);
  expect(values(second, 1, 0)).toEqual([['duration', 90]]);
  expect(first.importSource?.dateOnly).toBe(true);
});

test('localized or unknown headers explain how to export a supported file', () => {
  expect(() => parseWorkoutCsv(fixture('strong-localized-headers.csv'))).toThrow(
    'switch it to English',
  );
});

test('database backups and archives chosen as CSV explain the right path', () => {
  expect(() => parseWorkoutCsv('SQLite format 3\0\u0010\u0000binary')).toThrow('choose Strive');
  expect(() => parseWorkoutCsv('PK\u0003\u0004zipped')).toThrow('Extract the CSV');
});

test('malformed rows exclude their whole session and sessions without sets are reported', () => {
  const draft = parseWorkoutCsv(fixture('strong-malformed-rows.csv'), { weightUnit: 'kg' });
  expect(draft.workouts.map((workout) => workout.name)).toEqual(['Good']);
  expect(draft.excluded).toBe(3);
  expect(draft.issues.map(({ row, field }) => [row, field])).toEqual([
    [3, 'Weight'],
    [5, 'Record'],
    [6, 'Workout'],
  ]);
  expect(draft.issues.at(-1)?.message).toBe('Workout has no recorded sets.');
});

for (const [file, options] of [
  ['hevy-imperial.csv', {}],
  ['strong-rest-timer-semicolon.csv', {}],
  ['strong-unit-columns.csv', {}],
  ['fitnotes-android-units.csv', {}],
] as Array<[string, CsvOptions]>) {
  test(`repeat import of ${file} is skipped as duplicates, custom exercises are reused`, () => {
    const first = prepareCsvCommit(
      request(parseWorkoutCsv(fixture(file), options)),
      [],
      [],
      [bench],
    );
    expect(first.result.added).toBe(first.writes.length);
    expect(first.result.customExercises).toBeGreaterThan(0);
    const again = parseWorkoutCsv(fixture(file), options);
    const second = prepareCsvCommit(
      request(again, first.workouts),
      first.workouts,
      first.customExercises,
      [bench, ...first.customExercises],
    );
    expect(second.result).toMatchObject({ added: 0, replaced: 0, customExercises: 0 });
    expect(second.result.duplicates).toBe(again.workouts.length);
    expect(second.writes).toEqual([]);
    // Source ordering survives the saved records.
    const shape = (workouts: Workout[]) =>
      workouts.map((workout) => [
        workout.startedAt,
        workout.exercises.map((exercise) => exercise.sets.map((set) => set.importMetadata)),
      ]);
    expect(shape(first.writes)).toEqual(shape(again.workouts));
  });
}

test('a large Strong history parses within a scoped time budget and yields while parsing', async () => {
  const header =
    '"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"';
  const lines: string[] = [header];
  for (let workout = 0; workout < 1500; workout++) {
    const day = new Date(Date.UTC(2020, 0, 1) + workout * 86400000).toISOString().slice(0, 10);
    for (let exercise = 0; exercise < 5; exercise++)
      for (let set = 1; set <= 4; set++) {
        lines.push(
          `"${workout}";"${day} 18:00:00";"Session";"3600";"Lift ${exercise}";"${set}";"${50 + set}";"8";"";"";"";"";""`,
        );
        if (set < 4)
          lines.push(
            `"${workout}";"${day} 18:00:00";"Session";"3600";"Lift ${exercise}";"Rest Timer";"";"";"";"";"90";"";""`,
          );
      }
  }
  const text = lines.join('\n');
  const started = performance.now();
  const draft = parseWorkoutCsv(text);
  const elapsed = performance.now() - started;
  expect(draft.workouts).toHaveLength(1500);
  expect(draft.workouts[0].exercises[0].sets).toHaveLength(4);
  expect(draft.skipped?.[0].count).toBe(1500 * 5 * 3);
  expect(elapsed).toBeLessThan(10000);
  let ticks = 0;
  const ticker = setInterval(() => ticks++, 0);
  try {
    expect((await parseWorkoutCsvAsync(text)).workouts).toHaveLength(1500);
  } finally {
    clearInterval(ticker);
  }
  expect(ticks).toBeGreaterThan(10);
  const commitStarted = performance.now();
  const next = prepareCsvCommit(request(draft), [], [], [bench]);
  expect(next.result.added).toBe(1500);
  expect(performance.now() - commitStarted).toBeLessThan(10000);
});
