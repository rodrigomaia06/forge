/** Legacy names remain as imports during the staged screen migration. */
export { lightTheme as lightDashboardTheme, darkTheme as darkDashboardTheme } from './tokens';
import type { ForgeTheme } from '../types';
import { lightTheme } from './tokens';
import { Platform } from 'react-native';

let activeTheme: ForgeTheme = lightTheme;
export function setDashboardTheme(theme: ForgeTheme): void { activeTheme = theme; }
const colorKeys = new Set([
  'background', 'header', 'surface', 'surfaceElevated', 'input', 'dock', 'overlay', 'surfaceMuted',
  'ink', 'textPrimary', 'textSecondary', 'textDisabled', 'textDestructive', 'slate', 'muted', 'divider',
  'border', 'pressed', 'focus', 'shadow', 'accent', 'inkInteractive', 'success', 'calendarSurface',
  'calendarDay', 'selected', 'selectedText', 'marker', 'navigation', 'dockSurface', 'dockSelected',
  'dockBorder', 'dockForeground', 'dockMuted', 'iconCalendar', 'iconStrength', 'iconSport', 'iconActivity',
  'iconTime', 'summaryGradientStart', 'summaryGradientEnd', 'summaryBorder', 'summaryGlow',
]);

export function setWebThemeVariables(theme: ForgeTheme): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  colorKeys.forEach((key) => {
    const value = theme[key as keyof ForgeTheme];
    if (typeof value === 'string') root.style.setProperty(`--forge-${key}`, value);
  });
}
/** Transitional facade for screens not yet migrated to useForgeTheme. */
export const dashboardTheme: ForgeTheme = new Proxy({} as ForgeTheme, {
  get: (_target, key) => {
    if (Platform.OS === 'web' && typeof key === 'string' && colorKeys.has(key)) {
      return `var(--forge-${key})`;
    }
    return activeTheme[key as keyof ForgeTheme];
  },
}) as ForgeTheme;
