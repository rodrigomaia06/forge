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
 * A checkmark divided into two tappable halves for a unilateral set: the left
 * and right side are completed independently, and the set is done only when both
 * are filled. It occupies the same 44pt control column as the single check.
 */
export function SplitCompletionCheck({
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
    <View testID={testID} style={styles.splitRow}>
      <SplitHalf side="left" done={left} onPress={onToggleLeft} />
      <SplitHalf side="right" done={right} onPress={onToggleRight} />
    </View>
  );
}

function SplitHalf({ side, done, onPress }: { side: 'left' | 'right'; done: boolean; onPress: () => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const label = side === 'left' ? 'L' : 'R';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${done ? 'Completed' : 'Complete'} ${side} side`}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: side === 'left' ? 8 : 3, right: side === 'right' ? 8 : 3 }}
      style={[
        styles.splitHalf,
        side === 'left' ? styles.splitHalfLeft : styles.splitHalfRight,
        done && styles.splitHalfDone,
      ]}
    >
      {done ? (
        <Icon name="check" size={16} color={theme.surface} />
      ) : (
        <Text style={[styles.splitHalfLabel, done && styles.splitHalfLabelDone]}>{label}</Text>
      )}
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
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Two comfortably tappable side buttons (was a cramped 19px pair).
  splitHalf: {
    width: 30,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    borderRadius: 11,
  },
  splitHalfLeft: {},
  splitHalfRight: {},
  splitHalfDone: { backgroundColor: dashboardTheme.success, borderColor: dashboardTheme.success },
  splitHalfLabel: { color: dashboardTheme.ink, ...typeScale.cardTitle },
  splitHalfLabelDone: { color: dashboardTheme.surface },
  });
};
