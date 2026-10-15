import { createContext, useContext } from 'react';
import type { ForgeTheme } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';

export const ForgeControlSurface = createContext<string | null>(null);

export function useForgeControlSurface(): string {
  const theme = useForgeTheme();
  return useContext(ForgeControlSurface) ?? theme.background;
}

export function resolveForgeControlFill(theme: ForgeTheme, parentColor: string): string {
  if (theme.colorScheme === 'light') {
    const parent = parentColor.toLowerCase();
    return parent === theme.background.toLowerCase() || parent === theme.surfaceMuted.toLowerCase()
      ? theme.surface
      : theme.surfaceMuted;
  }
  return parentColor.toLowerCase() === theme.surfaceElevated.toLowerCase()
    ? theme.surfaceMuted
    : theme.surfaceElevated;
}

export function resolveForgeHeaderFill(theme: ForgeTheme, parentColor: string): string {
  if (theme.colorScheme === 'dark') {
    return parentColor === theme.surfaceMuted ? theme.surfaceElevated : theme.surfaceMuted;
  }
  return resolveForgeControlFill(theme, parentColor);
}
