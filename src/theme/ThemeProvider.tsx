import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { useSettings } from '../state/SettingsContext';
import type { ChildrenProps, ForgeTheme } from '../types';
import { darkTheme, lightTheme } from './tokens';
import { setDashboardTheme, setWebThemeVariables } from './dashboardTheme';

const ForgeThemeContext = createContext<ForgeTheme>(lightTheme);

export function ForgeThemeProvider({ children }: ChildrenProps) {
  const { preferences } = useSettings();
  const system = useColorScheme();
  const theme = useMemo(() => {
    const dark = preferences.appearance === 'dark' || (preferences.appearance === 'system' && system === 'dark');
    return dark ? darkTheme : lightTheme;
  }, [preferences.appearance, system]);
  useEffect(() => {
    setDashboardTheme(theme);
    setWebThemeVariables(theme);
    // React Native Web resolves the scheme through CSS/media queries; the
    // native override is only available on iOS and Android.
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(preferences.appearance === 'system' ? null : preferences.appearance);
    }
  }, [preferences.appearance, theme]);
  return <ForgeThemeContext.Provider value={theme}>{children}</ForgeThemeContext.Provider>;
}

/** Compatibility alias while app entry points migrate to the explicit name. */
export const ThemeProvider = ForgeThemeProvider;

export function useForgeTheme(): ForgeTheme { return useContext(ForgeThemeContext); }
