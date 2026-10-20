import { expect, test } from '@playwright/test';
import { setRirText, updateSetRir } from '../../src/domain/workouts/setEffort';
import type { WorkoutSet } from '../../src/types';

const empty: WorkoutSet = { id: 'set', weight: '60', reps: '8', completed: false };

test('shows existing RPE values as equivalent RIR without rewriting a set', () => {
  for (const [rpe, rir] of [[10, '0'], [9.5, '0.5'], [8, '2'], [8.7, '1.3'], [0, '10']]) {
    const set: WorkoutSet = { ...empty, measurements: [{ id: 'effort', kind: 'rpe', unit: 'rpe', value: Number(rpe) }] };
    expect(setRirText(set)).toBe(rir);
    expect(set.measurements![0].value).toBe(rpe);
  }
  expect(setRirText(empty)).toBe('');
});

test('RIR selection preserves measurements, supports zero and clears only effort', () => {
  const set: WorkoutSet = { ...empty, measurements: [{ id: 'load', kind: 'weight', unit: 'kg', value: 60 }] };
  for (const text of ['0', '0.5', '2', '4']) {
    const measurements = updateSetRir(set, text);
    expect(measurements[0]).toEqual(set.measurements![0]);
    expect(setRirText({ ...set, measurements })).toBe(text);
  }
  const withEffort = { ...set, measurements: updateSetRir(set, '0') };
  expect(updateSetRir(withEffort, '')).toEqual(set.measurements);
  expect(updateSetRir(withEffort, 'invalid')).toEqual(withEffort.measurements);
});
