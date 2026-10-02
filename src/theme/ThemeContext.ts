import { createContext, useContext } from 'react';

import type { ForgeTheme } from '../types';
import { lightTheme } from './tokens';

// The theme context lives in its own module so the styling layer
// (useThemedStyles) can read the active theme without importing ThemeProvider,
// which imports useThemedStyles back — the two together formed a require cycle.
export const ForgeThemeContext = createContext<ForgeTheme>(lightTheme);

export function useForgeTheme(): ForgeTheme {
  return useContext(ForgeThemeContext);
}
