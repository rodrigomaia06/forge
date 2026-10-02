import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';

/**
 * The one Forge card surface. Separation is tone-first (see rules/design.md):
 * - `base` (default): a card on a screen background or a sheet. Its surface tone
 *   alone separates it — no outline in either theme.
 * - `nested`: a card placed inside another card. It steps one tone up and adds a
 *   single hairline border, because tone contrast against a sibling surface is
 *   too weak on its own.
 * Screens must not hand-roll a card border/background; use this primitive.
 */
export type ForgeCardVariant = 'base' | 'nested';

export function ForgeCard({
  children,
  style,
  variant = 'base',
  size = 'standard',
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ForgeCardVariant;
  /** Compact grouped rows retain Forge card treatment with a smaller corner radius. */
  size?: 'standard' | 'compact';
  testID?: string;
}) {
  const theme = useForgeTheme();
  const nested = variant === 'nested';
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        size === 'compact' && styles.compact,
        {
          backgroundColor: nested ? theme.surfaceElevated : theme.surface,
          borderColor: theme.border,
          borderWidth: nested ? 1 : 0,
          // The base card floats on its own soft shadow (Light) or pure tone
          // (Dark, where cardShadowOpacity is 0). A nested card is defined by its
          // hairline border instead, so it carries no shadow.
          shadowColor: theme.shadow,
          shadowOpacity: nested ? 0 : theme.cardShadowOpacity ?? 0.06,
        },
        style,
      ]}
    >
      {children}
    </View>
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
