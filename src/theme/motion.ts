import { Easing, useReducedMotion } from 'react-native-reanimated';

/**
 * Forge's shared motion vocabulary. Motion is reserved for causal feedback,
 * navigation hierarchy, and direct manipulation; it must not delay content.
 */
export const forgeMotion = {
  feedback: 120,
  state: 160,
  transition: 180,
  // Modal-sheet timings (per Material/HIG: ~300ms enter, slightly quicker exit,
  // both ease-out so they start moving at full speed rather than accelerating
  // from rest like a spring — which read as "slow at first").
  sheetEnter: 300,
  sheetExit: 220,
  easing: Easing.out(Easing.cubic),
  // A dismiss must start moving immediately, not ease in-and-out (Reanimated's
  // withTiming default, which starts slow and feels frozen). Ease-out drops the
  // sheet away fast from the first frame; the slow tail lands off-screen.
  sheetExitEasing: Easing.out(Easing.cubic),
  // The sheet entrance (and drag snap-back): a responsive, critically damped
  // spring — quick off the mark, then settling smoothly with no bounce. Feel is
  // judged on device; stiffness/damping are the knobs to nudge it.
  sheetSpring: {
    damping: 30,
    stiffness: 260,
    mass: 0.85,
    overshootClamping: true,
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
