import { restTimerColors } from '../../theme/tokens';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Button, ForgeBottomSheet, ForgeBottomSheetHandle, ForgeDurationWheel, ForgeSheetHeader, ForgeText as Text, Icon } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { createActiveWorkoutStyles } from './activeWorkoutStyles';
import { formatRest } from './activeWorkoutFormatters';
import type { RestTimerSheetProps } from './activeWorkoutTypes';
import { restTimerPhase, restTimerProgress } from '../../domain/rest/restTimerProgress';
import { useSynchronizedNow } from '../../domain/rest/synchronizedClock';

export function RestTimerIndicator({
  remaining,
  duration,
  running,
  endAt,
  onRemainingChange,
}: {
  remaining: number;
  duration: number;
  running: boolean;
  endAt?: number | null;
  onRemainingChange?: (remaining: number) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const liveRemaining = useLiveRemaining(endAt, remaining);
  useEffect(() => { onRemainingChange?.(liveRemaining); }, [liveRemaining, onRemainingChange]);
  const phase = restTimerPhase(liveRemaining, duration);
  const contentColor = !running ? theme.ink : phase === 'overdue'
    ? restTimerColors.overdue : phase === 'warning' ? restTimerColors.warning : theme.ink;

  return (
    <View style={styles.timerIndicator}>
      <Icon name="stopwatch-outline" size={22} color={contentColor} />
      {running && (
        <Text style={[styles.restValue, { color: contentColor }]}>{formatRest(liveRemaining)}</Text>
      )}
    </View>
  );
}

export function RestTimerSheet({
  visible,
  selectedDuration,
  endAt,
  remaining,
  duration,
  running,
  onClose,
  onSelect,
  onStart,
  onAdjust,
  onStop,
}: RestTimerSheetProps) {
  const styles = useThemedStyles(createActiveWorkoutStyles);
  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Close rest timer"
      initialOffset={420}
      closeDistance={520}
      dismissThreshold={260}
      backdropTestID="rest-timer-backdrop"
      surfaceTestID="rest-timer-sheet-surface"
      style={[styles.restTimerSheet, running ? styles.restTimerSheetActive : styles.restTimerSheetPicker]}
    >{(closeSheet) => <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title="Rest timer"
            onClose={closeSheet}
            closeAccessibilityLabel="Close rest timer"
            closePosition="left"
            trailing={running ? undefined : (
              <Button
                accessibilityLabel="Start rest timer"
                label="Start"
                variant="primary"
                haptic="none"
                onPress={onStart}
                style={styles.restStartAction}
              />
            )}
          />
          {running ? (
            <ActiveRestTimer
              remaining={remaining}
              duration={duration}
              endAt={endAt}
              onAdjust={onAdjust}
              onStop={() => {
                onStop();
                closeSheet();
              }}
            />
          ) : (
            <ForgeDurationWheel selectedDuration={selectedDuration} onSelect={onSelect} />
          )}
    </>}</ForgeBottomSheet>
  );
}

function ActiveRestTimer({
  remaining,
  duration,
  endAt,
  onAdjust,
  onStop,
}: {
  remaining: number;
  duration: number;
  endAt: number | null;
  onAdjust: (amount: number) => void;
  onStop: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const liveRemaining = useLiveRemaining(endAt, remaining);
  const progress = restTimerProgress(liveRemaining, duration);
  const isOverdue = liveRemaining < 0;
  const phase = restTimerPhase(liveRemaining, duration);
  const stateColor = phase === 'overdue' ? restTimerColors.overdue : phase === 'warning' ? restTimerColors.warning : theme.selectionIndicator;

  return (
    <View style={styles.activeRestTimer}>
      <View style={styles.restTimeDisplay}>
        <Text testID="rest-timer-value" style={[styles.restTimeValue, { color: stateColor }]}>
          {isOverdue ? `+${formatRest(liveRemaining)}` : formatRest(liveRemaining)}
        </Text>
        <Text style={[styles.restTimeCaption, isOverdue && { color: stateColor }]}>
          {isOverdue ? 'rest exceeded' : 'remaining'}
        </Text>
      </View>
      <View
        testID="rest-timer-progress-track"
        accessibilityRole="progressbar"
        accessibilityLabel="Rest timer progress"
        accessibilityValue={{ min: 0, max: Math.max(duration, 1), now: Math.max(0, liveRemaining) }}
        style={[styles.restProgressTrack, { backgroundColor: theme.surfaceMuted }]}
      >
        <View
          testID="rest-timer-progress-fill"
          style={[styles.restProgressFill, { width: `${progress * 100}%`, backgroundColor: stateColor }]}
        />
      </View>
      <View style={styles.restQuickActions}>
        {isOverdue ? (
          <>
            <Button
              accessibilityLabel="Extend rest by 10 seconds"
              label="+10s"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(10)}
              style={styles.restQuickButton}
            />
            <Button
              accessibilityLabel="Extend rest by 30 seconds"
              label="+30s"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(30)}
              style={styles.restQuickButton}
            />
          </>
        ) : (
          <>
            <Button
              accessibilityLabel="Decrease rest by 10 seconds"
              label="−10s"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(-10)}
              style={styles.restQuickButton}
            />
            <Button
              accessibilityLabel="Increase rest by 10 seconds"
              label="+10s"
              variant="outline"
              haptic="none"
              onPress={() => onAdjust(10)}
              style={styles.restQuickButton}
            />
          </>
        )}
      </View>
      <Button
        accessibilityLabel="Stop rest timer"
        label="Stop timer"
        variant="outline"
        tone="destructive"
        haptic="none"
        onPress={onStop}
        style={styles.restStopButton}
      />
    </View>
  );
}

/** The per-second heartbeat belongs only to timer visuals, never the workout screen. */
function useLiveRemaining(endAt: number | null | undefined, fallback: number): number {
  const now = useSynchronizedNow();
  return endAt ? Math.ceil((endAt - now) / 1000) : fallback;
}

