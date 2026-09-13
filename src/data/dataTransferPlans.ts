import type { PlansState, WorkoutPlan, WorkoutRoutine } from '../types';
import { uniqueById } from './uniqueById';

/**
 * Additively merge a plan hierarchy without flattening it. Records already on
 * the device retain their fields and position; new routines are appended to
 * their existing plan, which keeps an import review and the written result in
 * agreement.
 */
export function mergeImportedPlans(
  current: PlansState,
  incoming: PlansState,
): PlansState {
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
