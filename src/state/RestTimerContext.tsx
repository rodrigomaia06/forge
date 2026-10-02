import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { successHaptic } from '../components/ui/haptics';
import { useSettings } from './SettingsContext';
import { useWorkouts } from './WorkoutContext';
import { syncRestTimerLiveActivity } from './restTimerLiveActivity';
import { adjustRestTimer } from '../domain/rest/restTimerAdjustment';
import { synchronizeNow } from '../domain/rest/synchronizedClock';

const restTimerNotificationId = 'forge-rest-timer-complete';
// Android notification-channel sound is immutable once installed. A versioned
// ID ensures existing installs receive the bundled Forge alarm after update.
const restTimerAudibleChannelId = 'forge-rest-timer-audible-v2';
const restTimerSilentChannelId = 'forge-rest-timer-silent';
const unfinishedWorkoutReminderId = 'forge-unfinished-workout-reminder';
const restTimerStorageKey = '@forge/rest-timer-v1';
// This is the exact bundled rest alarm from the prior Forge app. Unlike the
// platform default it retains Forge's recognisable timer sound in native builds.
const restTimerSound = 'alarm.wav';

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
  /** Mark real workout activity (e.g. a completed set) so the unfinished-workout
   * reminder is deferred even when the rest timer display is off. */
  noteActivity: () => void;
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
  // Also clear any already-delivered "Rest complete" alert. Without this a new
  // rest schedules a fresh notification while the previous one still sits in the
  // tray, so the lock screen appears not to update after the first rest sounded.
  await Notifications.dismissNotificationAsync(restTimerNotificationId).catch(() => undefined);
  if (!endAt || endAt <= Date.now() || !(await canScheduleNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: restTimerNotificationId,
    content: {
      title: 'Rest complete',
      body: `${restDurationLabel(duration)} complete. Back to work.`,
      sound: soundEnabled ? restTimerSound : false,
      data: { forgeTimer: 'rest' },
      // Time Sensitive lets the end-of-rest alert break through Focus/Do Not
      // Disturb (not the ringer switch). It only takes effect with the
      // com.apple.developer.usernotifications.time-sensitive entitlement, which
      // a paid Apple signing carries; without it iOS delivers this as an
      // ordinary alert, so it is safe on the free-team sideload build.
      interruptionLevel: 'timeSensitive',
      // Android permits a semantic notification accent. iOS owns notification
      // chrome and consistently presents the Forge app icon instead.
      color: Platform.OS === 'android' ? '#C85C5C' : undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(endAt),
      channelId: Platform.OS === 'android' ? (soundEnabled ? restTimerAudibleChannelId : restTimerSilentChannelId) : undefined,
    },
  });
  // The live during-rest countdown is owned by the native ForgeRestTimerLiveActivity
  // module on both platforms (ActivityKit on iOS, an ongoing chronometer
  // notification on Android) via syncRestTimerLiveActivity — not scheduled here.
}

async function replaceUnfinishedWorkoutReminder(
  startedAt: number | null,
  enabled: boolean,
  delaySeconds: number,
): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(unfinishedWorkoutReminderId).catch(() => undefined);
  if (!enabled || startedAt == null || !(await canScheduleNotifications())) return;
  const reminderAt = startedAt + delaySeconds * 1000;
  if (reminderAt <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: unfinishedWorkoutReminderId,
    content: { title: 'Workout still open', body: 'Your Forge workout is ready when you are.', sound: false, data: { forgeReminder: 'unfinished-workout' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminderAt),
      channelId: Platform.OS === 'android' ? restTimerSilentChannelId : undefined,
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
  // Only the workout's identity/start time matter here, so read those scalars
  // (stable across set-entry keystrokes) rather than the live workout object.
  const { activeWorkoutId, activeWorkoutStartedAt, activeWorkoutSetCount, ready: workoutsReady } = useWorkouts();
  const [endAt, setEndAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  // The most recent set completion (rest-timer start) within this workout, used
  // to defer the unfinished-workout reminder while the session is active.
  const [lastActivityAt, setLastActivityAt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const hydrationGeneration = useRef(0);
  const didNotifyCompletion = useRef(false);
  const notificationQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void Notifications.setNotificationChannelAsync(restTimerAudibleChannelId, {
      name: 'Rest timer alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: restTimerSound,
      vibrationPattern: [0, 180, 90, 180],
    }).catch(() => undefined);
    void Notifications.setNotificationChannelAsync(restTimerSilentChannelId, {
      name: 'Forge reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [],
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!workoutsReady) return;
    const generation = ++hydrationGeneration.current;
    if (!activeWorkoutId) {
      didNotifyCompletion.current = false;
      setEndAt(null); setDuration(0); setHydrated(true);
      void AsyncStorage.removeItem(restTimerStorageKey);
      return;
    }
    setHydrated(false);
    let mounted = true;
    void AsyncStorage.getItem(restTimerStorageKey).then((raw) => {
      if (!mounted || generation !== hydrationGeneration.current) return;
      try {
        const saved = JSON.parse(raw ?? 'null') as { workoutId?: unknown; endAt?: unknown; duration?: unknown } | null;
        // A rest timer belongs to one live workout. Old unscoped values are
        // intentionally discarded rather than attaching a stale countdown.
        if (saved?.workoutId === activeWorkoutId && typeof saved.endAt === 'number' && typeof saved.duration === 'number' && saved.duration > 0) {
          setEndAt(saved.endAt); setDuration(saved.duration);
        } else {
          setEndAt(null); setDuration(0);
        }
      } finally { if (mounted) setHydrated(true); }
    });
    return () => { mounted = false; };
  }, [activeWorkoutId, workoutsReady]);

  useEffect(() => {
    if (!hydrated) return;
    if (!endAt) { void AsyncStorage.removeItem(restTimerStorageKey); return; }
    void AsyncStorage.setItem(restTimerStorageKey, JSON.stringify({ workoutId: activeWorkoutId, endAt, duration }));
  }, [activeWorkoutId, duration, endAt, hydrated]);

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

  // General reminders are one durable local notification, not an in-app timer.
  // Its trigger only depends on the workout's identity/start time, so ordinary
  // set and value edits (which produce a new workout object every keystroke)
  // must not reschedule it. It is removed as soon as the workout is finished or
  // discarded (identity clears), and rescheduled when the start time is edited.
  useEffect(() => {
    if (!workoutsReady) return;
    // Count the delay from the last set completion when the user has been
    // active, so the reminder only fires after a genuine lull. A new workout's
    // start time is always newer than any prior activity, so the max never
    // leaks a stale timestamp across sessions.
    // An empty session (no sets logged yet) isn't worth a reminder — only nag
    // once the workout actually has something in it.
    const remindFrom = activeWorkoutStartedAt && activeWorkoutSetCount > 0
      ? Math.max(activeWorkoutStartedAt, lastActivityAt)
      : null;
    void replaceUnfinishedWorkoutReminder(
      remindFrom,
      preferences.unfinishedWorkoutReminderEnabled,
      preferences.unfinishedWorkoutReminderDelay,
    ).catch(() => undefined);
  }, [activeWorkoutId, activeWorkoutStartedAt, activeWorkoutSetCount, lastActivityAt, preferences.unfinishedWorkoutReminderDelay, preferences.unfinishedWorkoutReminderEnabled, workoutsReady]);

  // The app is in front of the user, so any delivered timer/reminder alert is
  // stale. Clear them on foreground and keep at most the one still-scheduled
  // rest alert. This is the only place delivered notifications are dismissed.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let restDismissTimer: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void Notifications.dismissNotificationAsync(unfinishedWorkoutReminderId).catch(() => undefined);
      // If the user unlocks at the exact moment rest completes, dismissing the
      // alert in the same instant can cut its sound short. Clear it a beat later
      // so the completion sound always finishes playing.
      if (restDismissTimer) clearTimeout(restDismissTimer);
      restDismissTimer = setTimeout(() => {
        void Notifications.dismissNotificationAsync(restTimerNotificationId).catch(() => undefined);
      }, 1200);
    });
    return () => {
      if (restDismissTimer) clearTimeout(restDismissTimer);
      subscription.remove();
    };
  }, []);

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
    const startedAt = synchronizeNow();
    const nextEndAt = startedAt + safeDuration * 1000;
    // A rest timer starts when a set is completed — real workout activity.
    // Push the unfinished-workout reminder out from here so it only fires after
    // an actual lull, not a fixed delay from when the workout began.
    setLastActivityAt(startedAt);
    didNotifyCompletion.current = false;
    // A direct user/completion transition always wins over an in-flight disk
    // read for this workout.
    hydrationGeneration.current += 1;
    setHydrated(true);
    setDuration(safeDuration);
    setEndAt(nextEndAt);
  }, []);

  const adjust = useCallback((seconds: number): void => {
    const adjustedAt = synchronizeNow();
    const next = adjustRestTimer({ duration, endAt, seconds, now: adjustedAt });
    if ((next.endAt ?? adjustedAt) > adjustedAt) didNotifyCompletion.current = false;
    setDuration(next.duration);
    setEndAt(next.endAt);
  }, [duration, endAt]);

  const stop = useCallback((): void => {
    didNotifyCompletion.current = false;
    setEndAt(null);
  }, []);

  // Advance the activity marker without touching the timer, so the
  // unfinished-workout reminder is pushed out on every completed set even when
  // the visible rest timer is disabled (start() otherwise owns this bump).
  const noteActivity = useCallback((): void => {
    setLastActivityAt(synchronizeNow());
  }, []);

  useEffect(() => {
    if (!preferences.showRestTimer && endAt) stop();
  }, [endAt, preferences.showRestTimer, stop]);

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
    noteActivity,
  }), [adjust, duration, endAt, noteActivity, remaining, running, start, stop]);

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const context = useContext(RestTimerContext);
  if (!context) throw new Error('useRestTimer must be used inside RestTimerProvider.');
  return context;
}
