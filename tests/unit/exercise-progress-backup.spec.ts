import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as progress from '../../src/domain/exercises/progress';
import * as normalization from '../../src/data/dataTransferNormalization';
import * as unique from '../../src/data/uniqueById';
import { defaultSettingsPreferences } from '../../src/data/settingsDefaults';

// Exercise the web repository boundary with only the platform storage bridges replaced.
function repository() {
  let settings = structuredClone(defaultSettingsPreferences);
  let workouts: any = { activeWorkout: null, completedWorkouts: [] };
  const plans = { plans: [], standaloneRoutines: [] };
  const bridges: Record<string, unknown> = {
    '../domain/exercises/progress': progress,
    '@react-native-async-storage/async-storage': {},
    './exerciseRepository': {
      loadCustomExercises: async () => [],
      saveCustomExercises: async () => undefined,
    },
    './dataTransferPlans': { mergeImportedPlans: (current: unknown) => current },
    './sharedImport': {},
    './importDiff': { shareResolutionResult: () => undefined },
    './dataTransferNormalization': normalization,
    './plansRepository': {
      loadPlansState: async () => plans,
      savePlansState: async () => undefined,
    },
    './settingsRepository': {
      loadSettingsPreferences: async () => settings,
      saveSettingsPreferences: async (next: typeof settings) => {
        settings = next;
      },
    },
    './uniqueById': unique,
    './workoutRepository': {
      loadWorkoutState: async () => workouts,
      saveCompletedWorkouts: async (next: unknown) => {
        workouts = { ...workouts, completedWorkouts: next };
      },
      saveActiveWorkout: async () => undefined,
    },
  };
  const source = ts.transpileModule(readFileSync('src/data/backupRepository.web.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: any = {};
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      if (!(name in bridges)) throw new Error(`Unexpected import: ${name}`);
      return bridges[name];
    },
    Set,
    Map,
    Date,
    JSON,
  });
  return { api: exports, settings: () => settings, workouts: () => workouts };
}
const scope = JSON.stringify(['id:bench', 'weight-reps', 'load']);
function transfer() {
  return {
    format: 'forge-data',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      ...defaultSettingsPreferences,
      exerciseProgressOverrides: { [scope]: { w: 'exclude' } },
    },
    plans: { plans: [], standaloneRoutines: [] },
    customExercises: [],
    workouts: {
      activeWorkout: null,
      completedWorkouts: [
        {
          id: 'w',
          name: 'Workout',
          type: 'Strength',
          note: '',
          startedAt: 1,
          completedAt: 2,
          exercises: [{ id: 'ex', exerciseId: 'bench', name: 'Bench', sets: [] }],
        },
      ],
    },
  };
}
test('portable export and restore preserve per-metric overrides without replacing current settings', async () => {
  const repo = repository();
  await repo.api.mergeDataTransfer(repo.api.parseDataTransfer(JSON.stringify(transfer())));
  expect(repo.settings().exerciseProgressOverrides[scope]).toEqual({ w: 'exclude' });
  expect(repo.settings().units).toBe('metric');
  const exported = await repo.api.createDataTransfer();
  expect(exported.settings.exerciseProgressOverrides).toEqual(
    repo.settings().exerciseProgressOverrides,
  );
  const restored = repository();
  await restored.api.mergeDataTransfer(restored.api.parseDataTransfer(JSON.stringify(exported)));
  expect(restored.settings().exerciseProgressOverrides[scope]).toEqual({ w: 'exclude' });
  expect(restored.workouts().completedWorkouts).toHaveLength(1);
});
test('older backups default to no overrides and omitted workouts do not import or export overrides', async () => {
  const repo = repository();
  const old: any = transfer();
  delete old.settings.exerciseProgressOverrides;
  const parsed = repo.api.parseDataTransfer(JSON.stringify(old));
  expect(parsed.settings.exerciseProgressOverrides).toEqual({});
  await repo.api.mergeDataTransfer(parsed);
  const selection = {
    workouts: false,
    plans: false,
    exercises: false,
    workoutTypes: false,
    measurements: false,
  };
  await repo.api.mergeDataTransfer(transfer(), selection);
  expect(repo.settings().exerciseProgressOverrides).toEqual({});
  expect((await repo.api.createDataTransfer(selection)).settings.exerciseProgressOverrides).toEqual(
    {},
  );
});
