import { LayoutAnimation, Platform, UIManager } from 'react-native';

export {
  errorHaptic,
  lightHaptic,
  mediumHaptic,
  selectionHaptic,
  successHaptic,
} from '../../components/ui/haptics';

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
