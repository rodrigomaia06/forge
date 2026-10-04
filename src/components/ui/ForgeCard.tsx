import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';

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
          // Borderless in both themes (no grey outline, matching Dark's feel). A
          // nested card separates by tone in Dark (surfaceElevated steps up from
          // surface) and by its soft shadow in Light (cardShadowOpacity > 0, where
          // the two surface tones are equal). Base cards already separate the same way.
          borderWidth: 0,
          shadowColor: theme.shadow,
          shadowOpacity: theme.cardShadowOpacity ?? 0.06,
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
