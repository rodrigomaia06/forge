import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { ForgeControlSurface } from './ForgeControlSurface';

/**
 * The one Forge card surface. Separation is tone-first (see .agents/rules/design.md):
 * - `base` (default): a card on a screen background or a sheet. Its surface tone
 *   alone separates it — no outline in either theme.
 * - `nested`: a card placed inside another card. It steps one tone up and is
 *   borderless like the base card — separated by tone in Dark and by a soft shadow
 *   in Light, so it never shows a grey outline.
 * Screens must not hand-roll a card border/background; use this primitive.
 */
export type ForgeCardVariant = 'base' | 'nested';

export function ForgeCard({
  children,
  style,
  variant = 'base',
  size = 'standard',
  testID,
  segment,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ForgeCardVariant;
  /** Compact grouped rows retain Forge card treatment with a smaller corner radius. */
  size?: 'standard' | 'compact';
  testID?: string;
  /** Joined virtualized rows share the card surface without gaps or interior corners. */
  segment?: 'first' | 'middle' | 'last' | 'only';
}) {
  const theme = useForgeTheme();
  const nested = variant === 'nested';
  const surface = StyleSheet.flatten(style)?.backgroundColor;
  const parentColor = typeof surface === 'string' ? surface : nested ? theme.surfaceElevated : theme.surface;
  return (
    <ForgeControlSurface.Provider value={parentColor}>
    <View
      testID={testID}
      style={[
        styles.card,
        size === 'compact' && styles.compact,
        {
          backgroundColor: nested ? theme.surfaceElevated : theme.surface,
          // Borderless cards separate by tone in both themes, with a soft Light shadow.
          borderWidth: 0,
          shadowColor: theme.shadow,
          shadowOpacity: theme.cardShadowOpacity ?? 0.06,
        },
        segment &&
          segment !== 'only' && {
            borderRadius: 0,
            shadowOpacity: 0,
            elevation: 0,
            borderTopLeftRadius: segment === 'first' ? scaleUI(18) : 0,
            borderTopRightRadius: segment === 'first' ? scaleUI(18) : 0,
            borderBottomLeftRadius: segment === 'last' ? scaleUI(18) : 0,
            borderBottomRightRadius: segment === 'last' ? scaleUI(18) : 0,
          },
        style,
      ]}
    >
      {children}
    </View>
    </ForgeControlSurface.Provider>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: scaleUI(24),
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  compact: { borderRadius: scaleUI(18) },
});
