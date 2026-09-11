import { expect, test } from '@playwright/test';
import { REST_DURATION_OPTIONS } from '../../src/domain/rest/restDurationOptions';
import { catalogFacets, filterCatalog, groupCatalogByEquipment, groupCatalogByMovement } from '../../src/domain/exercises/catalogSelectors';
import { exerciseCatalog } from '../../src/data/exerciseCatalog';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../../src/domain/workouts/presentation';
import { defaultSettingsPreferences } from '../../src/data/settingsDefaults';
import { lightTheme } from '../../src/theme/tokens';
import { bundledExercises, bundledLegacyIdMap, bundledCatalogVersion } from '../../src/data/catalog/loadCatalog';
import { trackingFields } from '../../src/domain/exercises/tracking';
import { createWorkout } from '../../src/state/workoutMutations';

test('formats compact workout durations and counts sets', () => {
  expect([0, 59, 3600, 4320].map(formatCompactDuration)).toEqual(['1m', '1m', '1h', '1h 12m']);
  expect(countWorkoutSets({ exercises: [{ sets: [] }, { sets: [{}, {}] }] } as never)).toBe(2);
});

test('presents saved, fallback, custom, and unknown workout types consistently', () => {
  const types = defaultSettingsPreferences.workoutTypes;
  expect(getWorkoutTypePresentation('Court sport', types, lightTheme, 0.14)).toMatchObject({
    icon: 'tennis-ball',
    color: '#E3A346',
    background: 'rgba(227,163,70,0.14)',
  });
  expect(getWorkoutTypePresentation('Strength', [], lightTheme, 0.16)).toMatchObject({
    icon: 'fitness-outline',
    color: '#687CF2',
    background: 'rgba(104,124,242,0.16)',
  });
  expect(
    getWorkoutTypePresentation(
      'Recovery',
      [{ id: 'recovery', name: 'Recovery', color: '#123456', source: 'custom' }],
      lightTheme,
      0.2,
    ),
  ).toMatchObject({ icon: 'fitness-outline', color: '#123456', background: 'rgba(18,52,86,0.20)' });
  expect(getWorkoutTypePresentation('Unknown', types, lightTheme, 0.16)).toMatchObject({
    icon: 'fitness-outline',
    color: lightTheme.muted,
    background: 'rgba(138,150,158,0.16)',
  });
  expect(REST_DURATION_OPTIONS).toEqual(
    Array.from({ length: 115 }, (_, index) => 30 + index * 5),
  );
});

test('filters and groups exercise catalog entries without changing feature selection state', () => {
  const items = [
    { id: 'bench', name: 'Close grip', group: 'Bench Press', equipment: 'Barbell', category: 'Chest', primaryMuscle: 'Triceps', secondaryMuscles: ['Chest'], aliases: ['press'], workoutTypeIds: ['strength'] },
    { id: 'pec', name: 'Pec Deck', group: 'Pec Deck', equipment: 'Machine', category: 'Chest', primaryMuscle: 'Chest', secondaryMuscles: [], aliases: ['fly'], workoutTypeIds: ['strength'] },
  ];
  expect(filterCatalog(items, { query: 'bench', includeGroupInSearch: false })).toHaveLength(0);
  expect(filterCatalog(items, { query: 'bench press', includeGroupInSearch: true })).toHaveLength(1);
  expect(filterCatalog(items, { query: 'fly', equipment: ['Machine'], categories: ['Chest'] })).toEqual([items[1]]);
  expect(filterCatalog(items, { categories: ['Triceps'] })).toEqual([items[0]]);
  expect(filterCatalog(items, { exerciseCategories: ['Chest'] })).toEqual(items);
  expect(filterCatalog([...items, { ...items[0], id: 'conditioning-press', category: 'Cardio' }], { exerciseCategories: ['Chest'] })).toEqual(items);
  expect(filterCatalog(items, { query: 'triceps' })).toEqual([items[0]]);
  expect(catalogFacets(items)).toEqual({ equipment: ['Barbell', 'Machine'], categories: ['Chest', 'Triceps'] });
  expect(groupCatalogByMovement(items).map(([name]) => name)).toEqual(['Bench Press', 'Pec Deck']);
  expect(groupCatalogByEquipment(items).map(([name]) => name)).toEqual(['Barbell', 'Machine']);
});

test('ships the validated v3 baseline, legacy dips mapping, and all built-in workout types', () => {
  expect(bundledCatalogVersion).toBe(3);
  expect(new Set(bundledExercises.map((exercise) => exercise.id)).size).toBe(381);
  expect(bundledLegacyIdMap.dips).toBe('parallel-bar-dip');
  expect(defaultSettingsPreferences.workoutTypes.map((type) => type.id)).toEqual(['strength', 'calisthenics', 'cardio', 'mobility', 'functional', 'olympic-weightlifting', 'plyometrics', 'court-sport', 'field-sport', 'martial-arts']);
});

test('tracking modes specify only their applicable measurements and retain an exercise snapshot', () => {
  expect(Object.keys(trackingFields)).toHaveLength(9);
  expect(trackingFields['distance-duration']).toEqual(['distance', 'duration']);
  const exercise = bundledExercises.find((item) => item.id === 'parallel-bar-dip')!;
  const workout = createWorkout({ exercises: [{ exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: { id: exercise.id, name: exercise.name, catalogueVersion: 3, trackingType: exercise.trackingType } }] });
  expect(workout.exercises[0]).toMatchObject({ exerciseId: 'parallel-bar-dip', trackingType: exercise.trackingType, exerciseSnapshot: { id: 'parallel-bar-dip', catalogueVersion: 3 } });
});

test('v3 multi-equipment facets remain individual taxonomy labels', () => {
  const multiEquipment = exerciseCatalog.find((exercise) => (exercise.equipmentIds?.length ?? 0) > 1)!;
  const facets = catalogFacets([multiEquipment]);
  expect(facets.equipment).toEqual(multiEquipment.equipment.split(', ').sort());
  expect(facets.equipment).not.toContain(multiEquipment.equipment);
});
