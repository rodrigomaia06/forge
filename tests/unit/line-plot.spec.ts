import { expect, test } from '@playwright/test';
import { linePlotData } from '../../src/components/charts/linePlotData';
import { sessionChartLayout } from '../../src/components/charts/sessionChartLayout';

for (const smooth of [false, true]) {
  test(`plot spacing retains irregular dates, coincident sessions and endpoint values (${smooth})`, () => {
    const sessions = [
      { date: 0, value: 10 },
      { date: 1, value: 30 },
      { date: 1, value: 15 },
      { date: 100, value: 20 },
    ];
    const layout = sessionChartLayout(sessions, 332, 160);
    const points = sessions.map((p) => ({ x: layout.x(p.date), y: layout.y(p.value) }));
    const data = linePlotData(points, 160, smooth);
    let x = points[0].x;
    const rendered = data.map((p) => {
      const point = { x, y: 160 - p.value };
      x += p.spacing;
      return point;
    });
    for (const point of points) {
      expect(
        rendered.some((p) => Math.abs(p.x - point.x) < 1e-8 && Math.abs(p.y - point.y) < 1e-8),
      ).toBe(true);
    }
    expect(rendered.at(-1)!.x).toBeCloseTo(316);
    for (const p of rendered) {
      expect(p.y).toBeGreaterThanOrEqual(Math.min(...points.map((p) => p.y)) - 1e-8);
      expect(p.y).toBeLessThanOrEqual(Math.max(...points.map((p) => p.y)) + 1e-8);
    }
    expect(sessions.map((p) => p.value)).toEqual([10, 30, 15, 20]);
  });
}

test('constant and empty curves remain finite; curve sampling stays inside each interval', () => {
  expect(linePlotData([], 100, true)).toEqual([]);
  for (const values of [
    [5, 5, 5],
    [5, 90, 10, 11],
    [90, 20, 19, 5],
  ]) {
    const points = values.map((y, i) => ({ x: i * 100, y }));
    const data = linePlotData(points, 100, true);
    let x = 0;
    for (const p of data) {
      const i = Math.min(values.length - 2, Math.floor(x / 100));
      const y = 100 - p.value;
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(Math.min(values[i], values[i + 1]) - 1e-8);
      expect(y).toBeLessThanOrEqual(Math.max(values[i], values[i + 1]) + 1e-8);
      x += p.spacing;
    }
  }
});
