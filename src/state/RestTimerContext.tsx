import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { successHaptic } from '../components/ui/haptics';
import { useSettings } from './SettingsContext';
import { useWorkouts } from './WorkoutContext';

const restTimerNotificationId = 'forge-rest-timer-complete';
const restTimerChannelId = 'forge-rest-timer';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      // The active rest sheet already communicates completion. Keep foreground
      // feedback tactile/audible without layering a stock notification banner on it.
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: Boolean(notification.request.content.sound),
      shouldSetBadge: false,
    }),
  });
}

export interface RestTimerContextValue {
  endAt: number | null;
  duration: number;
  remaining: number;
  running: boolean;
  start: (duration: number) => void;
  adjust: (seconds: number) => void;
  stop: () => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

function restDurationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${remainder}s`;
}

async function canScheduleNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  if (!permissions.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function replaceRestTimerNotification(
  endAt: number | null,
  duration: number,
  soundEnabled: boolean,
): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(restTimerNotificationId).catch(() => undefined);
  if (!endAt || endAt <= Date.now() || !(await canScheduleNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: restTimerNotificationId,
    content: {
      title: 'Rest complete',
      body: `${restDurationLabel(duration)} complete. Back to work.`,
      sound: soundEnabled ? 'default' : false,
      data: { forgeTimer: 'rest' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(endAt),
      channelId: Platform.OS === 'android' ? restTimerChannelId : undefined,
    },
  });
}

/**
 * One rest-timer owner for the workout screen, the Forge dock, and iOS/Android
 * local-notification handoff. The countdown remains timestamp-derived so it is
 * correct after a tab change or a foreground resume.
 */
export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const { preferences } = useSettings();
  const { activeWorkout } = useWorkouts();
  const [endAt, setEndAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const didNotifyCompletion = useRef(false);
  const notificationQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void Notifications.setNotificationChannelAsync(restTimerChannelId, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 180, 90, 180],
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!endAt) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endAt]);

  const rawRemaining = endAt ? Math.ceil((endAt - now) / 1000) : 0;
  const remaining = endAt
    ? preferences.keepRestTimerRunning ? rawRemaining : Math.max(0, rawRemaining)
    : 0;
  const running = Boolean(endAt && (rawRemaining > 0 || preferences.keepRestTimerRunning));

  useEffect(() => {
    if (!endAt || now < endAt || didNotifyCompletion.current) return;
    didNotifyCompletion.current = true;
    if (preferences.restTimerHaptic) successHaptic();
    if (!preferences.keepRestTimerRunning) setEndAt(null);
  }, [endAt, now, preferences.keepRestTimerRunning, preferences.restTimerHaptic]);

  // Keep the system-owned end alert synchronized with every timer or
  // preference change. This also immediately removes it when the user hides
  // the rest timer, as the prior iPhone implementation did.
  useEffect(() => {
    // At expiry leave the already-due notification alone: cancelling it in
    // the same tick can race iOS/Android's sound and lock-screen delivery.
    if ((endAt && endAt <= now && didNotifyCompletion.current) || (!endAt && didNotifyCompletion.current)) return;
    notificationQueue.current = notificationQueue.current
      .then(() => replaceRestTimerNotification(
        preferences.showRestTimer ? endAt : null,
        duration,
        preferences.restTimerSound,
      ))
      .catch(() => undefined);
  }, [duration, endAt, now, preferences.restTimerSound, preferences.showRestTimer]);

  useEffect(() => {
    if (activeWorkout) return;
    didNotifyCompletion.current = false;
    setEndAt(null);
    setDuration(0);
  }, [activeWorkout]);

  const start = useCallback((nextDuration: number): void => {
    const safeDuration = Math.max(1, Math.round(nextDuration));
    const startedAt = Date.now();
    const nextEndAt = startedAt + safeDuration * 1000;
    didNotifyCompletion.current = false;
    setDuration(safeDuration);
    setNow(startedAt);
    setEndAt(nextEndAt);
  }, []);

  const adjust = useCallback((seconds: number): void => {
    const adjustedAt = Date.now();
    const currentRemaining = endAt ? Math.max(0, Math.ceil((endAt - adjustedAt) / 1000)) : 0;
    const nextRemaining = Math.max(0, currentRemaining + seconds);
    const nextEndAt = nextRemaining ? adjustedAt + nextRemaining * 1000 : adjustedAt;
    const nextDuration = Math.max(1, duration + nextRemaining - currentRemaining);
    if (nextRemaining) didNotifyCompletion.current = false;
    setNow(adjustedAt);
    setDuration(nextDuration);
    setEndAt(nextEndAt);
  }, [duration, endAt]);

  const stop = useCallback((): void => {
    didNotifyCompletion.current = false;
    setEndAt(null);
  }, []);

  const value = useMemo<RestTimerContextValue>(() => ({
    endAt,
    duration,
    remaining,
    running,
    start,
    adjust,
    stop,
  }), [adjust, duration, endAt, remaining, running, start, stop]);

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const context = useContext(RestTimerContext);
  if (!context) throw new Error('useRestTimer must be used inside RestTimerProvider.');
  return context;
}
