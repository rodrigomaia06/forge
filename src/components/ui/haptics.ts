import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function trigger(
  iosEffect: () => Promise<void>,
  androidEffect: Haptics.AndroidHaptics,
): void {
  if (Platform.OS === 'web') return;
  const effect = Platform.OS === 'android'
    ? Haptics.performAndroidHapticsAsync(androidEffect)
    : iosEffect();
  effect.catch((error: unknown) => {
    if (__DEV__) console.warn('Forge haptic feedback was unavailable.', error);
  });
}

export function lightHaptic(): void {
  trigger(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    Haptics.AndroidHaptics.Context_Click,
  );
}

export function selectionHaptic(): void {
  trigger(() => Haptics.selectionAsync(), Haptics.AndroidHaptics.Segment_Tick);
}

export function mediumHaptic(): void {
  trigger(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    Haptics.AndroidHaptics.Confirm,
  );
}

export function errorHaptic(): void {
  trigger(
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    Haptics.AndroidHaptics.Reject,
  );
}

export function successHaptic(): void {
  trigger(
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    Haptics.AndroidHaptics.Confirm,
  );
}
