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
  expect(layout[0]).toEqual({ kind: 'week', visible: true, title: 'My week' });
  expect(layout[1]).toEqual({ kind: 'start', visible: false, title: undefined });
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

test('reconcile falls back to defaults for non-array input', () => {
  expect(reconcileLayout(null).map((tile) => tile.kind)).toEqual(DASHBOARD_TILE_ORDER);
  expect(reconcileLayout(undefined).every((tile) => tile.visible)).toBe(true);
});
