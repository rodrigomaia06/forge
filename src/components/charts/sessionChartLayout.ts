export function sessionChartLayout(
  points: readonly { date: number; value: number; trend?: number }[],
  width: number,
  height: number,
) {
  const values = points.flatMap((point) =>
    point.trend === undefined ? [point.value] : [point.value, point.trend],
  );
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || Math.max(1, Math.abs(maximum) * 0.1);
  const first = points[0]?.date ?? 0;
  const last = points[points.length - 1]?.date ?? first;
  return {
    x: (date: number) =>
      last === first ? width / 2 : 16 + ((date - first) / (last - first)) * Math.max(0, width - 32),
    y: (value: number) =>
      12 + (1 - (value - minimum + span * 0.1) / (maximum - minimum + span * 0.2)) * (height - 24),
  };
}
