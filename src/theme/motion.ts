import { Easing, useReducedMotion } from 'react-native-reanimated';

/**
 * Forge's shared motion vocabulary. Motion is reserved for causal feedback,
 * navigation hierarchy, and direct manipulation; it must not delay content.
 */
export const forgeMotion = {
  feedback: 120,
  state: 160,
  transition: 180,
  sheetExit: 200,
  easing: Easing.out(Easing.cubic),
  // A dismiss should accelerate away rather than ease in-and-out (Reanimated's
  // withTiming default), so the sheet leaves crisply instead of dragging at the
  // start; the entrance stays a spring so open and close read as one system.
  sheetExitEasing: Easing.in(Easing.cubic),
  // The sheet entrance (and drag snap-back). Softened from a very stiff spring
  // (stiffness 280) toward a smoother, premium open that eases into place with a
  // barely-perceptible settle (dampingRatio ~0.9) rather than an abrupt snap.
  // Feel is judged on device; stiffness/damping are the knobs to nudge it.
  sheetSpring: {
    damping: 26,
    stiffness: 210,
    mass: 1,
    overshootClamping: false,
  },
  swipeSpring: {
    damping: 22,
    stiffness: 280,
    mass: 0.65,
    overshootClamping: true,
  },
  dockSpring: {
    damping: 22,
    stiffness: 340,
    mass: 0.55,
    overshootClamping: true,
  },
} as const;

/** System Reduce Motion is Forge's only motion-preference control. */
export function useForgeReducedMotion(): boolean {
  return useReducedMotion();
}

/** Resolve a timed animation to an immediate state when motion is reduced. */
export function forgeMotionDuration(reducedMotion: boolean, duration: number): number {
  return reducedMotion ? 0 : duration;
}
