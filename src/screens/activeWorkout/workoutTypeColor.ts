import { dashboardTheme } from '../../theme/dashboardTheme';

export function workoutTypeColor(type: string): string {
  if (type === 'Martial arts') return '#F0444D';
  if (type === 'Court sport') return dashboardTheme.iconSport || dashboardTheme.ink;
  if (type === 'Mobility') return '#AA7CE8';
  if (type === 'Cardio') return dashboardTheme.iconActivity || dashboardTheme.ink;
  return dashboardTheme.iconStrength || dashboardTheme.ink;
}

export function contrastingIconColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return dashboardTheme.surface;
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  return 0.299 * red + 0.587 * green + 0.114 * blue > 140
    ? dashboardTheme.ink
    : dashboardTheme.surface;
}
