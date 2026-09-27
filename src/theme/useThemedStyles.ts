import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useForgeTheme } from './ThemeProvider';
import type { ForgeTheme } from '../types';

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: ForgeTheme) => T,
): (theme: ForgeTheme) => T {
  return (theme) => StyleSheet.create(factory(theme));
}

type StyleFactory = (theme: ForgeTheme) => unknown;

// The two themes are stable module singletons and the styling factories are
// module-level constants, so a given (factory, theme) pair resolves to the same
// StyleSheet for the whole app lifetime. Caching that result means an
// appearance switch — which re-renders every themed consumer at once — reuses
// already-built StyleSheets instead of re-running each factory and re-calling
// StyleSheet.create on the switch frame. The outer WeakMap is keyed on the
// factory so transient (e.g. inline) factories can still be collected; a
// separate strong registry only holds the module-level factories we may want to
// pre-build for the inactive theme.
const styleCache = new WeakMap<StyleFactory, Map<ForgeTheme, unknown>>();
const knownFactories = new Set<StyleFactory>();

function resolveStyles(factory: StyleFactory, theme: ForgeTheme): unknown {
  let byTheme = styleCache.get(factory);
  if (!byTheme) {
    byTheme = new Map();
    styleCache.set(factory, byTheme);
    knownFactories.add(factory);
  }
  let styles = byTheme.get(theme);
  if (styles === undefined) {
    styles = makeStyles(factory as (theme: ForgeTheme) => StyleSheet.NamedStyles<any>)(theme);
    byTheme.set(theme, styles);
  }
  return styles;
}

/**
 * Pre-build every registered factory's StyleSheet for `theme` off the input
 * path. Called for the inactive appearance so the first switch to it is a cache
 * hit rather than a synchronous rebuild of the whole tree on one frame.
 */
export function warmThemedStyles(theme: ForgeTheme): void {
  knownFactories.forEach((factory) => {
    resolveStyles(factory, theme);
  });
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: ForgeTheme) => T,
): T {
  const theme = useForgeTheme();
  return useMemo(() => resolveStyles(factory as StyleFactory, theme) as T, [factory, theme]);
}
