import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useForgeTheme } from './ThemeProvider';
import type { ForgeTheme } from '../types';

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: ForgeTheme) => T,
): (theme: ForgeTheme) => T {
  return (theme) => StyleSheet.create(factory(theme));
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: ForgeTheme) => T,
): T {
  const theme = useForgeTheme();
  return useMemo(() => makeStyles(factory)(theme), [factory, theme]);
}
