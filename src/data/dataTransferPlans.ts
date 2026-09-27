import type { PlansState, WorkoutPlan, WorkoutRoutine } from '../types';
import { uniqueById } from './uniqueById';

const normalizeName = (name: string): string => (name ?? '').trim().toLowerCase();

/**
 * Give an imported routine a distinct name when one with the same name already
 * exists, so the two don't look identical after an import: "Chest" becomes
 * "Chest - imported", then "Chest - imported 2", and so on.
 */
function distinctName(base: string, taken: Set<string>): string {
  const name = base?.trim() ? base : 'Routine';
  if (!taken.has(normalizeName(name))) {
    taken.add(normalizeName(name));
    return name;
  }
  let candidate = `${name} - imported`;
  let counter = 2;
  while (taken.has(normalizeName(candidate))) {
    candidate = `${name} - imported ${counter}`;
    counter += 1;
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
): PlansState {
  // Rename only genuinely new incoming routines whose name collides with one
  // already on device (a matching id is an update, dropped by uniqueById below).
  const currentRoutineIds = new Set<string>([
    ...current.standaloneRoutines.map((routine) => routine.id),
    ...current.plans.flatMap((plan) => plan.routines.map((routine) => routine.id)),
  ]);
  const takenNames = new Set<string>([
    ...current.standaloneRoutines.map((routine) => normalizeName(routine.name)),
    ...current.plans.flatMap((plan) => plan.routines.map((routine) => normalizeName(routine.name))),
  ]);
  const renameNew = (routine: WorkoutRoutine): WorkoutRoutine => {
    if (currentRoutineIds.has(routine.id)) return routine;
    const nextName = distinctName(routine.name, takenNames);
    if (renamed && nextName !== routine.name) renamed.push({ from: routine.name, to: nextName });
    return { ...routine, name: nextName };
  };
  incoming = {
    plans: incoming.plans.map((plan) => ({ ...plan, routines: plan.routines.map(renameNew) })),
    standaloneRoutines: incoming.standaloneRoutines.map(renameNew),
  };
  const incomingByPlanId = new Map(incoming.plans.map((plan) => [plan.id, plan]));
  const currentPlanIds = new Set(current.plans.map((plan) => plan.id));
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
