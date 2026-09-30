import { expect, test } from '@playwright/test';
import { measurementsFor } from '../../src/domain/exercises/tracking';
import { relativeTime } from '../../src/utils/relativeTime';
import { reconcileMeasurements } from '../../src/data/dataTransferNormalization';
import { measurementSeries } from '../../src/domain/dashboard/widgetMetrics';
import type { DailyMeasurementDefinition, DailyMeasurementEntry, WorkoutSet } from '../../src/types';

const HOUR = 3600_000;

function set(over: Partial<WorkoutSet>): WorkoutSet {
  return { id: 's1', weight: '', reps: '', completed: false, ...over };
}

test.describe('audit domain fixes', () => {
  test('legacy fallback does not fabricate distance/duration from weight', () => {
    const kinds = measurementsFor('weight-distance', set({ weight: '60' })).map((m) => m.kind);
    expect(kinds).toContain('weight');
    expect(kinds).not.toContain('distance');
    // distance-duration with only a legacy weight yields nothing fabricated.
    expect(measurementsFor('distance-duration', set({ weight: '60' }))).toHaveLength(0);
  });

  test('relativeTime keeps ~23.6h as hours, not yesterday', () => {
    const now = Date.now();
    expect(relativeTime(now - 23.6 * HOUR, now)).toBe('23 hours ago');
    expect(relativeTime(now - 25 * HOUR, now)).toBe('yesterday');
  });

  test('reconcileMeasurements collapses same-named metrics and dedupes by date', () => {
    const currentDefs: DailyMeasurementDefinition[] = [
      { id: 'd1', name: 'Weight', unit: 'kg', icon: 'weight', color: '#111' },
    ];
    const currentEntries: DailyMeasurementEntry[] = [
      { id: 'e1', definitionId: 'd1', date: '2026-01-01', value: 70 },
    ];
    const incomingDefs: DailyMeasurementDefinition[] = [
      { id: 'd2', name: 'weight', unit: 'kg', icon: 'weight', color: '#222' },
    ];
    const incomingEntries: DailyMeasurementEntry[] = [
      { id: 'e2', definitionId: 'd2', date: '2026-01-02', value: 71 },
      { id: 'e3', definitionId: 'd2', date: '2026-01-01', value: 99 },
    ];
    const merged = reconcileMeasurements(currentDefs, currentEntries, incomingDefs, incomingEntries);
    expect(merged.definitions).toHaveLength(1);
    // e2 is added (remapped to d1); e3 collides with e1's date and is dropped.
    expect(merged.entries.map((entry) => entry.id).sort()).toEqual(['e1', 'e2']);
    expect(merged.entries.find((entry) => entry.id === 'e2')?.definitionId).toBe('d1');
  });

  test('measurementSeries window is inclusive of exactly N days', () => {
    const now = new Date('2026-03-10T12:00:00');
    const entries: DailyMeasurementEntry[] = [
      { id: 'a', definitionId: 'd', date: '2026-03-10', value: 1 }, // today
      { id: 'b', definitionId: 'd', date: '2026-03-04', value: 2 }, // today-6 (in)
      { id: 'c', definitionId: 'd', date: '2026-03-03', value: 3 }, // today-7 (out)
    ];
    const series = measurementSeries(entries, 'd', 7, now);
    expect(series.count).toBe(2);
  });
});
