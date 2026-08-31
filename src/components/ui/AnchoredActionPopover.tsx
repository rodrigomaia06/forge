import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dashboardTheme } from '../../theme/dashboardTheme';
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
  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss actions" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View testID={testID} style={[styles.popover, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadow }]}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
    top: 62,
    right: 20,
    width: 216,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: dashboardTheme.surface,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    shadowColor: '#17191C',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  action: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  label: { color: dashboardTheme.ink, ...typeScale.controlLabel },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46, backgroundColor: dashboardTheme.divider },
  pressed: { backgroundColor: dashboardTheme.surfaceMuted },
});
