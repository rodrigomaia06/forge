import { test, expect } from '@playwright/test';
import { parseSettingsPreferences } from '../../src/data/settingsPreferences';
import { normalizeDataTransfer } from '../../src/data/dataTransferNormalization';
import {
  builtInWorkoutTypeColors,
  supersededBuiltInWorkoutTypeColors,
} from '../../src/domain/workouts/workoutTypeDefaults';
import { getWorkoutTypePresentation } from '../../src/domain/workouts/presentation';

test('legacy defaults migrate while explicit selections of the same old color survive', () => {
  const type = {
    id: 'strength',
    name: 'Strength',
    source: 'builtIn',
    color: supersededBuiltInWorkoutTypeColors.strength,
  };
  expect(
    parseSettingsPreferences(JSON.stringify({ workoutTypes: [type] })).workoutTypes[0].color,
  ).toBe(builtInWorkoutTypeColors.strength);
  const customized = { ...type, colorCustomized: true };
  expect(
    parseSettingsPreferences(JSON.stringify({ workoutTypes: [customized] })).workoutTypes[0],
  ).toMatchObject(customized);
});

test('reset uses the shipped default and keeps type identity, visibility and source', () => {
  const restored = {
    id: 'strength',
    name: 'Strength',
    source: 'builtIn',
    hidden: true,
    color: builtInWorkoutTypeColors.strength,
    colorCustomized: false,
  };
  const preferences = parseSettingsPreferences(JSON.stringify({ workoutTypes: [restored] }));
  expect(preferences.workoutTypes[0]).toMatchObject(restored);
});

test('settings and portable normalization retain customized built-in color metadata', () => {
  const type = {
    id: 'strength',
    name: 'Strength',
    source: 'builtIn',
    color: '#123456',
    colorCustomized: true,
  };
  const normalized = normalizeDataTransfer({
    settings: { workoutTypes: [type] },
    plans: { plans: [], standaloneRoutines: [] },
    workouts: { completedWorkouts: [], activeWorkout: null },
  });
  expect(normalized.settings?.workoutTypes?.[0]).toMatchObject(type);
  expect(
    parseSettingsPreferences(JSON.stringify(normalized.settings)).workoutTypes[0],
  ).toMatchObject(type);
});

test('presentation resolves the current color for saved names and IDs without mutating workouts', () => {
  const preferences = parseSettingsPreferences(
    JSON.stringify({
      workoutTypes: [
        {
          id: 'strength',
          name: 'Strength',
          source: 'builtIn',
          color: '#123456',
          colorCustomized: true,
        },
      ],
    }),
  );
  for (const type of ['Strength', 'strength']) {
    expect(
      getWorkoutTypePresentation(type, preferences.workoutTypes, { muted: '#999999' } as any, 0.1)
        .color,
    ).toBe('#123456');
  }
});
