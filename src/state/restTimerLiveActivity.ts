import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { LiveActivityFactory } from 'expo-widgets';
import type { RestTimerLiveActivityProps } from '../widgets/RestTimerLiveActivity';

type RestTimerActivityFactory = LiveActivityFactory<RestTimerLiveActivityProps>;

/**
 * Expo Go deliberately has no Widgets extension. Keep the import deferred so
 * its missing native module never prevents the ordinary rest timer from
 * starting; a development/production build loads the generated target here.
 */
function getRestTimerActivityFactory(): RestTimerActivityFactory | null {
  if (Platform.OS !== 'ios' || !requireOptionalNativeModule('ExpoWidgets')) return null;
  const module = require('../widgets/RestTimerLiveActivity') as {
    ForgeRestTimerLiveActivity: RestTimerActivityFactory;
  };
  return module.ForgeRestTimerLiveActivity;
}

/**
 * Keeps the single local ActivityKit surface synchronized with the timestamp
 * owner. Expo Widgets creates the Swift extension target during prebuild; its
 * `Text(timerInterval:)` continues counting when the JS runtime is suspended.
 */
export async function syncRestTimerLiveActivity({
  endAt,
  duration,
}: {
  endAt: number | null;
  duration: number;
}): Promise<void> {
  const activityFactory = getRestTimerActivityFactory();
  if (!activityFactory) return;

  const existing = activityFactory.getInstances();
  if (!endAt || duration <= 0) {
    await Promise.all(existing.map((activity) => activity.end('immediate')));
    return;
  }

  const props: RestTimerLiveActivityProps = {
    startedAt: endAt - duration * 1000,
    endAt,
    overdue: endAt <= Date.now(),
  };
  const staleDate = new Date(endAt);
  const [active, ...duplicates] = existing;
  await Promise.all(duplicates.map((activity) => activity.end('immediate')));
  if (active) {
    await active.update(props, staleDate);
    return;
  }
  activityFactory.start(props, 'forge://rest-timer/open', staleDate);
}
