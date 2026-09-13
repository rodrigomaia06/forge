import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type ForgeRestTimerLiveActivityModule = {
  syncAsync(startAt: number, endAt: number): Promise<void>;
  stopAsync(): Promise<void>;
};

/**
 * Expo Go deliberately has no local Forge module. The optional lookup keeps
 * the normal timer and notification fallback fully usable there.
 */
function getRestTimerLiveActivityModule(): ForgeRestTimerLiveActivityModule | null {
  if (Platform.OS !== 'ios') return null;
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
