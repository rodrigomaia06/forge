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
import { SheetCloseButton } from './SheetCloseButton';

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
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            <SheetCloseButton
              accessibilityLabel={`Close ${title}`}
              onPress={close}
              style={styles.close}
            />
          </View>
          {neutralActions.length > 0 && (
            <View style={styles.actionList}>
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
            <View style={[styles.destructiveList, { borderTopColor: theme.divider }]}>
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
        <Icon name={action.icon} size={22} color={action.disabled ? theme.textDisabled : color} />
        <Text style={[styles.actionLabel, { color: action.disabled ? theme.textDisabled : color }]}>
          {action.label}
        </Text>
      </Pressable>
      {divider && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingBottom: 20 },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  title: { ...typeScale.headerTitle, textAlign: 'center', marginHorizontal: 72 },
  close: { position: 'absolute', right: 20 },
  actionList: { marginTop: 6 },
  destructiveList: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actionRow: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  destructiveAction: { minHeight: 60 },
  disabledAction: { opacity: 0.68 },
  actionLabel: { ...typeScale.controlLabel, flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
});
