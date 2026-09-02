import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeText as Text } from './ForgeText';
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

export interface ForgeActionSheetContext {
  eyebrow: string;
  title: string;
  icon: IconName;
}

interface ForgeActionSheetProps {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  title: string;
  actions: readonly ForgeActionSheetAction[];
  context?: ForgeActionSheetContext;
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
  context,
  testID,
  initialOffset,
  closeDistance,
  dismissThreshold,
}: ForgeActionSheetProps) {
  const theme = useForgeTheme();
  const neutralActions = actions.filter((action) => (action.tone ?? 'neutral') === 'neutral');
  const destructiveActions = actions.filter((action) => action.tone === 'destructive');

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
          <ForgeSheetHeader title={title} onClose={close} />
          {context ? (
            <View
              testID={testID ? `${testID}-context` : undefined}
              style={[
                styles.contextCard,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <View style={[styles.contextIcon, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
                <Icon name={context.icon} size={22} color={theme.selectionIndicator} />
              </View>
              <View style={styles.contextCopy}>
                <Text style={[styles.contextEyebrow, { color: theme.textSecondary }]}>
                  {context.eyebrow}
                </Text>
                <Text numberOfLines={1} style={[styles.contextTitle, { color: theme.textPrimary }]}>
                  {context.title}
                </Text>
              </View>
            </View>
          ) : null}
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
          {destructiveActions.length > 0 && (
            <View
              style={[
                styles.destructiveList,
                { borderColor: theme.textDestructive, backgroundColor: theme.destructiveSurface },
              ]}
            >
              {destructiveActions.map((action) => (
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
  sheet: { paddingBottom: 24 },
  contextCard: {
    minHeight: 72,
    marginHorizontal: 20,
    marginTop: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  contextIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  contextCopy: { flex: 1, minWidth: 0, gap: 2 },
  contextEyebrow: { ...typeScale.label, letterSpacing: 0.7, fontWeight: '700' },
  contextTitle: { ...typeScale.cardTitle },
  actionList: {
    marginHorizontal: 20,
    marginTop: 16,
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
