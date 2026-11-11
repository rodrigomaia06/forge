import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { Button } from './Button';
import { ForgeText as Text } from './ForgeText';
import { mediumHaptic } from './haptics';

export interface ForgeConfirmationDialogProps {
  visible: boolean;
  /** Render above content in an existing modal host. */
  presentation?: 'modal' | 'embedded';
  busy?: boolean;
  error?: string;
  title: string;
  message?: string;
  children?: React.ReactNode;
  actionTreatment?: 'default' | 'form';
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
  presentation = 'modal',
  busy = false,
  error,
  title,
  message,
  children,
  actionTreatment = 'default',
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmTone = 'destructive',
  showCancel = true,
  testID,
}: ForgeConfirmationDialogProps) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();

  // Forge owns the dialog motion instead of the platform Modal fade: the backdrop
  // fades while the card fades and grows from 0.96 (never from zero) with the shared
  // ease-out, then leaves a little faster than it arrived. Reduce Motion keeps only
  // the short fade. The host stays mounted through the exit, and keeps showing the
  // last content so the text does not blank out mid-fade when the caller clears it.
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withTiming(
      visible ? 1 : 0,
      visible
        ? { duration: forgeMotion.transition, easing: forgeMotion.easing }
        : { duration: forgeMotion.state, easing: forgeMotion.sheetExitEasing },
    );
  }, [progress, visible]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardMotionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reducedMotion ? 1 : 0.96 + progress.value * 0.04 }],
  }));
  const [rendered, setRendered] = React.useState(visible);
  const [shown, setShown] = React.useState({
    title,
    message,
    children,
    actionTreatment,
    cancelLabel,
    confirmLabel,
    confirmTone,
    showCancel,
  });

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
    if (visible)
      setShown({
        title,
        message,
        children,
        actionTreatment,
        cancelLabel,
        confirmLabel,
        confirmTone,
        showCancel,
      });
  }, [
    visible,
    title,
    message,
    children,
    actionTreatment,
    cancelLabel,
    confirmLabel,
    confirmTone,
    showCancel,
  ]);

  if (!rendered) return null;
  const cancel = () => {
    if (!busy) onCancel();
  };
  const content = (
    <View
      style={[styles.backdrop, presentation === 'embedded' && StyleSheet.absoluteFill]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, backdropStyle]} />
      <Pressable accessible={false} onPress={cancel} style={StyleSheet.absoluteFill} />
      <Animated.View
        testID={testID}
        accessibilityRole="alert"
        accessibilityViewIsModal
        style={[
          styles.card,
          shown.actionTreatment === 'form' && styles.formCard,
          {
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.border,
            shadowColor: theme.shadow,
            borderRadius: theme.cardRadius,
          },
          cardMotionStyle,
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{shown.title}</Text>
        {shown.message ? (
          <Text style={[styles.message, { color: theme.slate }]}>{shown.message}</Text>
        ) : null}
        {shown.children ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            bounces={false}
          >
            {shown.children}
          </ScrollView>
        ) : null}
        {error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.message, { color: theme.textDestructive }]}
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {shown.showCancel ? (
            <Button
              accessibilityLabel={shown.cancelLabel}
              label={shown.cancelLabel}
              disabled={busy}
              variant={shown.actionTreatment === 'form' ? 'ghost' : 'primary'}
              onPress={cancel}
              haptic="light"
              style={styles.action}
            />
          ) : null}
          <Button
            accessibilityLabel={shown.confirmLabel}
            label={shown.confirmLabel}
            loading={busy}
            disabled={busy}
            variant={shown.actionTreatment === 'form' ? 'outline' : 'primary'}
            icon={shown.actionTreatment === 'form' ? 'check' : undefined}
            labelStyle={shown.actionTreatment === 'form' ? { color: theme.textPrimary } : undefined}
            tone={shown.confirmTone}
            onPress={onConfirm}
            haptic="medium"
            style={styles.action}
          />
        </View>
      </Animated.View>
    </View>
  );
  if (presentation === 'embedded') return content;
  return (
    <Modal transparent animationType="none" visible={rendered} onRequestClose={cancel}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  scrim: { backgroundColor: 'rgba(0,0,0,0.48)' },
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
  formCard: { maxHeight: '90%' },
  body: { marginTop: 16, flexShrink: 1 },
  bodyContent: { flexGrow: 1 },
  actions: { marginTop: 20, gap: 10 },
  action: { width: '100%' },
});
