import { expect, test } from '@playwright/test';
import { REST_DURATION_OPTIONS } from '../src/domain/rest/restDurationOptions';
import { catalogFacets, filterCatalog, groupCatalogByEquipment, groupCatalogByMovement } from '../src/domain/exercises/catalogSelectors';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../src/domain/workouts/presentation';
import { lightTheme } from '../src/theme/tokens';

test('formats compact workout durations and counts sets', () => {
  expect([0, 59, 3600, 4320].map(formatCompactDuration)).toEqual(['1m', '1m', '1h', '1h 12m']);
  expect(countWorkoutSets({ exercises: [{ sets: [] }, { sets: [{}, {}] }] } as never)).toBe(2);
});

test('presents workout types with the requested background opacity', () => {
  expect(getWorkoutTypePresentation('Court sport', lightTheme, 0.14)).toMatchObject({ icon: 'tennis-ball', background: 'rgba(98,201,138,0.14)' });
  expect(getWorkoutTypePresentation('Unknown', lightTheme, 0.16)).toMatchObject({ icon: 'fitness-outline', background: 'rgba(111,127,242,0.16)' });
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
  expect(filterCatalog(items, { query: 'triceps' })).toEqual([items[0]]);
  expect(catalogFacets(items)).toEqual({ equipment: ['Barbell', 'Machine'], categories: ['Chest', 'Triceps'] });
  expect(groupCatalogByMovement(items).map(([name]) => name)).toEqual(['Bench Press', 'Pec Deck']);
  expect(groupCatalogByEquipment(items).map(([name]) => name)).toEqual(['Barbell', 'Machine']);
});
