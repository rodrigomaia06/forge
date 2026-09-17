import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeDateTimePicker,
  ForgeBackButton,
  ForgeSheetHeader,
  ForgeSwitch,
  ForgeText as Text,
  lightHaptic,
  pressedFeedback,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { WeekStartsOn } from '../../types';

type DurationSheetView = 'settings' | 'date-picker' | 'time-picker';

export function WorkoutDurationSheet({
  visible,
  startedAt,
  automaticTracking,
  weekStartsOn,
  onClose,
  onAutomaticTrackingChange,
  onStartedAtChange,
  onResetStartTime,
}: {
  visible: boolean;
  startedAt: number;
  automaticTracking: boolean;
  weekStartsOn: WeekStartsOn;
  onClose: () => void;
  onAutomaticTrackingChange: (enabled: boolean) => void;
  onStartedAtChange: (startedAt: number) => void;
  onResetStartTime: () => void;
}) {
  const theme = useForgeTheme();
  const [view, setView] = useState<DurationSheetView>('settings');
  const [draftStartedAt, setDraftStartedAt] = useState(startedAt);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const started = new Date(startedAt);
  const date = formatDate(started);
  const time = formatTime(started);

  useEffect(() => {
    if (visible && view === 'settings') setDraftStartedAt(startedAt);
  }, [startedAt, view, visible]);

  const closeSheet = () => {
    setView('settings');
    setConfirmingReset(false);
    setDraftStartedAt(startedAt);
    onClose();
  };
  const openPicker = (nextView: Extract<DurationSheetView, 'date-picker' | 'time-picker'>) => {
    lightHaptic();
    setDraftStartedAt(startedAt);
    setView(nextView);
  };
  const discardPicker = () => {
    setDraftStartedAt(startedAt);
    setView('settings');
  };
  const savePicker = () => {
    onStartedAtChange(draftStartedAt);
    setView('settings');
  };

  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={closeSheet}
      accessibilityLabel="Close workout duration"
      initialOffset={320}
      closeDistance={420}
      surfaceTestID="workout-duration-sheet-surface"
      style={styles.sheet}
    >
      {(close) => view === 'settings' ? (
        <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title="Workout duration" onClose={close} closeAccessibilityLabel="Close workout duration" />
          <ForgeCard variant="nested" size="compact" style={styles.settingsCard}>
            <View accessibilityLabel={`Workout started ${date} at ${time}`} style={styles.startRow}>
              <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Start</Text>
              <View style={styles.startValues}>
                <Pressable accessibilityRole="button" accessibilityLabel="Choose workout start date" onPress={() => openPicker('date-picker')} style={({ pressed }) => [styles.valueChip, { backgroundColor: theme.surfaceMuted }, pressed && pressedFeedback]}>
                  <Text style={[styles.valueText, { color: theme.textPrimary }]}>{date}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Choose workout start time" onPress={() => openPicker('time-picker')} style={({ pressed }) => [styles.valueChip, styles.timeChip, { backgroundColor: theme.surfaceMuted }, pressed && pressedFeedback]}>
                  <Text style={[styles.valueText, { color: theme.textPrimary }]}>{time}</Text>
                </Pressable>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Automatic Time Tracking"
              accessibilityState={{ checked: automaticTracking }}
              aria-checked={automaticTracking}
              onPress={() => onAutomaticTrackingChange(!automaticTracking)}
              style={({ pressed }) => [styles.trackingRow, pressed && pressedFeedback]}
            >
              <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Automatic Time Tracking</Text>
              <ForgeSwitch value={automaticTracking} testID="workout-duration-automatic-switch" />
            </Pressable>
          </ForgeCard>
          <Button accessibilityLabel="Reset Start Time" label="Reset Start Time" variant="outline" tone="destructive" onPress={() => setConfirmingReset(true)} style={styles.resetButton} />
          <ForgeConfirmationDialog
            visible={confirmingReset}
            title="Reset start time?"
            message="This resets the workout duration to zero."
            cancelLabel="Keep current time"
            confirmLabel="Reset start time"
            onCancel={() => setConfirmingReset(false)}
            onConfirm={() => {
              setConfirmingReset(false);
              onResetStartTime();
            }}
            testID="reset-start-time-confirmation"
          />
        </>
      ) : (
        <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={view === 'date-picker' ? 'Start date' : 'Start time'}
            onClose={close}
            closeAccessibilityLabel="Close workout duration"
            leading={<BackButton onPress={discardPicker} />}
          />
          <ForgeDateTimePicker
            mode={view === 'date-picker' ? 'date' : 'time'}
            value={new Date(draftStartedAt)}
            onChange={(next) => setDraftStartedAt(next.getTime())}
            weekStartsOn={weekStartsOn}
            testID={view === 'date-picker' ? 'workout-duration-date-picker' : 'workout-duration-time-picker'}
          />
          <Button accessibilityLabel="Save workout start time" label="Done" onPress={savePicker} style={styles.doneButton} />
        </>
      )}
    </ForgeBottomSheet>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return <ForgeBackButton accessibilityLabel="Back to workout duration" onPress={onPress} />;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  sheet: { paddingBottom: 52, gap: 12 },
  settingsCard: { overflow: 'hidden', marginHorizontal: 20 },
  startRow: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1, minWidth: 0, ...typeScale.body },
  startValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueChip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  timeChip: { minWidth: 72 },
  valueText: { ...typeScale.supporting },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  trackingRow: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resetButton: { minHeight: 52, marginHorizontal: 20 },
  // Keep Done at the shared Button height rather than giving picker actions a local size.
  doneButton: { marginTop: 4, marginHorizontal: 20 },
});
