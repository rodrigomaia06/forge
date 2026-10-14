import { expect, test } from '@playwright/test';
import {
  nearestSessionIndex,
  sessionChartLayout,
  shapePreservingPath,
  shapePreservingSegments,
} from '../../src/components/charts/sessionChartLayout';

test('session positions preserve elapsed dates rather than equal session spacing', () => {
  const layout = sessionChartLayout(
    [
      { date: 0, value: 10 },
      { date: 1, value: 11 },
      { date: 10, value: 12 },
    ],
    232,
    120,
  );
  expect(layout.x(0)).toBe(16);
  expect(layout.x(1)).toBe(36);
  expect(layout.x(10)).toBe(216);
});

test('empty, single and constant series remain finite and inside their plot', () => {
  for (const points of [
    [],
    [{ date: 5, value: 10 }],
    [
      { date: 5, value: 10 },
      { date: 5, value: 10, trend: 10 },
    ],
  ]) {
    for (const [width, height] of [
      [0, 0],
      [20, 20],
      [320, 140],
    ]) {
      const layout = sessionChartLayout(points, width, height);
      expect(Number.isFinite(layout.x(5))).toBe(true);
      expect(Number.isFinite(layout.y(10))).toBe(true);
      if (points.length) {
        expect(layout.y(10)).toBeGreaterThanOrEqual(0);
        expect(layout.y(10)).toBeLessThanOrEqual(height);
      }
    }
  }
  expect(shapePreservingPath([])).toBe('');
  expect(shapePreservingPath([{ x: 4, y: 7 }])).toBe('M 4 7');
});

test('scrubbing selects nearest actual date and deterministically selects latest tied session', () => {
  const positions = [16, 36, 36, 216];
  expect(nearestSessionIndex([], 12)).toBe(-1);
  expect(nearestSessionIndex(positions, -100)).toBe(0);
  expect(nearestSessionIndex(positions, 36)).toBe(2);
  expect(nearestSessionIndex(positions, 90)).toBe(2);
  expect(nearestSessionIndex(positions, 500)).toBe(3);
});

test('smoothed median passes through every endpoint without overshooting sparse or changing trends', () => {
  const series = [
    [
      { x: 0, y: 5 },
      { x: 1, y: 30 },
      { x: 200, y: 31 },
      { x: 230, y: 2 },
    ],
    [
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 110, y: 5 },
      { x: 300, y: 5 },
    ],
    [
      { x: 0, y: -5 },
      { x: 40, y: -4 },
    ],
  ];
  for (const points of series) {
    for (const { from, to, control1, control2 } of shapePreservingSegments(points)) {
      for (let step = 0; step <= 100; step += 1) {
        const t = step / 100,
          inverse = 1 - t;
        const y =
          inverse ** 3 * from.y +
          3 * inverse ** 2 * t * control1.y +
          3 * inverse * t ** 2 * control2.y +
          t ** 3 * to.y;
        expect(y).toBeGreaterThanOrEqual(Math.min(from.y, to.y) - 1e-9);
        expect(y).toBeLessThanOrEqual(Math.max(from.y, to.y) + 1e-9);
      }
    }
  }
});

test('same-date sessions create finite vertical joins while retaining individual session points', () => {
  const path = shapePreservingPath([
    { x: 16, y: 50 },
    { x: 16, y: 10 },
    { x: 100, y: 25 },
  ]);
  expect(path).toContain('L 16 10');
  expect(path).not.toMatch(/NaN|Infinity/);
  expect(path).toContain('100 25');
});

test('nearest selection searches a large dated series logarithmically and keeps latest duplicates', () => {
  let reads = 0;
  const values = Array.from({ length: 10000 }, (_, index) => Math.floor(index / 2));
  const positions = new Proxy(values, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads += 1;
      return Reflect.get(target, key, receiver);
    },
  });
  expect(nearestSessionIndex(positions, 2400.5)).toBe(4803);
  expect(reads).toBeLessThan(50);
  expect(nearestSessionIndex([16, 16, 36], -100)).toBe(1);
  expect(nearestSessionIndex([16, 36, 36], 500)).toBe(2);
});
