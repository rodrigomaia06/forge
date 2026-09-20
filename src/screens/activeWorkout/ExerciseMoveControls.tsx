import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, pressedFeedback } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import type { ForgeTheme } from '../../types';

/**
 * Tap up/down reorder controls for an exercise row. Used in place of drag on the
 * editors so reordering is reliable on web (drag-and-drop libraries do not track
 * a mouse drag on web) as well as on native.
 */
export function ExerciseMoveControls({
  name,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles();
  return (
    <View style={styles.rail}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Move ${name} up`}
        disabled={!canMoveUp}
        onPress={onMoveUp}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="arrow-up" size={18} color={canMoveUp ? theme.ink : theme.divider} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Move ${name} down`}
        disabled={!canMoveDown}
        onPress={onMoveDown}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="arrow-down" size={18} color={canMoveDown ? theme.ink : theme.divider} />
      </Pressable>
    </View>
  );
}

function useThemedStyles() {
  const theme = useForgeTheme();
  return React.useMemo(() => createStyles(theme), [theme]);
}

const createStyles = (theme: ForgeTheme) =>
  StyleSheet.create({
    rail: { width: 34, marginLeft: -6, alignItems: 'center', justifyContent: 'center', gap: 2 },
    button: { width: 34, minHeight: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    pressed: { backgroundColor: theme.pressed },
  });
