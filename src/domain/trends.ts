/**
 * The one set of day windows every day-based trend selector offers, so a trend
 * period means the same thing on the measurements page, the dashboard tiles and
 * their settings, and the muscle-heatmap detail. Week-based windows (volume,
 * balance) keep their own scale.
 */
export const TREND_DAY_OPTIONS = [7, 30, 90] as const;

export type TrendDays = (typeof TREND_DAY_OPTIONS)[number];

/** Compact selector label, e.g. `30d`. */
export function trendDayLabel(days: number): string {
  return `${days}d`;
}
