export interface ChartCoordinate {
  x: number;
  y: number;
}

export function sessionChartLayout(
  points: readonly { date: number; value: number; trend?: number }[],
  width: number,
  height: number,
  insets = { horizontal: 16, vertical: 12 },
) {
  const values = points
    .flatMap((point) => [point.value, point.trend])
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  const minimum = values.reduce((result, value) => Math.min(result, value), values[0] ?? 0);
  const maximum = values.reduce((result, value) => Math.max(result, value), values[0] ?? 0);
  const span = maximum - minimum || Math.max(1, Math.abs(maximum) * 0.1);
  const dates = points.map((point) => point.date).filter(Number.isFinite);
  const first = dates.reduce((result, date) => Math.min(result, date), dates[0] ?? 0);
  const last = dates.reduce((result, date) => Math.max(result, date), dates[0] ?? 0);
  const horizontalInset = Math.min(insets.horizontal, Math.max(0, width) / 2);
  const verticalInset = Math.min(insets.vertical, Math.max(0, height) / 2);
  return {
    x: (date: number) =>
      last === first || !Number.isFinite(date)
        ? width / 2
        : horizontalInset +
          ((date - first) / (last - first)) * Math.max(0, width - horizontalInset * 2),
    y: (value: number) =>
      verticalInset +
      (1 -
        ((Number.isFinite(value) ? value : minimum) - minimum + span * 0.1) /
          (maximum - minimum + span * 0.2)) *
        Math.max(0, height - verticalInset * 2),
  };
}

export function nearestSessionIndex(positions: readonly number[], target: number): number {
  'worklet';
  if (!positions.length) return -1;
  let lower = 0,
    upper = positions.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (positions[middle] < target) lower = middle + 1;
    else upper = middle;
  }
  const after = Math.min(lower, positions.length - 1);
  const before = Math.max(0, lower - 1);
  const nearest =
    Math.abs(positions[after] - target) <= Math.abs(positions[before] - target) ? after : before;
  const coordinate = positions[nearest];
  lower = nearest;
  upper = positions.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (positions[middle] <= coordinate) lower = middle + 1;
    else upper = middle;
  }
  return lower - 1;
}

export function shapePreservingSegments(points: readonly ChartCoordinate[]) {
  const slopes = points.slice(1).map((point, index) => {
    const width = point.x - points[index].x;
    return width > 0 ? (point.y - points[index].y) / width : 0;
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0] ?? 0;
    if (index === points.length - 1) return slopes[index - 1] ?? 0;
    const before = slopes[index - 1],
      after = slopes[index];
    if (before * after <= 0) return 0;
    return 2 / (1 / before + 1 / after);
  });
  return points.slice(1).map((to, index) => {
    const from = points[index];
    const width = Math.max(0, to.x - from.x);
    const slope = slopes[index];
    let before = tangents[index],
      after = tangents[index + 1];
    if (slope === 0) {
      before = 0;
      after = 0;
    } else {
      // Bound Hermite tangents to keep the interpolated median inside each interval.
      const magnitude = Math.hypot(before / slope, after / slope);
      if (magnitude > 3) {
        before *= 3 / magnitude;
        after *= 3 / magnitude;
      }
    }
    return {
      from,
      to,
      control1: { x: from.x + width / 3, y: from.y + (before * width) / 3 },
      control2: { x: to.x - width / 3, y: to.y - (after * width) / 3 },
    };
  });
}

export function shapePreservingPath(points: readonly ChartCoordinate[]): string {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!finite.length) return '';
  const start = finite[0];
  return (
    `M ${start.x} ${start.y}` +
    shapePreservingSegments(finite)
      .map(({ from, to, control1, control2 }) =>
        to.x <= from.x
          ? ` L ${to.x} ${to.y}`
          : ` C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${to.x} ${to.y}`,
      )
      .join('')
  );
}
