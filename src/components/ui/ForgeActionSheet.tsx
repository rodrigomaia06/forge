import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeText as Text } from './ForgeText';
import { HeaderAction } from './HeaderAction';
import { Icon } from './Icon';
import { errorHaptic, selectionHaptic } from './haptics';
import { pressedFeedback } from './pressFeedback';
import { ForgeSheetHeader } from './ForgeSheetHeader';

export interface ForgeActionSheetAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'neutral' | 'destructive';
  disabled?: boolean;
  accessibilityLabel?: string;
}

interface ForgeActionSheetProps {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  title: string;
  actions: readonly ForgeActionSheetAction[];
  testID?: string;
  initialOffset?: number;
  closeDistance?: number;
  dismissThreshold?: number;
}

/** Shared Forge presentation for bottom-attached action lists. */
export function ForgeActionSheet({
  visible,
  onClose,
  accessibilityLabel,
  title,
  actions,
  testID,
  initialOffset,
  closeDistance,
  dismissThreshold,
}: ForgeActionSheetProps) {
  const theme = useForgeTheme();
  const neutralActions = actions.filter((action) => (action.tone ?? 'neutral') === 'neutral');
  const destructiveActions = actions.filter((action) => action.tone === 'destructive');
  const headerDestructiveAction = destructiveActions[0];

  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={accessibilityLabel}
      surfaceTestID={testID}
      initialOffset={initialOffset}
      closeDistance={closeDistance}
      dismissThreshold={dismissThreshold}
    >
      {(close) => (
        <View style={styles.sheet}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={title}
            onClose={close}
            closePosition={headerDestructiveAction ? 'left' : 'right'}
            trailing={
              headerDestructiveAction ? (
                <HeaderAction
                  accessibilityLabel={headerDestructiveAction.accessibilityLabel ?? headerDestructiveAction.label}
                  icon={headerDestructiveAction.icon}
                  iconOnly
                  tone="destructive"
                  haptic="none"
                  disabled={headerDestructiveAction.disabled}
                  onPress={() => {
                    errorHaptic();
                    close();
                    headerDestructiveAction.onPress();
                  }}
                />
              ) : undefined
            }
          />
          {neutralActions.length > 0 && (
            <View style={[styles.actionList, { borderColor: theme.border }]}>
              {neutralActions.map((action, index) => (
                <ActionRow
                  key={action.label}
                  action={action}
                  close={close}
                  divider={index < neutralActions.length - 1}
                />
              ))}
            </View>
          )}
          {destructiveActions.length > 1 && (
            <View
              style={[
                styles.destructiveList,
                { borderColor: theme.textDestructive, backgroundColor: theme.destructiveSurface },
              ]}
            >
              {destructiveActions.slice(1).map((action) => (
                <ActionRow key={action.label} action={action} close={close} />
              ))}
            </View>
          )}
        </View>
      )}
    </ForgeBottomSheet>
  );
}

function ActionRow({
  action,
  close,
  divider = false,
}: {
  action: ForgeActionSheetAction;
  close: () => void;
  divider?: boolean;
}) {
  const theme = useForgeTheme();
  const destructive = action.tone === 'destructive';
  const color = destructive ? theme.textDestructive : theme.textPrimary;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel ?? action.label}
        accessibilityState={{ disabled: action.disabled }}
        disabled={action.disabled}
        onPress={() => {
          if (destructive) errorHaptic();
          else selectionHaptic();
          close();
          action.onPress();
        }}
      style={({ pressed }) => [
        styles.actionRow,
          destructive && styles.destructiveAction,
          action.disabled && styles.disabledAction,
          pressed && pressedFeedback,
        ]}
      >
        <View
          style={[
            styles.iconTile,
            {
              backgroundColor: destructive ? theme.destructiveSurfacePressed : theme.surfaceMuted,
              borderColor: destructive ? theme.textDestructive : theme.border,
            },
          ]}
        >
          <Icon name={action.icon} size={21} color={action.disabled ? theme.textDisabled : color} />
        </View>
        <Text style={[styles.actionLabel, { color: action.disabled ? theme.textDisabled : color }]}>
          {action.label}
        </Text>
        <Icon
          name="chevron-forward"
          size={19}
          color={action.disabled ? theme.textDisabled : destructive ? theme.textDestructive : theme.textSecondary}
        />
      </Pressable>
      {divider && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingBottom: 30 },
  actionList: {
    marginHorizontal: 20,
    // Keep the compact list close to the title after removing the contextual card.
    // This changes its position, not the row density.
    marginTop: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 16,
  },
  destructiveList: {
    marginHorizontal: 20,
    marginTop: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 16,
  },
  actionRow: {
    minHeight: 62,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  destructiveAction: { minHeight: 64 },
  disabledAction: { opacity: 0.68 },
  actionLabel: { ...typeScale.controlLabel, flex: 1 },
  iconTile: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 11,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});
