import { createContext, useContext } from 'react';
import type { ForgeTheme } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';

export const ForgeControlSurface = createContext<string | null>(null);

export function useForgeControlSurface(): string {
  const theme = useForgeTheme();
  return useContext(ForgeControlSurface) ?? theme.surface;
}

export function resolveForgeControlFill(theme: ForgeTheme, parentColor: string): string {
  return parentColor.toLowerCase() === theme.surfaceElevated.toLowerCase()
    ? theme.surfaceMuted
    : theme.surfaceElevated;
}
