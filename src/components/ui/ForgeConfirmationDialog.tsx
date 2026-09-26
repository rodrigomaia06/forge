import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { Button } from './Button';
import { ForgeText as Text } from './ForgeText';
import { mediumHaptic } from './haptics';

interface ForgeConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmTone?: 'neutral' | 'destructive' | 'success';
  showCancel?: boolean;
  testID?: string;
}

/** A centred Forge decision card for choices that should interrupt the current flow. */
export function ForgeConfirmationDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmTone = 'destructive',
  showCancel = true,
  testID,
}: ForgeConfirmationDialogProps) {
  const theme = useForgeTheme();

  // Pulse a haptic the moment the dialog appears, so the tactile cue lands with
  // the card rather than trailing the fade-in. The opening button no longer
  // needs its own cue for this transition.
  React.useEffect(() => {
    if (visible) mediumHaptic();
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable
          accessible={false}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View
          testID={testID}
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              shadowColor: theme.shadow,
              borderRadius: theme.cardRadius,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.slate }]}>{message}</Text>
          <View style={styles.actions}>
            {showCancel ? <Button
                accessibilityLabel={cancelLabel}
                label={cancelLabel}
                variant="primary"
                onPress={onCancel}
                haptic="light"
                style={styles.action}
              /> : null}
            <Button
              accessibilityLabel={confirmLabel}
              label={confirmLabel}
              variant="primary"
              tone={confirmTone}
              onPress={onConfirm}
              haptic="medium"
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderWidth: 1,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  title: { ...typeScale.sectionTitle, textAlign: 'center' },
  message: { ...typeScale.body, marginTop: 8, textAlign: 'center' },
  actions: { marginTop: 20, gap: 10 },
  action: { width: '100%' },
});
