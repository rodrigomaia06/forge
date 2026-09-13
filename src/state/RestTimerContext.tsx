import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { successHaptic } from '../components/ui/haptics';
import { useSettings } from './SettingsContext';
import { useWorkouts } from './WorkoutContext';
import { syncRestTimerLiveActivity } from './restTimerLiveActivity';

const restTimerNotificationId = 'forge-rest-timer-complete';
const restTimerChannelId = 'forge-rest-timer';
const restTimerStorageKey = '@forge/rest-timer-v1';

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
  const { activeWorkout, ready: workoutsReady } = useWorkouts();
  const [endAt, setEndAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [hydrated, setHydrated] = useState(false);
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
    if (!workoutsReady) return;
    if (!activeWorkout) {
      didNotifyCompletion.current = false;
      setEndAt(null); setDuration(0); setHydrated(true);
      void AsyncStorage.removeItem(restTimerStorageKey);
      return;
    }
    let mounted = true;
    void AsyncStorage.getItem(restTimerStorageKey).then((raw) => {
      if (!mounted) return;
      try {
        const saved = JSON.parse(raw ?? 'null') as { endAt?: unknown; duration?: unknown } | null;
        if (typeof saved?.endAt === 'number' && typeof saved.duration === 'number' && saved.duration > 0) {
          setEndAt(saved.endAt); setDuration(saved.duration);
        }
      } finally { if (mounted) setHydrated(true); }
    });
    return () => { mounted = false; };
  }, [activeWorkout, workoutsReady]);

  useEffect(() => {
    if (!hydrated) return;
    if (!endAt) { void AsyncStorage.removeItem(restTimerStorageKey); return; }
    void AsyncStorage.setItem(restTimerStorageKey, JSON.stringify({ endAt, duration }));
  }, [duration, endAt, hydrated]);

  useEffect(() => {
    if (!endAt) return undefined;
    const timeout = setTimeout(() => {
      if (didNotifyCompletion.current) return;
      didNotifyCompletion.current = true;
      if (preferences.restTimerHaptic) successHaptic();
      if (!preferences.keepRestTimerRunning) setEndAt(null);
    }, Math.max(0, endAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [endAt, preferences.keepRestTimerRunning, preferences.restTimerHaptic]);

  // Keep the system-owned end alert synchronized with every timer or
  // preference change. This also immediately removes it when the user hides
  // the rest timer, as the prior iPhone implementation did.
  useEffect(() => {
    // At expiry leave the already-due notification alone: cancelling it in
    // the same tick can race iOS/Android's sound and lock-screen delivery.
    if (!hydrated || (endAt && endAt <= Date.now() && didNotifyCompletion.current) || (!endAt && didNotifyCompletion.current)) return;
    notificationQueue.current = notificationQueue.current
      .then(() => replaceRestTimerNotification(
        preferences.showRestTimer ? endAt : null,
        duration,
        preferences.restTimerSound,
      ))
      .catch(() => undefined);
  }, [duration, endAt, hydrated, preferences.restTimerSound, preferences.showRestTimer]);

  // ActivityKit is a secondary presentation of the same timestamp state. It
  // deliberately receives updates only for semantic timer changes, never from
  // the once-per-second React display components.
  useEffect(() => {
    if (!hydrated) return;
    void syncRestTimerLiveActivity({
      endAt: preferences.showRestTimer ? endAt : null,
      duration,
    }).catch(() => undefined);
  }, [duration, endAt, hydrated, preferences.showRestTimer]);

  const start = useCallback((nextDuration: number): void => {
    const safeDuration = Math.max(1, Math.round(nextDuration));
    const startedAt = Date.now();
    const nextEndAt = startedAt + safeDuration * 1000;
    didNotifyCompletion.current = false;
    setDuration(safeDuration);
    setEndAt(nextEndAt);
  }, []);

  const adjust = useCallback((seconds: number): void => {
    const adjustedAt = Date.now();
    const currentRemaining = endAt ? Math.max(0, Math.ceil((endAt - adjustedAt) / 1000)) : 0;
    const nextRemaining = Math.max(0, currentRemaining + seconds);
    const nextEndAt = nextRemaining ? adjustedAt + nextRemaining * 1000 : adjustedAt;
    const nextDuration = Math.max(1, duration + nextRemaining - currentRemaining);
    if (nextRemaining) didNotifyCompletion.current = false;
    setDuration(nextDuration);
    setEndAt(nextEndAt);
  }, [duration, endAt]);

  const stop = useCallback((): void => {
    didNotifyCompletion.current = false;
    setEndAt(null);
  }, []);

  const rawRemaining = endAt ? Math.ceil((endAt - Date.now()) / 1000) : 0;
  const remaining = endAt ? (preferences.keepRestTimerRunning ? rawRemaining : Math.max(0, rawRemaining)) : 0;
  const running = Boolean(endAt && (rawRemaining > 0 || preferences.keepRestTimerRunning));
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
