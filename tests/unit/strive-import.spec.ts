import { expect, test } from '@playwright/test';
import {
  parseStriveSnapshot,
  parseStriveSnapshotAsync,
  striveTables,
  type StriveSnapshot,
} from '../../src/data/striveImport';
import {
  applyCsvResolutions,
  customCsvExercise,
  matchCsvSessions,
  prepareCsvCommit,
  resolveCsvExercises,
  reviewStamp,
} from '../../src/data/csvImport/review';
import { normalizeDataTransfer } from '../../src/data/dataTransferNormalization';
import { routineReviewRecord } from '../../src/data/csvImport/routines';
import { createWorkout } from '../../src/state/workoutMutations';
import { csvSessionChanges } from '../../src/data/csvImport/changes';

function snapshot(): StriveSnapshot {
  return {
    version: 85,
    tables: {
      routines: [],
      routine_exercises: [],
      routine_exercise_sets: [],
      routine_logs: [
        {
          id: 'session',
          name: 'Morning',
          started_at: 1700000000,
          ended_at: 1700003600,
          plan_id: 'source-plan',
        },
      ],
      exercises: [
        {
          id: 'bench',
          name_en: 'Bench Press',
          name_pl: 'Wyciskanie',
          category: 'barbell',
          deleted_at: 1700000000,
        },
      ],
      routine_exercise_logs: [
        {
          id: 'block',
          routine_log_id: 'session',
          exercise_id: 'bench',
          order: 0,
          superset_with: null,
        },
      ],
      routine_exercise_set_logs: [
        {
          id: 'set',
          routine_log_id: 'session',
          routine_exercise_log_id: 'block',
          exercise_id: 'bench',
          order: 0,
          reps: 8,
          weight: 100,
          type: 'dropset',
          rpe: 8.5,
          is_weight_unit_metric: 0,
          is_distance_unit_metric: 1,
          distance: null,
          kcal: 12,
          timer: 60,
        },
      ],
      routine_notes: [
        {
          id: 'note',
          owner_id: 'session',
          pinned: 0,
          note: 'Workout note',
          created_at: 1700000000,
        },
        { id: 'pinned', owner_id: 'bench', pinned: 1, note: 'Global note' },
      ],
      routine_exercise_notes: [
        { id: 'note', owner_id: 'block', type: 'log', note: 'Block note', created_at: 1700000000 },
      ],
    },
  };
}
function withRoutine(): StriveSnapshot {
  const source = snapshot();
  source.tables.routines = [
    {
      id: 'template',
      name: 'Upper',
      description: 'Routine note',
      created_at: 1700000000,
      deleted_at: null,
    },
    { id: 'deleted', name: 'Deleted', created_at: 1700000000, deleted_at: 1700000001 },
  ];
  source.tables.routine_exercises = [
    {
      id: 'template-block',
      routine_id: 'template',
      exercise_id: 'bench',
      order: 0,
      superset_with: null,
    },
  ];
  source.tables.routine_exercise_sets = [
    {
      id: 'template-set',
      routine_id: 'template',
      routine_exercise_id: 'template-block',
      exercise_id: 'bench',
      order: 0,
      reps: null,
      weight: null,
      distance: null,
      rpe: null,
      reps_min: 6,
      reps_max: 10,
      type: 'normal',
      is_weight_unit_metric: 1,
      is_distance_unit_metric: 1,
      timer: 90,
    },
  ];
  return source;
}
test('Strive imports active standalone routines with blank prescribed sets, ranges and portable provenance', () => {
  const draft = parseStriveSnapshot(withRoutine());
  expect(draft.routines).toHaveLength(1);
  expect(draft.excluded).toBe(0);
  const routine = draft.routines![0];
  expect(routine.planId).toBeUndefined();
  expect(routine.note).toBe('Routine note');
  expect(routine.exercises[0].sets![0]).toMatchObject({
    weight: '',
    reps: '',
    plannedTargets: [{ kind: 'reps', minValue: 6, maxValue: 10 }],
    importMetadata: { timer: '90' },
  });
  const workout = createWorkout({
    name: routine.name,
    routineId: routine.id,
    exercises: routine.exercises,
  });
  expect(workout.exercises[0].sets[0].completed).toBe(false);
  expect(workout.exercises[0].sets[0].plannedTargets?.[0].minValue).toBe(6);
  const portable = normalizeDataTransfer({
    format: 'forge',
    version: 1,
    exportedAt: 0,
    settings: {},
    workouts: { completedWorkouts: [], activeWorkout: null },
    plans: { plans: [], standaloneRoutines: [routine] },
  });
  expect(portable.plans.standaloneRoutines[0].importSource).toEqual(routine.importSource);
});
test('Strive routines share exercise resolution and conflicts while preserving existing plan membership', () => {
  const draft = parseStriveSnapshot(withRoutine());
  draft.workouts = [];
  const resolutions = resolveCsvExercises(draft, [], {}).map((resolution) => ({
    ...resolution,
    custom: true,
    exercise: customCsvExercise(resolution),
  }));
  const incoming = applyCsvResolutions(draft, resolutions);
  const request = {
    draft,
    selected: incoming.map((record) => record.id),
    resolutions,
    choices: {},
    reviewed: Object.fromEntries(
      matchCsvSessions(incoming, []).map((match) => [match.workout.id, reviewStamp(match)]),
    ),
    acknowledged: true,
  };
  const first = prepareCsvCommit(request, [], [], []);
  expect(first.writes).toEqual([]);
  expect(first.workouts).toEqual([]);
  expect(first.result).toMatchObject({ added: 0, routinesAdded: 1, customExercises: 1 });
  const existing = { ...first.routineWrites[0], planId: 'user-plan', name: 'Locally edited' };
  const current = [routineReviewRecord(existing)];
  expect(matchCsvSessions(incoming, current)[0].status).toBe('duplicate');
  const changed = withRoutine();
  changed.tables.routine_exercise_sets[0].reps_max = 12;
  const updated = parseStriveSnapshot(changed);
  updated.workouts = [];
  const next = applyCsvResolutions(updated, resolutions);
  const match = matchCsvSessions(next, current)[0];
  expect(match.status).toBe('changed');
  expect(
    csvSessionChanges(current[0], next[0]).some((change) => change.after.includes('6–12')),
  ).toBe(true);
  const reviewed = { [next[0].id]: reviewStamp(match) };
  const req = {
    ...request,
    draft: updated,
    reviewed,
    choices: { [next[0].id]: 'replace' as const },
  };
  expect(
    prepareCsvCommit({ ...req, choices: {} }, [], first.additions, first.additions, [existing])
      .routineWrites,
  ).toEqual([]);
  const replace = prepareCsvCommit(req, [], first.additions, first.additions, [existing]);
  expect(replace.routineWrites[0]).toMatchObject({ id: existing.id, planId: 'user-plan' });
  expect(replace.result).toMatchObject({ replaced: 0, routinesReplaced: 1 });
  expect(
    prepareCsvCommit(
      { ...req, choices: { [next[0].id]: 'both' } },
      [],
      first.additions,
      first.additions,
      [existing],
    ).routineWrites[0].planId,
  ).toBeUndefined();
  expect(() =>
    prepareCsvCommit(req, [], first.additions, first.additions, [
      { ...existing, name: 'Edited after review' },
    ]),
  ).toThrow(/changed during review/);
  expect(prepareCsvCommit({ ...request, selected: [] }, [], [], []).routineWrites).toEqual([]);
});
test('Strive excludes an invalid routine completely and requires units for duration ranges', () => {
  const source = withRoutine();
  source.tables.routine_exercise_sets[0].reps_min = 20;
  expect(parseStriveSnapshot(source)).toMatchObject({
    excluded: 1,
    routines: [],
    issues: [{ field: 'Routine' }],
  });
  source.tables.exercises[0].category = 'duration';
  source.tables.routine_exercise_sets[0].reps_min = 1;
  expect(parseStriveSnapshot(source).requirements).toContain('durationUnit');
  expect(
    parseStriveSnapshot(source, { durationUnit: 'min' }).routines![0].exercises[0].sets![0]
      .plannedTargets![0],
  ).toMatchObject({ minValue: 60, maxValue: 600, unit: 'sec' });
});
test('Strive preserves seconds dates, pounds, ordering, notes, set types and source metadata', () => {
  const source = snapshot();
  source.tables.routine_exercise_set_logs.unshift({
    ...source.tables.routine_exercise_set_logs[0],
    id: 'later',
    order: 1,
    reps: 6,
    type: 'myo',
  });
  const draft = parseStriveSnapshot(source),
    workout = draft.workouts[0];
  expect(draft.issues).toEqual([]);
  expect(workout.startedAt).toBe(1700000000000);
  expect(workout.durationSeconds).toBe(3600);
  expect(workout.note).toBe('Workout note');
  expect(workout.exercises[0].note).toBe('Block note');
  expect(workout.exercises[0].sets.map((set) => set.reps)).toEqual(['8', '6']);
  expect(workout.exercises[0].sets[0].tag).toBe('Drop Set');
  expect(
    workout.exercises[0].sets[0].measurements?.find((entry) => entry.kind === 'weight')?.value,
  ).toBeCloseTo(45.359237);
  expect(workout.exercises[0].sets[1].tag).toBeUndefined();
  expect(workout.exercises[0].sets[1].importMetadata).toMatchObject({
    type: 'myo',
    timer: '60',
    kcal: '12',
    'workout.plan_id': 'source-plan',
  });
});
test('Strive requires explicit duration and distance units and preserves bodyweight loading', () => {
  const source = snapshot(),
    exercise = source.tables.exercises[0],
    set = source.tables.routine_exercise_set_logs[0];
  exercise.category = 'duration';
  set.reps = 300;
  set.weight = 0;
  expect(parseStriveSnapshot(source).requirements).toEqual(['durationUnit']);
  const seconds = parseStriveSnapshot(source, { durationUnit: 'sec' });
  expect(seconds.workouts[0].exercises[0].trackingType).toBe('duration');
  expect(
    seconds.workouts[0].exercises[0].sets[0].measurements?.find(
      (entry) => entry.kind === 'duration',
    )?.value,
  ).toBe(300);
  expect(
    parseStriveSnapshot(source, {
      durationUnit: 'min',
    }).workouts[0].exercises[0].sets[0].measurements?.find((entry) => entry.kind === 'duration')
      ?.value,
  ).toBe(18000);
  exercise.category = 'weigtedBodyweight';
  set.weight = 20;
  const loaded = parseStriveSnapshot(source);
  expect(loaded.workouts[0].exercises[0].trackingType).toBe('weighted-bodyweight');
  expect(
    loaded.workouts[0].exercises[0].sets[0].measurements?.some(
      (entry) => entry.kind === 'addedWeight',
    ),
  ).toBe(true);
  exercise.category = 'duration';
  set.weight = 0;
  set.distance = 500;
  expect(parseStriveSnapshot(source, { durationUnit: 'sec' }).requirements).toEqual([
    'distanceUnit',
  ]);
  const distance = parseStriveSnapshot(source, { durationUnit: 'sec', distanceUnit: 'm' });
  expect(distance.workouts[0].exercises[0].trackingType).toBe('distance-duration');
  expect(
    distance.workouts[0].exercises[0].sets[0].measurements?.find(
      (entry) => entry.kind === 'distance',
    )?.value,
  ).toBe(0.5);
  expect(parseStriveSnapshot(source, { durationUnit: 'sec', distanceUnit: 'mi' }).excluded).toBe(1);
});
test('Strive excludes entire invalid workouts and rejects orphaned data and unsupported schemas', () => {
  for (const patch of [
    { weight: -1 },
    { reps: 1.5 },
    { rpe: 11 },
    { exercise_id: 'missing' },
    { is_weight_unit_metric: 2 },
  ]) {
    const source = snapshot();
    Object.assign(source.tables.routine_exercise_set_logs[0], patch);
    const draft = parseStriveSnapshot(source);
    expect(draft.workouts).toHaveLength(0);
    expect(draft.excluded).toBe(1);
    expect(draft.issues[0].row).toBe(1);
  }
  const source = snapshot();
  source.tables.routine_exercise_set_logs[0].routine_exercise_log_id = 'missing';
  expect(() => parseStriveSnapshot(source)).toThrow(/orphaned/);
  source.version = 86;
  expect(() => parseStriveSnapshot(source)).toThrow(/version 86/);
  const empty = snapshot();
  for (const table of striveTables) empty.tables[table] = [];
  expect(parseStriveSnapshot(empty).workouts).toEqual([]);
});
test('Strive resolves linked supersets and rejects partners outside the workout', () => {
  const source = snapshot();
  source.tables.routine_exercise_logs.push({
    ...source.tables.routine_exercise_logs[0],
    id: 'second',
    order: 1,
  });
  source.tables.routine_exercise_logs[0].superset_with = 'second';
  source.tables.routine_exercise_set_logs.push({
    ...source.tables.routine_exercise_set_logs[0],
    id: 'second-set',
    routine_exercise_log_id: 'second',
  });
  const draft = parseStriveSnapshot(source);
  expect(draft.workouts[0].exercises[0].supersetId).toBeTruthy();
  expect(draft.workouts[0].exercises[0].supersetId).toBe(draft.workouts[0].exercises[1].supersetId);
  source.tables.routine_exercise_logs[0].superset_with = 'outside';
  expect(parseStriveSnapshot(source).excluded).toBe(1);
});
test('Strive UUID matching survives ordering changes, local edits, repeated imports and same-day sessions', () => {
  const source = snapshot(),
    draft = parseStriveSnapshot(source);
  const resolutions = resolveCsvExercises(draft, [], {});
  resolutions.forEach((entry) => {
    entry.custom = true;
    entry.exercise = customCsvExercise(entry);
  });
  const saved = applyCsvResolutions(draft, resolutions);
  const current = [{ ...saved[0], note: 'Local edit' }];
  expect(matchCsvSessions(saved, current)[0].status).toBe('duplicate');
  source.tables.routine_exercise_set_logs[0].weight = 120;
  const changed = applyCsvResolutions(parseStriveSnapshot(source), resolutions);
  expect(matchCsvSessions(changed, current)[0].status).toBe('changed');
  const request = {
    draft: parseStriveSnapshot(source),
    resolutions,
    selected: changed.map((item) => item.id),
    choices: { [changed[0].id]: 'replace' as const },
    acknowledged: true,
    reviewed: Object.fromEntries(
      matchCsvSessions(changed, current).map((match) => [match.workout.id, reviewStamp(match)]),
    ),
  };
  const committed = prepareCsvCommit(request, current, [], []);
  expect(committed.result.replaced).toBe(1);
  expect(committed.writes[0].id).toBe(current[0].id);
  source.tables.routine_logs[0].id = 'second-session';
  source.tables.routine_exercise_logs[0].routine_log_id = 'second-session';
  source.tables.routine_exercise_set_logs[0].routine_log_id = 'second-session';
  expect(
    matchCsvSessions(applyCsvResolutions(parseStriveSnapshot(source), resolutions), current)[0]
      .status,
  ).toBe('new');
  const portable = normalizeDataTransfer({
    format: 'forge-data',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {},
    plans: { plans: [], standaloneRoutines: [] },
    workouts: { activeWorkout: null, completedWorkouts: saved },
    customExercises: [],
  });
  expect(portable.workouts.completedWorkouts[0].importSource).toEqual(saved[0].importSource);
});
test('Strive large-history parsing yields to user input and fingerprints ignore table row order', async () => {
  const source = snapshot();
  for (let i = 1; i <= 250; i++) {
    source.tables.routine_logs.push({ ...source.tables.routine_logs[0], id: `session-${i}` });
    source.tables.routine_exercise_logs.push({
      ...source.tables.routine_exercise_logs[0],
      id: `block-${i}`,
      routine_log_id: `session-${i}`,
    });
    source.tables.routine_exercise_set_logs.push({
      ...source.tables.routine_exercise_set_logs[0],
      routine_exercise_log_id: `block-${i}`,
      routine_log_id: `session-${i}`,
    });
  }
  let yielded = false;
  setTimeout(() => {
    yielded = true;
  }, 0);
  const draft = await parseStriveSnapshotAsync(source);
  expect(yielded).toBe(true);
  expect(draft.workouts).toHaveLength(251);
  for (const table of striveTables) source.tables[table].reverse();
  const reordered = parseStriveSnapshot(source);
  expect(
    reordered.workouts.find((workout) => workout.id === draft.workouts[0].id)?.importSource,
  ).toEqual(draft.workouts[0].importSource);
});
