import { expect, test } from '@playwright/test';
import {
  DASHBOARD_TILE_ORDER,
  defaultDashboardLayout,
  reconcileLayout,
} from '../../src/state/dashboardLayout';

test('default layout lists every tile visible in order', () => {
  const layout = defaultDashboardLayout();
  expect(layout.map((tile) => tile.kind)).toEqual(DASHBOARD_TILE_ORDER);
  expect(layout.every((tile) => tile.visible)).toBe(true);
});

test('reconcile keeps saved order, visibility and titles', () => {
  const saved = [
    { kind: 'week', visible: true, title: 'My week' },
    { kind: 'start', visible: false },
  ];
  const layout = reconcileLayout(saved);
  expect(layout[0]).toEqual({ id: 'week', kind: 'week', visible: true, title: 'My week', settings: undefined });
  expect(layout[1]).toEqual({ id: 'start', kind: 'start', visible: false, title: undefined, settings: undefined });
  // Tiles missing from the saved layout are appended, visible.
  expect(layout.slice(2).every((tile) => tile.visible)).toBe(true);
  expect(new Set(layout.map((tile) => tile.kind))).toEqual(new Set(DASHBOARD_TILE_ORDER));
});

test('reconcile drops unknown kinds and duplicates, and blank titles', () => {
  const saved = [
    { kind: 'week', visible: true, title: '   ' },
    { kind: 'week', visible: false },
    { kind: 'ghost-tile', visible: true },
  ];
  const layout = reconcileLayout(saved);
  const weekEntries = layout.filter((tile) => tile.kind === 'week');
  expect(weekEntries).toHaveLength(1);
  expect(weekEntries[0].title).toBeUndefined();
  expect(layout.some((tile) => tile.kind === ('ghost-tile' as never))).toBe(false);
  expect(layout).toHaveLength(DASHBOARD_TILE_ORDER.length);
});

test('reconcile keeps valid measurement tiles and drops malformed ones', () => {
  const saved = [
    { id: 'measurement:bw', kind: 'measurement', visible: true, title: 'Bodyweight', settings: { measurementId: 'bw', windowDays: 90 } },
    { id: 'measurement:broken', kind: 'measurement', visible: true }, // no settings.measurementId → dropped
    { id: 'not-prefixed', kind: 'measurement', visible: true, settings: { measurementId: 'x' } }, // bad id → dropped
  ];
  const layout = reconcileLayout(saved);
  const measurements = layout.filter((tile) => tile.kind === 'measurement');
  expect(measurements).toHaveLength(1);
  expect(measurements[0].id).toBe('measurement:bw');
  expect(measurements[0].settings?.measurementId).toBe('bw');
  // Built-ins are still all present alongside the measurement tile.
  expect(new Set(layout.filter((t) => t.kind !== 'measurement').map((t) => t.kind))).toEqual(new Set(DASHBOARD_TILE_ORDER));
});

test('reconcile falls back to defaults for non-array input', () => {
  expect(reconcileLayout(null).map((tile) => tile.kind)).toEqual(DASHBOARD_TILE_ORDER);
  expect(reconcileLayout(undefined).every((tile) => tile.visible)).toBe(true);
});
