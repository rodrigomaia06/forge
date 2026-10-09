import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseWorkoutCsv } from '../../src/data/csvImport/parse';
import {
  applyCsvResolutions,
  prepareCsvCommit,
  resolveCsvExercises,
  reviewStamp,
  matchCsvSessions,
} from '../../src/data/csvImport/review';
import { routineReviewRecord } from '../../src/data/csvImport/routines';
import { exerciseCatalog } from '../../src/data/exerciseCatalog';
import type { CsvImportRequest, CsvImportResult } from '../../src/data/csvImport/types';
import { writeCsvImport } from '../../src/data/csvImport/webStorage';

test('native import saves routines, workouts and mappings together, rolls back and retries without rewriting plans', async () => {
  const exercise = exerciseCatalog[0];
  const draft = parseWorkoutCsv(
    `title,start_time,end_time,exercise_title,set_index,set_type,weight_kg,reps\nSession,2026-09-20 08:00:00,2026-09-20 09:00:00,${exercise.name},0,normal,50,8`,
  );
  const workout = draft.workouts[0];
  draft.routines = [
    {
      id: 'routine',
      name: 'Template',
      type: 'Strength',
      createdAt: workout.startedAt,
      updatedAt: workout.startedAt,
      exercises: workout.exercises,
      importSource: { source: 'strive', sessionKey: 'routine-session', fingerprint: 'changed' },
    },
  ];
  const existing = {
    ...draft.routines[0],
    name: 'Existing template',
    importSource: { ...draft.routines[0].importSource!, fingerprint: 'before' },
    planId: 'existing-plan',
  };
  const resolutions = resolveCsvExercises(draft, [exercise], {});
  const incoming = applyCsvResolutions(draft, resolutions);
  const matches = [
    ...matchCsvSessions([incoming[0]], []),
    ...matchCsvSessions([incoming[1]], [routineReviewRecord(existing)]),
  ];
  const request: CsvImportRequest = {
    draft,
    selected: incoming.map((record) => record.id),
    resolutions,
    choices: { routine: 'replace' },
    reviewed: Object.fromEntries(matches.map((match) => [match.workout.id, reviewStamp(match)])),
    acknowledged: true,
  };
  type Write = { sql: string; values: unknown[] };
  let writes: Write[] = [],
    transactions = 0,
    fail = true;
  const db = {
    getAllAsync: async (sql: string) =>
      sql.includes('FROM routines')
        ? [{ value_json: JSON.stringify(existing), plan_id: 'existing-plan', position: 7 }]
        : [],
    getFirstAsync: async () => null,
    runAsync: async (sql: string, ...values: unknown[]) => {
      writes.push({ sql, values });
      if (fail && sql.includes('forge_meta')) throw new Error('Disk full');
    },
  };
  const mocks: Record<string, unknown> = {
    './database': {
      database: async () => db,
      withDatabaseTransaction: async (work: (db: unknown) => Promise<void>) => {
        transactions++;
        const before = [...writes];
        try {
          await work(db);
        } catch (error) {
          writes = before;
          throw error;
        }
      },
    },
    './exerciseCatalog': { exerciseCatalog: [exercise] },
    './workoutRepository': { completedWorkoutUpsert: 'INSERT INTO workouts' },
    './workoutNormalization': { normalizePersistedWorkout: (value: unknown) => value },
    './csvImport/review': { prepareCsvCommit },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(
    ts.transpileModule(readFileSync('src/data/csvImportRepository.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports, require: (name: string) => mocks[name] },
  );
  const commit = exports.commitCsvImport as (request: CsvImportRequest) => Promise<CsvImportResult>;
  const error = await commit(request).catch((error: Error) => error.message);
  expect(error).toBe('Disk full');
  expect(writes).toEqual([]);
  fail = false;
  expect(await commit(request)).toMatchObject({ added: 1, replaced: 0, routinesReplaced: 1 });
  expect(transactions).toBe(2);
  const saved = writes.find((write) => write.sql.includes('INSERT INTO routines'))!;
  expect(saved.values.slice(0, 3)).toEqual(['routine', 'existing-plan', 7]);
  expect(JSON.parse(saved.values[3] as string)).toMatchObject({
    id: 'routine',
    planId: 'existing-plan',
    name: 'Template',
  });
  expect(writes.filter((write) => write.sql.includes('INSERT INTO workouts'))).toHaveLength(1);
  expect(writes.some((write) => /DELETE|INSERT INTO plans/.test(write.sql))).toBe(false);
  let touched = false;
  await expect(
    writeCsvImport(
      {
        getItem: async () => {
          touched = true;
          return null;
        },
        setItem: async () => {
          touched = true;
        },
        removeItem: async () => {
          touched = true;
        },
      },
      request,
      [exercise],
    ),
  ).rejects.toThrow(/require the iOS or Android app/);
  expect(touched).toBe(false);
});
