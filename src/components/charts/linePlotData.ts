import { shapePreservingSegments, type ChartCoordinate } from './sessionChartLayout';

/** Sample the display curve only; session data and selection keep their original points. */
export function linePlotData(points: readonly ChartCoordinate[], height: number, smooth = false) {
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
  return coordinates.map((point, index) => ({
    value: height - point.y,
    spacing: Math.max(0, (coordinates[index + 1]?.x ?? point.x) - point.x),
  }));
}
