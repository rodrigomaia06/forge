import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ForgeText as Text } from '../../components/ui';
import { measurementText } from '../../domain/exercises/tracking';
import { hasNextSessionTarget, setTagPresentation } from '../../domain/workouts/setPresentation';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { typeScale } from '../../theme/tokens';
import type { WorkoutSet } from '../../types';

export function useSetNumberBadgeLayout(hasEffort: boolean) {
  const width = scaleUI(hasEffort ? 40 : 32);
  const height = scaleUI(hasEffort ? 48 : 32);
  return { width, height, feedback: { borderRadius: scaleUI(9) } };
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
        { minWidth: width, minHeight: height, backgroundColor: tag ? `${tag.color}20` : theme.surfaceMuted },
      ]}
    >
      {rpe ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden><Text style={[styles.effort, { opacity: 0 }]}>{rpe}</Text></View> : null}
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
  badge: { position: 'relative', alignItems: 'center', justifyContent: 'center', paddingVertical: scaleUI(4), paddingHorizontal: scaleUI(12), borderRadius: scaleUI(9) },
  numberArea: { alignItems: 'center' },
  centeredNumber: { alignItems: 'center', justifyContent: 'center' },
  number: { ...typeScale.controlLabel, lineHeight: scaleUI(18) },
  effort: {
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
