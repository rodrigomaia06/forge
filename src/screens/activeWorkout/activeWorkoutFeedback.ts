import { forgeMotion } from '../../theme/motion';
import { animateNextLayout } from '../../theme/layoutMotion';

export {
  errorHaptic,
  lightHaptic,
  mediumHaptic,
  selectionHaptic,
  successHaptic,
} from '../../components/ui/haptics';

export function animateLayout(reducedMotion = false): void {
  animateNextLayout(reducedMotion, forgeMotion.feedback);
}

/** A sheet body can change substantially in height when it replaces its action list. */
export function animateSheetContent(reducedMotion = false): void {
  animateNextLayout(reducedMotion, forgeMotion.transition);
}

export function animateSetRemoval(reducedMotion = false): void {
  animateNextLayout(reducedMotion, forgeMotion.feedback);
}
