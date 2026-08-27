import { LayoutAnimation, Platform, UIManager } from 'react-native';
import * as Haptics from 'expo-haptics';

export function lightHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function selectionHaptic(): void {
  Haptics.selectionAsync().catch(() => {});
}

export function mediumHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function errorHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function successHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function animateLayout(): void {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      140,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );
}

export function animateSetRemoval(): void {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext(
    LayoutAnimation.create(70, LayoutAnimation.Types.linear, LayoutAnimation.Properties.opacity),
  );
}
