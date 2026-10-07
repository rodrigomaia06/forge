import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { hasSavedId, requireSavedId } from '../../src/data/savedRecordValidation';
import { uniqueById } from '../../src/data/uniqueById';
import { queueWebWrite } from '../../src/data/webWriteQueue';

async function rejects(operation: Promise<unknown>, message?: string) {
  let failure: unknown;
  try { await operation; } catch (error) { failure = error; }
  expect(failure).toBeTruthy();
  if (message) expect(String(failure)).toContain(message);
}
function evaluate(file: string, mocks: Record<string, unknown>): any {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, { exports, require: (name: string) => {
    if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
    return mocks[name];
  } });
  return exports;
}
const normalizePersistedWorkout = evaluate('src/data/workoutNormalization.ts', {
  './savedRecordValidation': { requireSavedId },
  './exerciseCanonicalization': { canonicalizeWorkout: (value: unknown) => value },
}).normalizePersistedWorkout;
function browserRepositories(values: Record<string, string>, failWrite = false) {
  const writes: string[] = [];
  const storage = {
    getItem: async (key: string) => values[key] ?? null,
    multiGet: async (keys: string[]) => keys.map((key) => [key, values[key] ?? null]),
    setItem: async (key: string, value: string) => {
      if (failWrite) throw new Error('Storage full');
      writes.push(key);
      values[key] = value;
    },
  };
  const mocks = {
    '@react-native-async-storage/async-storage': storage,
    './webWriteQueue': { queueWebWrite },
    './uniqueById': { uniqueById },
    './savedRecordValidation': { requireSavedId, hasSavedId },
    './exerciseCanonicalization': { canonicalizeRoutine: (value: unknown) => value },
    './workoutNormalization': { normalizePersistedWorkout },
  };
  return {
    plans: evaluate('src/data/plansRepository.web.ts', mocks),
    workouts: evaluate('src/data/workoutRepository.web.ts', mocks),
    writes,
  };
}
for (const corrupt of ['{broken', '', 'null', '{}', '[null]', '[{"id":5}]']) {
  test(`invalid saved archive ${JSON.stringify(corrupt)} never rewrites either key`, async () => {
    const values = { '@forge/completed-workouts': corrupt, '@forge/active-workout': '{"id":"active"}' };
    const { workouts, writes } = browserRepositories(values);
    await rejects(workouts.loadWorkoutState());
    expect(values['@forge/completed-workouts']).toBe(corrupt);
    expect(writes).toEqual([]);
    await rejects(workouts.appendCompletedWorkout({ id: 'new' }));
    expect(values['@forge/completed-workouts']).toBe(corrupt);
  });
}
for (const corrupt of ['{broken', '', 'null', '{}', '{"plans":[null],"standaloneRoutines":[]}', '{"plans":[],"standaloneRoutines":[{}]}']) {
  test(`invalid plans ${JSON.stringify(corrupt)} preserve the stored value`, async () => {
    const values = { '@forge/plans-v1': corrupt };
    const { plans, writes } = browserRepositories(values);
    await rejects(plans.loadPlansState());
    expect(writes).toEqual([]);
    expect(values['@forge/plans-v1']).toBe(corrupt);
  });
}
test('absent browser collections are genuine empty data and the write queue survives a read failure', async () => {
  const { plans, workouts } = browserRepositories({});
  expect(await plans.loadPlansState()).toEqual({ plans: [], standaloneRoutines: [] });
  expect(await workouts.loadWorkoutState()).toEqual({ activeWorkout: null, completedWorkouts: [] });
});
test('a normalization write failure rejects hydration and preserves original records', async () => {
  const raw = '[{"id":"history"}]';
  const values = { '@forge/completed-workouts': raw };
  const { workouts } = browserRepositories(values, true);
  await rejects(workouts.loadWorkoutState(), 'Storage full');
  expect(values['@forge/completed-workouts']).toBe(raw);
});
test('legacy native records keep optional child arrays but reject missing identity', () => {
  expect(normalizePersistedWorkout({ id: 'old' }).exercises).toEqual([]);
  for (const invalid of [null, {}, { id: 4 }]) expect(() => normalizePersistedWorkout(invalid)).toThrow();
});
test('native plan JSON/read failures propagate without writes', async () => {
  for (const value of ['{broken', 'null', '{}']) {
    const writes: string[] = [];
    const db = { getAllAsync: async (query: string) => query.includes('FROM plans') ? [{ value_json: value }] : [], runAsync: async (query: string) => { writes.push(query); } };
    const plans = evaluate('src/data/plansRepository.ts', {
      './savedRecordValidation': { requireSavedId },
      './database': { database: async () => db },
      './uniqueById': { uniqueById },
      './exerciseCanonicalization': { canonicalizeRoutine: (value: unknown) => value },
    });
    await rejects(plans.loadPlansState());
    expect(writes).toEqual([]);
  }
});
test('native workout JSON and database failures propagate without normalization writes', async () => {
  for (const failure of ['{broken', 'null', '{}', 'database']) {
    const workouts = evaluate('src/data/workoutRepository.ts', {
      './database': { database: async () => ({ getAllAsync: async () => {
        if (failure === 'database') throw new Error('Read failed');
        return [{ value_json: failure, is_active: 0 }];
      } }) },
      './workoutNormalization': { normalizePersistedWorkout },
    });
    await rejects(workouts.loadWorkoutState());
  }
});
