import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { dashboardTheme } from '../../theme/dashboardTheme';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { IconName } from '../../types';
import { ForgeText as Text } from './ForgeText';
import { Icon } from './Icon';
import { selectionHaptic } from './haptics';

export interface AnchoredPopoverAction {
  label: string;
  icon: IconName;
  onPress: () => void;
}

export function AnchoredActionPopover({
  visible,
  onClose,
  actions,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  actions: AnchoredPopoverAction[];
  testID?: string;
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  // The overlay stays mounted so the popover's exit animation can play; only its
  // contents toggle. `box-none` lets touches pass through when nothing is shown.
  return (
    <View style={[StyleSheet.absoluteFill, styles.pointerEventsBoxNone]}>
      {visible ? (
        <>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss actions" onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View
        testID={testID}
        entering={reducedMotion ? undefined : FadeIn.duration(forgeMotion.state)}
        exiting={reducedMotion ? undefined : FadeOut.duration(forgeMotion.feedback)}
        style={[styles.popover, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadow }]}
      >
        {actions.map((action, index) => (
          <React.Fragment key={action.label}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                selectionHaptic();
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.action, pressed && [styles.pressed, { backgroundColor: theme.pressed }]]}
            >
              <Icon name={action.icon} size={19} color={theme.textPrimary} />
              <Text style={[styles.label, { color: theme.textPrimary }]}>{action.label}</Text>
            </Pressable>
            {index < actions.length - 1 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
          </React.Fragment>
        ))}
      </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pointerEventsBoxNone: { pointerEvents: 'box-none', zIndex: 4, elevation: 16 },
  popover: {
    position: 'absolute',
    // Keep the menu just below the header action; it must never overlap the plus control.
    top: 62,
    right: 20,
    width: 216,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: dashboardTheme.surface,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    shadowColor: '#17191C',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  action: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  label: { color: dashboardTheme.ink, ...typeScale.controlLabel },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46, backgroundColor: dashboardTheme.divider },
  pressed: { backgroundColor: dashboardTheme.surfaceMuted },
});
