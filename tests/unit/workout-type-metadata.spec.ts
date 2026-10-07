import { expect, test } from '@playwright/test';
import { parseSettingsPreferences } from '../../src/data/settingsPreferences';
import { normalizeDataTransfer } from '../../src/data/dataTransferNormalization';
import { getWorkoutTypePresentation } from '../../src/domain/workouts/presentation';
import {
  workoutTypeIconChoices,
  workoutTypeUsage,
  resolveWorkoutTypeIcon,
  workoutTypeIcon,
} from '../../src/domain/workouts/workoutTypeMetadata';
import type { Workout, WorkoutRoutine, WorkoutTypePreference } from '../../src/types';

const type: WorkoutTypePreference = {
  id: 'strength',
  name: 'Strength',
  source: 'builtIn',
  color: '#123456',
};
function workout(id: string, category: string, at: number | null): Workout {
  return { id, name: id, type: category, startedAt: 1, completedAt: at, note: '', exercises: [] };
}
function routine(id: string, category: string): WorkoutRoutine {
  return { id, name: id, type: category, exercises: [], createdAt: 1, updatedAt: 1 };
}

test('icon overrides resolve by name or ID consistently and reset to the built-in glyph', () => {
  const customized = { ...type, icon: 'weight' as const };
  for (const value of ['strength', ' Strength ']) {
    expect(resolveWorkoutTypeIcon(value, [customized])).toBe('weight');
    expect(
      getWorkoutTypePresentation(value, [customized], { muted: '#000000' } as any, 0.1).icon,
    ).toBe('weight');
  }
  expect(workoutTypeIcon({ ...customized, icon: undefined })).toBe('fitness-outline');
  expect(resolveWorkoutTypeIcon('Olympic weightlifting', [])).toBe('weight');
  expect(resolveWorkoutTypeIcon('Unknown', [])).toBe('fitness-outline');
});

test('custom icon overrides survive settings parsing and portable round trips; unknown icons fall back', () => {
  const customized = {
    ...type,
    id: 'custom',
    name: 'Recovery',
    source: 'custom' as const,
    icon: 'recovery' as const,
  };
  const normalized = normalizeDataTransfer({
    settings: { workoutTypes: [customized] },
    plans: { plans: [], standaloneRoutines: [] },
    workouts: { completedWorkouts: [], activeWorkout: null },
  });
  const restored = parseSettingsPreferences(JSON.stringify(normalized.settings));
  expect(restored.workoutTypes[0]).toMatchObject(customized);
  expect(workoutTypeIcon(restored.workoutTypes[0])).toBe('recovery');
  for (const { value: icon } of workoutTypeIconChoices) {
    const normalizedIcon = normalizeDataTransfer({
      settings: { workoutTypes: [{ ...customized, icon }] },
      plans: { plans: [], standaloneRoutines: [] },
      workouts: { completedWorkouts: [], activeWorkout: null },
    });
    expect(
      parseSettingsPreferences(JSON.stringify(normalizedIcon.settings)).workoutTypes[0].icon,
    ).toBe(icon);
  }
  const invalid = parseSettingsPreferences(
    JSON.stringify({ workoutTypes: [{ ...type, icon: 'not-an-icon' }] }),
  );
  expect(invalid.workoutTypes[0].icon).toBeUndefined();
  expect(workoutTypeIcon(invalid.workoutTypes[0])).toBe('fitness-outline');
});

test('usage matches exact normalized names and IDs, sorts saved sessions, and includes routines in every plan', () => {
  const workouts = [
    workout('older', 'Strength', 2),
    workout('newer', ' STRENGTH ', 3),
    workout('other', 'Strength extra', 4),
    workout('active', 'Strength', null),
  ];
  const standalone = [routine('standalone', 'strength'), routine('other', 'Cardio')];
  const plans = [
    {
      id: 'plan',
      name: 'Weekly plan',
      createdAt: 1,
      updatedAt: 1,
      routines: [routine('in-plan', 'Strength')],
    },
  ];
  const before = JSON.stringify({ workouts, standalone, plans });
  const usage = workoutTypeUsage(type, workouts, plans, standalone);
  expect(usage.workouts.map((item) => item.id)).toEqual(['newer', 'older']);
  expect(usage.routines.map(({ routine, planName }) => [routine.id, planName])).toEqual([
    ['standalone', undefined],
    ['in-plan', 'Weekly plan'],
  ]);
  expect(JSON.stringify({ workouts, standalone, plans })).toBe(before);
  expect(
    workoutTypeUsage({ ...type, name: 'Missing', id: 'missing' }, workouts, plans, standalone),
  ).toEqual({ workouts: [], routines: [] });
});
