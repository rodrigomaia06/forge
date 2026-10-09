import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ForgeText as Text } from '../../components/ui';
import { centeredPressFeedback } from '../../components/ui/ForgePressable';
import { measurementText } from '../../domain/exercises/tracking';
import { hasNextSessionTarget, setTagPresentation } from '../../domain/workouts/setPresentation';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { maxFontSizeMultiplier, typeScale } from '../../theme/tokens';
import type { WorkoutSet } from '../../types';

export function useSetNumberBadgeLayout(hasEffort: boolean) {
  const { fontScale } = useWindowDimensions();
  const growth = Math.max(0, Math.min(fontScale, maxFontSizeMultiplier) - 1);
  const width = scaleUI(hasEffort ? 40 : 32) + growth * 12;
  const height = scaleUI(hasEffort ? 48 : 32) + growth * (hasEffort ? 48 : 36);
  return { width, height, feedback: centeredPressFeedback(width, scaleUI(9), height) };
}

export function SetNumberBadge({
  set,
  index,
  testID,
  showEffort = true,
}: {
  set: WorkoutSet;
  index: number;
  testID: string;
  showEffort?: boolean;
}) {
  const theme = useForgeTheme();
  const tag = setTagPresentation(set.tag);
  const rpe = showEffort ? measurementText(set, 'rpe') : '';
  const { width, height } = useSetNumberBadgeLayout(Boolean(rpe));
  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        { width, height, backgroundColor: tag ? `${tag.color}20` : theme.surfaceMuted },
      ]}
    >
      <View style={[styles.numberArea, styles.centeredNumber]}>
        <Text
          testID={`${testID}-number`}
          style={[styles.number, { color: tag?.color ?? theme.ink }]}
        >
          {tag?.letter ?? index + 1}
        </Text>
      </View>
      {hasNextSessionTarget(set) ? (
        <View
          accessibilityLabel={`Set ${index + 1} has a next session target`}
          style={[styles.target, { backgroundColor: theme.setTargetIndicator }]}
        />
      ) : null}
      {rpe ? (
        <Text
          accessibilityLabel={`Set ${index + 1} RPE ${rpe}`}
          style={[styles.effort, { color: theme.ink }]}
        >
          {rpe}
        </Text>
      ) : null}
      {set.comment?.trim() ? (
        <View
          accessibilityLabel={`Set ${index + 1} has a comment`}
          style={[styles.comment, { backgroundColor: theme.ink }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'relative', borderRadius: scaleUI(9) },
  numberArea: { position: 'absolute', top: scaleUI(2), left: scaleUI(4), right: scaleUI(4) },
  centeredNumber: { bottom: scaleUI(2), alignItems: 'center', justifyContent: 'center' },
  number: { ...typeScale.controlLabel, lineHeight: scaleUI(18) },
  effort: {
    position: 'absolute',
    left: scaleUI(4),
    bottom: scaleUI(1),
    ...typeScale.caption,
    lineHeight: scaleUI(14),
    fontVariant: ['tabular-nums'],
  },
  target: {
    position: 'absolute',
    top: scaleUI(4),
    left: scaleUI(4),
    width: scaleUI(7),
    height: scaleUI(7),
    borderRadius: scaleUI(3.5),
  },
  comment: {
    position: 'absolute',
    bottom: scaleUI(5),
    right: scaleUI(4),
    width: scaleUI(7),
    height: scaleUI(7),
    borderRadius: scaleUI(3.5),
  },
});
