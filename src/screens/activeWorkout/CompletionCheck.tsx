import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon, ForgeText as Text } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
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
 * A full-width Left / Right completion bar for a unilateral set. Both sides share
 * the set's weight/reps; each side is a large, clearly-labelled tap target, and
 * the set is done only once both are filled. It sits under the set's inputs so
 * every side gets a proper touch target without shrinking the input columns.
 */
export function SideCompletionBar({
  left,
  right,
  onToggleLeft,
  onToggleRight,
  testID,
}: {
  left: boolean;
  right: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  testID?: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View testID={testID} style={styles.sideBar}>
      <SideButton side="left" done={left} onPress={onToggleLeft} />
      <SideButton side="right" done={right} onPress={onToggleRight} />
    </View>
  );
}

function SideButton({ side, done, onPress }: { side: 'left' | 'right'; done: boolean; onPress: () => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const label = side === 'left' ? 'Left' : 'Right';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${done ? 'Completed' : 'Complete'} ${side} side`}
      onPress={onPress}
      style={[styles.sideButton, done && styles.sideButtonDone]}
    >
      {done ? <Icon name="check" size={16} color={theme.surface} /> : null}
      <Text style={[styles.sideButtonLabel, done && styles.sideButtonLabelDone]}>{label}</Text>
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
  // Full-width Left/Right bar beneath the set inputs: two big shared-input side
  // targets, so every side is comfortable to tap and no input column shrinks.
  sideBar: { flexDirection: 'row', gap: 8, marginTop: 8 },
  sideButton: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
  },
  sideButtonDone: { backgroundColor: dashboardTheme.success, borderColor: dashboardTheme.success },
  sideButtonLabel: { color: dashboardTheme.ink, ...typeScale.controlLabel },
  sideButtonLabelDone: { color: dashboardTheme.surface },
  });
};
