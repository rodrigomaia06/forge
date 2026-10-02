import React, { useEffect, useMemo } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { runWhenIdle } from '../utils/idle';
import * as SystemUI from 'expo-system-ui';
import { useSettings } from '../state/SettingsContext';
import type { ChildrenProps, ForgeTheme } from '../types';
import { darkTheme, lightTheme } from './tokens';
import { setDashboardTheme, setWebThemeVariables } from './dashboardTheme';
import { warmThemedStyles } from './useThemedStyles';
import { ForgeThemeContext } from './ThemeContext';

// Re-exported so the ~70 existing `useForgeTheme` imports from ThemeProvider keep
// working; the hook itself now lives in ThemeContext to break the require cycle.
export { useForgeTheme } from './ThemeContext';

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
      Appearance.setColorScheme(preferences.appearance === 'system' ? 'unspecified' : preferences.appearance);
    }
  }, [preferences.appearance, theme]);
  useEffect(() => {
    // Native swipe-back can expose the host view outside the React tree.
    void SystemUI.setBackgroundColorAsync(theme.background).catch((error: unknown) => {
      console.warn('Unable to update the app background', error);
    });
  }, [theme.background]);
  useEffect(() => {
    // Pre-build the inactive appearance's StyleSheets while the UI is idle so a
    // later switch reuses the cache instead of rebuilding the whole tree on the
    // switch frame. Kept off the input path via an idle callback.
    const inactive = theme === darkTheme ? lightTheme : darkTheme;
    return runWhenIdle(() => warmThemedStyles(inactive));
  }, [theme]);
  return <ForgeThemeContext.Provider value={theme}>{children}</ForgeThemeContext.Provider>;
}

/** Compatibility alias while app entry points migrate to the explicit name. */
export const ThemeProvider = ForgeThemeProvider;
