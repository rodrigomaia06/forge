import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type ForgeRestTimerLiveActivityModule = {
  syncAsync(startAt: number, endAt: number): Promise<void>;
  stopAsync(): Promise<void>;
};

/**
 * The same native contract backs both platforms: ActivityKit on iOS and an
 * ongoing chronometer-countdown notification on Android. Expo Go has no local
 * Forge module, so the optional lookup returns null there and the ordinary timer
 * (and the completion alert) remain fully usable.
 */
function getRestTimerLiveActivityModule(): ForgeRestTimerLiveActivityModule | null {
  if (Platform.OS === 'web') return null;
  return requireOptionalNativeModule<ForgeRestTimerLiveActivityModule>('ForgeRestTimerLiveActivity');
}

/**
 * Keeps Forge's direct ActivityKit surface synchronized with timestamp state.
 * Its SwiftUI date interval continues counting while JavaScript is suspended.
 */
export async function syncRestTimerLiveActivity({
  endAt,
  duration,
}: {
  endAt: number | null;
  duration: number;
}): Promise<void> {
  const module = getRestTimerLiveActivityModule();
  if (!module) return;
  if (!endAt || duration <= 0) {
    await module.stopAsync();
    return;
  }
  await module.syncAsync(endAt - duration * 1000, endAt);
}
