import { withSpring } from 'react-native-reanimated';
import { forgeMotion } from '../../theme/motion';

/** A release faster than this (pt/s) decides a reveal by its direction, not its distance. */
export const SWIPE_FLICK_VELOCITY = 500;

/**
 * Whether a horizontal reveal ends open. `offset` is the row's translateX at
 * release (0 closed, `-revealWidth` fully open); a quick flick wins over distance,
 * so a short fast swipe still opens and a fast swipe back still closes.
 */
export function swipeRevealShouldOpen(
  offset: number,
  velocityX: number,
  revealWidth: number,
  threshold = 0.5,
): boolean {
  'worklet';
  if (velocityX <= -SWIPE_FLICK_VELOCITY) return true;
  if (velocityX >= SWIPE_FLICK_VELOCITY) return false;
  return Math.max(-revealWidth, Math.min(0, offset)) < -revealWidth * threshold;
}

/**
 * The settle animation toward a reveal's open or closed rest, carrying the
 * finger's release speed into the shared no-overshoot swipe spring.
 */
export function swipeRevealSettle(target: number, velocityX: number, reducedMotion: boolean): number {
  'worklet';
  return reducedMotion ? target : withSpring(target, { ...forgeMotion.swipeSpring, velocity: velocityX });
}
