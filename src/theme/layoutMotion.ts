import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { forgeMotion } from './motion';

/**
 * Animate the next native layout change (rows appearing, cards expanding, lists
 * reflowing) with Forge's ease-out: user-triggered changes start moving at full
 * speed instead of easing in, then settle. Appearing and disappearing content
 * cross-fades; everything else glides to its new frame. Skipped on web and under
 * Reduce Motion, where the layout simply takes its final state.
 */
export function animateNextLayout(reducedMotion: boolean, duration: number = forgeMotion.transition): void {
  if (reducedMotion || Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext({
    duration,
    create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeOut },
    delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
  });
}
