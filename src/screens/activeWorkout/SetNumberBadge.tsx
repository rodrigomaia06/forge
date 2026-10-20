import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ForgeText as Text } from '../../components/ui';
import { setRirText } from '../../domain/workouts/setEffort';
import { hasNextSessionTarget, setTagPresentation } from '../../domain/workouts/setPresentation';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { typeScale } from '../../theme/tokens';
import type { WorkoutSet } from '../../types';

export function useSetNumberBadgeLayout() {
  return {
    width: scaleUI(36),
    height: scaleUI(36),
    feedback: { borderRadius: scaleUI(9) },
  };
}

export function SetNumberBadge({
  set,
  index,
  testID,
}: {
  set: WorkoutSet;
  index: number;
  testID: string;
}) {
  const theme = useForgeTheme();
  const tag = setTagPresentation(set.tag);
  const { width, height } = useSetNumberBadgeLayout();
  const rir = setRirText(set);
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
          style={[styles.dot, styles.target, { backgroundColor: theme.ink }]}
        />
      ) : null}
      {rir ? (
        <View
          accessibilityLabel={`Set ${index + 1} RIR ${rir}`}
          style={[styles.dot, styles.rir, { backgroundColor: theme.ink }]}
        />
      ) : null}
      {set.comment?.trim() ? (
        <View
          accessibilityLabel={`Set ${index + 1} has a comment`}
          style={[styles.dot, styles.comment, { backgroundColor: theme.ink }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scaleUI(9),
  },
  dot: { position: 'absolute', width: scaleUI(5), height: scaleUI(5), borderRadius: scaleUI(2.5) },
  target: { top: scaleUI(4), left: scaleUI(4) },
  rir: { bottom: scaleUI(4), left: scaleUI(4) },
  comment: { bottom: scaleUI(4), right: scaleUI(4) },
  numberArea: { alignItems: 'center' },
  centeredNumber: { alignItems: 'center', justifyContent: 'center' },
  number: { ...typeScale.controlLabel, lineHeight: scaleUI(18) },
});
