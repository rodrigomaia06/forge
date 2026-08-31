import { expect, test } from '@playwright/test';
import { REST_DURATION_OPTIONS } from '../src/domain/rest/restDurationOptions';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../src/domain/workouts/presentation';
import { lightTheme } from '../src/theme/tokens';

test('formats compact workout durations and counts sets', () => {
  expect([0, 59, 3600, 4320].map(formatCompactDuration)).toEqual(['1m', '1m', '1h', '1h 12m']);
  expect(countWorkoutSets({ exercises: [{ sets: [] }, { sets: [{}, {}] }] } as never)).toBe(2);
});

test('presents workout types with the requested background opacity', () => {
  expect(getWorkoutTypePresentation('Court sport', lightTheme, 0.14)).toMatchObject({ icon: 'tennis-ball', background: 'rgba(98,201,138,0.14)' });
  expect(getWorkoutTypePresentation('Unknown', lightTheme, 0.16)).toMatchObject({ icon: 'fitness-outline', background: 'rgba(111,127,242,0.16)' });
  expect(REST_DURATION_OPTIONS).toEqual([45, 60, 75, 90, 105, 120, 135, 150, 165]);
});
