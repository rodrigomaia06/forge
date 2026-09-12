export interface WarmupSetPlan {
  weight: string;
  reps: string;
}

type WarmupStep = readonly [weightFraction: number, reps: number];

/**
 * A deliberately small, editable strength warm-up ramp. It follows the legacy
 * Forge behaviour: heavier, lower-rep work receives more progressively closer
 * rehearsal sets; high-rep work receives a shorter ramp.
 */
export function warmupSteps(workingReps: number): readonly WarmupStep[] {
  if (workingReps >= 12) return [[0.5, 8], [0.7, 5]];
  if (workingReps >= 1 && workingReps <= 5) return [[0.4, 5], [0.55, 3], [0.7, 2], [0.85, 1]];
  return [[0.4, 8], [0.6, 5], [0.8, 3]];
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
