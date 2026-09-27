export interface WarmupSetPlan {
  weight: string;
  reps: string;
}

type WarmupStep = readonly [weightFraction: number, reps: number];

/**
 * Evidence-based specific warm-up ramp.
 *
 * Follows the progressive-loading protocol recommended in the resistance-
 * training warm-up literature: a small number of *specific* sets that climb
 * toward the working load (~40% up to ~90%) with the rep count falling as the
 * intensity rises. Kept deliberately low-rep so the sets potentiate the nervous
 * system and rehearse the movement without accumulating fatigue, and heavier
 * (lower-rep) working sets earn one extra near-maximal rehearsal set.
 *
 * Sources:
 * - Ribeiro et al. (2021), "Warming-Up for Resistance Training and Muscular
 *   Performance: A Narrative Review" — https://www.intechopen.com/chapters/75109
 * - Practical NSCA-style guidance: 3–4 progressive sets ramping to ~90% of the
 *   working load with descending reps.
 */
export function warmupSteps(workingReps: number): readonly WarmupStep[] {
  // Strength work (heavy, low reps): the longest ramp, finishing with a single
  // near-working rehearsal rep at ~90%.
  if (workingReps >= 1 && workingReps <= 5) return [[0.4, 5], [0.6, 3], [0.75, 2], [0.9, 1]];
  // Muscular-endurance work (light, very high reps): the shortest ramp — the
  // working load itself is submaximal, so little specific potentiation is needed.
  if (workingReps >= 12) return [[0.5, 5], [0.75, 2]];
  // Hypertrophy range (moderate load/reps): a middle ramp finishing near ~85%.
  return [[0.45, 5], [0.65, 3], [0.85, 2]];
}

/** Builds unique, lighter-than-working-set weights rounded to a 2.5 kg increment. */
export function buildWarmupPlan(workingWeight: number, workingReps: number): WarmupSetPlan[] {
  if (!Number.isFinite(workingWeight) || workingWeight <= 0) return [];
  const roundedWeights = new Set<number>();
  return warmupSteps(workingReps).flatMap(([fraction, reps]) => {
    const rounded = Math.max(20, Math.round((workingWeight * fraction) / 2.5) * 2.5);
    if (rounded >= workingWeight || roundedWeights.has(rounded)) return [];
    roundedWeights.add(rounded);
    return [{ weight: String(rounded), reps: String(reps) }];
  });
}
