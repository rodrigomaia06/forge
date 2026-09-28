import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { forgeMotion } from '../../theme/motion';
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

  // Keep the Modal mounted through its fade-out: the RN Modal only animates its
  // exit while it stays rendered with `visible` toggling false, so unmounting on
  // !visible would snap the card away. Defer the unmount until the fade finishes,
  // and keep showing the last content so the text does not blank out mid-fade
  // when the caller clears its state.
  const [rendered, setRendered] = React.useState(visible);
  const [shown, setShown] = React.useState({ title, message, cancelLabel, confirmLabel, confirmTone, showCancel });

  React.useEffect(() => {
    if (visible) {
      setRendered(true);
      // Pulse a haptic the moment the dialog appears, so the tactile cue lands
      // with the card rather than trailing the fade-in.
      mediumHaptic();
      return;
    }
    const timer = setTimeout(() => setRendered(false), forgeMotion.sheetExit);
    return () => clearTimeout(timer);
  }, [visible]);

  // Keep the shown copy current while open; it is retained through the fade-out.
  React.useEffect(() => {
    if (visible) setShown({ title, message, cancelLabel, confirmLabel, confirmTone, showCancel });
  }, [visible, title, message, cancelLabel, confirmLabel, confirmTone, showCancel]);

  if (!rendered) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel} onDismiss={() => setRendered(false)}>
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
          <Text style={[styles.title, { color: theme.textPrimary }]}>{shown.title}</Text>
          <Text style={[styles.message, { color: theme.slate }]}>{shown.message}</Text>
          <View style={styles.actions}>
            {shown.showCancel ? <Button
                accessibilityLabel={shown.cancelLabel}
                label={shown.cancelLabel}
                variant="primary"
                onPress={onCancel}
                haptic="light"
                style={styles.action}
              /> : null}
            <Button
              accessibilityLabel={shown.confirmLabel}
              label={shown.confirmLabel}
              variant="primary"
              tone={shown.confirmTone}
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
