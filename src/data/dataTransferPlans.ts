import type { PlansState, WorkoutPlan, WorkoutRoutine } from '../types';
import { contentSignature } from './importMatch';
import { uniqueById } from './uniqueById';

export const normalizeName = (name: string): string => (name ?? '').trim().toLowerCase();

/**
 * Give an imported record a distinct name only when a *different* record with
 * the same name already exists, so two genuinely different items don't look
 * identical: "Chest" becomes "Chest 2", then "Chest 3", and so on — the OS
 * "Keep Both" convention, not a "- imported" tag (which read as clutter even
 * when no disambiguation was needed). Content-identical re-imports are skipped
 * upstream and never reach here. Adds the chosen name to `taken`.
 */
export function distinctName(base: string, taken: Set<string>): string {
  const name = base?.trim() ? base : 'Routine';
  if (!taken.has(normalizeName(name))) {
    taken.add(normalizeName(name));
    return name;
  }
  let counter = 2;
  let candidate = `${name} ${counter}`;
  while (taken.has(normalizeName(candidate))) {
    counter += 1;
    candidate = `${name} ${counter}`;
  }
  taken.add(normalizeName(candidate));
  return candidate;
}

/**
 * Additively merge a plan hierarchy without flattening it. Records already on
 * the device retain their fields and position; new routines are appended to
 * their existing plan, which keeps an import review and the written result in
 * agreement.
 */
export type ImportRename = { from: string; to: string };

export function mergeImportedPlans(
  current: PlansState,
  incoming: PlansState,
  /** Collects the routines that had to be renamed to avoid a name clash. */
  renamed?: ImportRename[],
  /** Collects the names of incoming records the device already had verbatim. */
  skipped?: string[],
): PlansState {
  const currentRoutines = [
    ...current.standaloneRoutines,
    ...current.plans.flatMap((plan) => plan.routines),
  ];
  // Rename only genuinely new incoming routines whose name collides with one
  // already on device (a matching id is an update, dropped by uniqueById below).
  const currentRoutineIds = new Set<string>(currentRoutines.map((routine) => routine.id));
  const takenNames = new Set<string>(currentRoutines.map((routine) => normalizeName(routine.name)));
  // Content-identical re-imports (same content, freshly-minted ids) are dropped
  // rather than added as "X 2" — the device already has them verbatim.
  const currentRoutineSignatures = new Set(currentRoutines.map((routine) => contentSignature(routine)));
  const currentPlanSignatures = new Set(current.plans.map((plan) => contentSignature(plan)));
  const renameNew = (routine: WorkoutRoutine): WorkoutRoutine => {
    if (currentRoutineIds.has(routine.id)) return routine;
    const nextName = distinctName(routine.name, takenNames);
    if (renamed && nextName !== routine.name) renamed.push({ from: routine.name, to: nextName });
    return { ...routine, name: nextName };
  };
  const processRoutines = (routines: readonly WorkoutRoutine[]): WorkoutRoutine[] => {
    const kept: WorkoutRoutine[] = [];
    for (const routine of routines) {
      if (!currentRoutineIds.has(routine.id) && currentRoutineSignatures.has(contentSignature(routine))) {
        skipped?.push(routine.name);
        continue;
      }
      kept.push(renameNew(routine));
    }
    return kept;
  };
  const currentPlanIds = new Set(current.plans.map((plan) => plan.id));
  incoming = {
    plans: incoming.plans
      .filter((plan) => {
        if (!currentPlanIds.has(plan.id) && currentPlanSignatures.has(contentSignature(plan))) {
          skipped?.push(plan.name);
          return false;
        }
        return true;
      })
      .map((plan) => ({ ...plan, routines: processRoutines(plan.routines) })),
    standaloneRoutines: processRoutines(incoming.standaloneRoutines),
  };
  const incomingByPlanId = new Map(incoming.plans.map((plan) => [plan.id, plan]));
  const mergeRoutines = (
    base: readonly WorkoutRoutine[],
    addition: readonly WorkoutRoutine[],
    planId: string,
  ): WorkoutRoutine[] => uniqueById([...base, ...addition]).map((routine) => ({ ...routine, planId }));
  const plans: WorkoutPlan[] = [
    ...current.plans.map((plan) => {
      const addition = incomingByPlanId.get(plan.id);
      return addition
        ? { ...plan, routines: mergeRoutines(plan.routines, addition.routines, plan.id) }
        : { ...plan, routines: mergeRoutines(plan.routines, [], plan.id) };
    }),
    ...incoming.plans
      .filter((plan) => !currentPlanIds.has(plan.id))
      .map((plan) => ({ ...plan, routines: mergeRoutines([], plan.routines, plan.id) })),
  ];
  const planRoutineIds = new Set(plans.flatMap((plan) => plan.routines.map((routine) => routine.id)));
  return {
    plans,
    standaloneRoutines: uniqueById([
      ...current.standaloneRoutines,
      ...incoming.standaloneRoutines,
    ]).filter((routine) => !planRoutineIds.has(routine.id)),
  };
}
