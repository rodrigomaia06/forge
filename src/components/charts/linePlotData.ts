import { shapePreservingSegments, type ChartCoordinate } from './sessionChartLayout';

/**
 * Resample a display path at an even horizontal step, keeping both recorded endpoints.
 * Gifted Charts closes an area fill at `initialSpacing + spacing * (count - 1)`, which
 * only lands on the last point when every step is equal; uneven per-point spacing
 * otherwise draws the fill's lower edge as a diagonal back to the first point.
 */
export function evenlySpaced(coordinates: readonly ChartCoordinate[], step = 1): { points: ChartCoordinate[]; step: number } {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const span = last.x - first.x;
  if (coordinates.length < 2 || span <= 0) return { points: [...coordinates], step: 0 };
  const count = Math.max(1, Math.round(span / step));
  const evenStep = span / count;
  const points: ChartCoordinate[] = [];
  let segment = 0;
  for (let index = 0; index <= count; index++) {
    const x = index === count ? last.x : first.x + evenStep * index;
    while (segment < coordinates.length - 2 && coordinates[segment + 1].x < x) segment++;
    const from = coordinates[segment];
    const to = coordinates[segment + 1];
    const t = to.x === from.x ? 0 : (x - from.x) / (to.x - from.x);
    points.push({ x, y: index === count ? last.y : from.y + (to.y - from.y) * t });
  }
  return { points, step: evenStep };
}

/** Sample the display curve only; session data and selection keep their original points. */
export function linePlotData(points: readonly ChartCoordinate[], height: number, smooth = false, even = false) {
  const coordinates: ChartCoordinate[] = smooth && points.length ? [points[0]] : [...points];
  if (smooth) {
    for (const { from, to, control1, control2 } of shapePreservingSegments(points)) {
      const steps = Math.max(1, Math.ceil((to.x - from.x) / 3));
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const inverse = 1 - t;
        coordinates.push({
          x: from.x + (to.x - from.x) * t,
          y:
            inverse ** 3 * from.y +
            3 * inverse ** 2 * t * control1.y +
            3 * inverse * t ** 2 * control2.y +
            t ** 3 * to.y,
        });
      }
    }
  }
  const display = even ? evenlySpaced(coordinates).points : coordinates;
  return display.map((point, index) => ({
    value: height - point.y,
    spacing: Math.max(0, (display[index + 1]?.x ?? point.x) - point.x),
  }));
}
