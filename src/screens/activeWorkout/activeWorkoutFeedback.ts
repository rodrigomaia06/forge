import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { forgeMotion } from '../../theme/motion';

export {
  errorHaptic,
  lightHaptic,
  mediumHaptic,
  selectionHaptic,
  successHaptic,
} from '../../components/ui/haptics';

export function animateLayout(reducedMotion = false): void {
  if (reducedMotion || Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      forgeMotion.feedback,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );
}

/** A sheet body can change substantially in height when it replaces its action list. */
export function animateSheetContent(reducedMotion = false): void {
  if (reducedMotion || Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext({
    duration: forgeMotion.transition,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

export function animateSetRemoval(reducedMotion = false): void {
  if (reducedMotion || Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext(
    LayoutAnimation.create(forgeMotion.feedback, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );
}
