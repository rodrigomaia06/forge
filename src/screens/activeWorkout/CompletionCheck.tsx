import { ForgePressable as Pressable, centeredPressFeedback } from '../../components/ui/ForgePressable';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Icon } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../../theme/motion';
import { scaleUI } from '../../theme/scale';

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
          size={scaleUI(17)}
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
 * second fills it fully (both done). A further tap clears it. The half-fill sits
 * on the leading side (the side completed first), so the filled half tells the
 * user which side is already done.
 */
export function SplitCompletionCheck({
  done,
  leadSide = 'left',
  onAdvance,
  accessibilityLabel,
  testID,
}: {
  /** Number of sides completed: 0, 1, or 2. */
  done: number;
  /** Side completed first; the half-fill mirrors it. */
  leadSide?: 'left' | 'right';
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
      pressFeedbackStyle={styles.checkFeedback}
    >
      <View style={[styles.splitVisual, complete && styles.success, half && styles.sideProgress]}>
        {complete ? <Icon name="check" size={scaleUI(17)} color={theme.surface} /> : null}
        {half ? <View style={[styles.halfFill, leadSide === 'right' ? styles.halfFillRight : styles.halfFillLeft]} /> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
  visual: {
    width: scaleUI(30),
    height: scaleUI(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    // A filled tonal surface (like the row's inputs/chips) so the empty check reads as a
    // clear button rather than a faint ring that blends into the card. Selected tones
    // (success/interactive/selection) override this below.
    backgroundColor: dashboardTheme.surfaceMuted,
    borderRadius: scaleUI(15),
  },
  success: { backgroundColor: dashboardTheme.success, borderColor: dashboardTheme.success },
  interactive: { backgroundColor: dashboardTheme.selectionIndicator, borderColor: dashboardTheme.selectionIndicator },
  selection: { borderColor: dashboardTheme.success, backgroundColor: 'transparent' },
  // The unilateral control reuses the single-check 44pt target, so its column
  // matches every other set row exactly.
  checkPressable: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkFeedback: centeredPressFeedback(scaleUI(30), scaleUI(15)),
  // Its own 26pt circle that clips the half-fill (the shared `visual` is left
  // untouched so the ordinary check animation is unaffected).
  splitVisual: {
    width: scaleUI(30),
    height: scaleUI(30),
    borderRadius: scaleUI(15),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  // One side done: green ring with one half filled, reading as "half done". The
  // filled half is the leading side, so it names which side is already complete.
  sideProgress: { borderColor: dashboardTheme.success },
  halfFill: { position: 'absolute', top: 0, bottom: 0, width: '50%', backgroundColor: dashboardTheme.success },
  halfFillLeft: { left: 0 },
  halfFillRight: { right: 0 },
  });
};
