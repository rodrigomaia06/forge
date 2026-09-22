import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../../theme/motion';

export function CompletionCheck({
  selected,
  testID,
  tone = 'success',
}: {
  selected: boolean;
  testID?: string;
  tone?: 'success' | 'interactive' | 'selection';
}) {
  const theme = useForgeTheme();
  const dashboardTheme = theme;
  const styles = useThemedStyles(createStyles);
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const reducedMotion = useForgeReducedMotion();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: forgeMotionDuration(reducedMotion, forgeMotion.transition),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress, reducedMotion, selected]);

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.visual,
        selected && (
          tone === 'success'
            ? styles.success
            : tone === 'selection'
              ? styles.selection
              : styles.interactive
        ),
        {
          transform: [
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={{
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            },
          ],
        }}
      >
        <Icon
          name="check"
          size={15}
          color={tone === 'selection' ? dashboardTheme.success : dashboardTheme.surface}
        />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Two-step completion for a unilateral set, occupying the exact same 44pt column
 * as every other set's single check. Both sides share the set's inputs, so this
 * only tracks order: the first tap fills the check halfway (one side done), the
 * second fills it fully (both done). A further tap clears it. No left/right is
 * imposed — do whichever side first.
 */
export function SplitCompletionCheck({
  done,
  onAdvance,
  accessibilityLabel,
  testID,
}: {
  /** Number of sides completed: 0, 1, or 2. */
  done: number;
  onAdvance: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const complete = done >= 2;
  const half = done === 1;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: complete }}
      accessibilityLabel={accessibilityLabel}
      onPress={onAdvance}
      style={styles.checkPressable}
    >
      <View style={[styles.splitVisual, complete && styles.success, half && styles.sideProgress]}>
        {complete ? <Icon name="check" size={15} color={theme.surface} /> : null}
        {half ? <View style={styles.halfFill} /> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
  visual: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    borderRadius: 13,
  },
  success: { backgroundColor: dashboardTheme.success, borderColor: dashboardTheme.success },
  interactive: { backgroundColor: dashboardTheme.selectionIndicator, borderColor: dashboardTheme.selectionIndicator },
  selection: { borderColor: dashboardTheme.success, backgroundColor: 'transparent' },
  // The unilateral control reuses the single-check 44pt target, so its column
  // matches every other set row exactly.
  checkPressable: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Its own 26pt circle that clips the half-fill (the shared `visual` is left
  // untouched so the ordinary check animation is unaffected).
  splitVisual: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
  },
  // One side done: green ring with the left half filled, reading as "half done".
  sideProgress: { borderColor: dashboardTheme.success },
  halfFill: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', backgroundColor: dashboardTheme.success },
  });
};
