import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadPlansState, savePlansState } from '../data/plansRepository';
import type {
  ChildrenProps,
  PlansContextValue,
  PlansState,
  WorkoutPlan,
  WorkoutRoutine,
} from '../types';
import { makeWorkoutId } from './workoutMutations';

const PlansContext = createContext<PlansContextValue | null>(null);
const emptyState: PlansState = { plans: [], standaloneRoutines: [] };

export function PlansProvider({ children }: ChildrenProps) {
  const [state, setState] = useState<PlansState>(emptyState);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    setState(await loadPlansState());
    setReady(true);
  }, []);
  useEffect(() => {
    loadPlansState()
      .then(setState)
      .catch(() => setState(emptyState))
      .finally(() => setReady(true));
  }, []);
  const commit = useCallback((update: (current: PlansState) => PlansState): void => {
    setState((current) => {
      const next = update(current);
      void savePlansState(next);
      return next;
    });
  }, []);
  const findRoutine = useCallback(
    (routineId: string): WorkoutRoutine | undefined => {
      const standalone = state.standaloneRoutines.find((routine) => routine.id === routineId);
      return (
        standalone ??
        state.plans.flatMap((plan) => plan.routines).find((routine) => routine.id === routineId)
      );
    },
    [state],
  );
  const createPlan = useCallback(
    (name = 'New plan'): WorkoutPlan => {
      const now = Date.now();
      const plan = {
        id: makeWorkoutId('plan'),
        name,
        routines: [],
        createdAt: now,
        updatedAt: now,
      };
      commit((current) => ({ ...current, plans: [...current.plans, plan] }));
      return plan;
    },
    [commit],
  );
  const updatePlan = useCallback(
    (planId: string, update: (plan: WorkoutPlan) => WorkoutPlan): void => {
      commit((current) => ({
        ...current,
        plans: current.plans.map((plan) =>
          plan.id === planId ? { ...update(plan), updatedAt: Date.now() } : plan,
        ),
      }));
    },
    [commit],
  );
  const reorderPlans = useCallback(
    (plans: WorkoutPlan[]): void => {
      commit((current) => {
        if (
          plans.length !== current.plans.length ||
          plans.some((plan) => !current.plans.some((currentPlan) => currentPlan.id === plan.id))
        ) {
          return current;
        }
        const currentById = new Map(current.plans.map((plan) => [plan.id, plan]));
        return {
          ...current,
          plans: plans.map((plan) => currentById.get(plan.id) ?? plan),
        };
      });
    },
    [commit],
  );
  const deletePlan = useCallback(
    (planId: string): void => {
      commit((current) => {
        const plan = current.plans.find((item) => item.id === planId);
        return {
          plans: current.plans.filter((item) => item.id !== planId),
          standaloneRoutines: [
            ...current.standaloneRoutines,
            ...(plan?.routines.map((routine) => ({
              ...routine,
              planId: undefined,
              updatedAt: Date.now(),
            })) ?? []),
          ],
        };
      });
    },
    [commit],
  );
  const createRoutine = useCallback(
    (options: Partial<WorkoutRoutine> = {}): WorkoutRoutine => {
      const now = Date.now();
      const routine: WorkoutRoutine = {
        id: makeWorkoutId('routine'),
        name: options.name || 'New routine',
        type: options.type || 'Strength',
        note: options.note,
        attributes: options.attributes,
        attributeIcons: options.attributeIcons,
        exercises: options.exercises || [],
        planId: options.planId,
        createdAt: now,
        updatedAt: now,
      };
      commit((current) =>
        options.planId
          ? {
              ...current,
              plans: current.plans.map((plan) =>
                plan.id === options.planId
                  ? { ...plan, updatedAt: now, routines: [...plan.routines, routine] }
                  : plan,
              ),
            }
          : { ...current, standaloneRoutines: [...current.standaloneRoutines, routine] },
      );
      return routine;
    },
    [commit],
  );
  const updateRoutine = useCallback(
    (routineId: string, update: (routine: WorkoutRoutine) => WorkoutRoutine): void => {
      commit((current) => ({
        standaloneRoutines: current.standaloneRoutines.map((routine) =>
          routine.id === routineId ? { ...update(routine), updatedAt: Date.now() } : routine,
        ),
        plans: current.plans.map((plan) => ({
          ...plan,
          routines: plan.routines.map((routine) =>
            routine.id === routineId ? { ...update(routine), updatedAt: Date.now() } : routine,
          ),
        })),
      }));
    },
    [commit],
  );
  const reorderRoutines = useCallback(
    (routines: WorkoutRoutine[], planId?: string): void => {
      commit((current) => {
        const currentRoutines = planId
          ? current.plans.find((plan) => plan.id === planId)?.routines
          : current.standaloneRoutines;
        if (
          !currentRoutines ||
          routines.length !== currentRoutines.length ||
          routines.some(
            (routine) =>
              !currentRoutines.some((currentRoutine) => currentRoutine.id === routine.id),
          )
        ) {
          return current;
        }
        const currentById = new Map(currentRoutines.map((routine) => [routine.id, routine]));
        const ordered = routines.map((routine) => currentById.get(routine.id) ?? routine);
        return planId
          ? {
              ...current,
              plans: current.plans.map((plan) =>
                plan.id === planId ? { ...plan, routines: ordered, updatedAt: Date.now() } : plan,
              ),
            }
          : { ...current, standaloneRoutines: ordered };
      });
    },
    [commit],
  );
  const reorderAll = useCallback(
    (
      plans: { id: string; routineIds: string[] }[],
      standaloneRoutineIds: string[],
    ): void => {
      commit((current) => {
        const routineById = new Map<string, WorkoutRoutine>();
        current.standaloneRoutines.forEach((routine) => routineById.set(routine.id, routine));
        current.plans.forEach((plan) => plan.routines.forEach((routine) => routineById.set(routine.id, routine)));
        const planById = new Map(current.plans.map((plan) => [plan.id, plan]));

        // Validate the incoming shape matches the current id set exactly.
        if (plans.length !== current.plans.length || plans.some((plan) => !planById.has(plan.id))) {
          return current;
        }
        const incomingRoutineIds = [...standaloneRoutineIds, ...plans.flatMap((plan) => plan.routineIds)];
        if (incomingRoutineIds.length !== routineById.size) return current;
        const seen = new Set<string>();
        for (const id of incomingRoutineIds) {
          if (!routineById.has(id) || seen.has(id)) return current;
          seen.add(id);
        }

        const now = Date.now();
        const withPlan = (id: string, planId: string | undefined): WorkoutRoutine => {
          const routine = routineById.get(id) as WorkoutRoutine;
          return routine.planId === planId ? routine : { ...routine, planId, updatedAt: now };
        };
        const standaloneRoutines = standaloneRoutineIds.map((id) => withPlan(id, undefined));
        const nextPlans = plans.map((entry) => {
          const plan = planById.get(entry.id) as WorkoutPlan;
          const routines = entry.routineIds.map((id) => withPlan(id, entry.id));
          const unchanged =
            routines.length === plan.routines.length &&
            routines.every((routine, index) => plan.routines[index]?.id === routine.id);
          return unchanged ? plan : { ...plan, routines, updatedAt: now };
        });
        return { plans: nextPlans, standaloneRoutines };
      });
    },
    [commit],
  );
  const moveRoutine = useCallback(
    (routineId: string, planId?: string, targetIndex?: number): void => {
      commit((current) => {
        const routine =
          current.standaloneRoutines.find((item) => item.id === routineId) ??
          current.plans.flatMap((plan) => plan.routines).find((item) => item.id === routineId);
        if (!routine || (planId && !current.plans.some((plan) => plan.id === planId)))
          return current;
        const detached = { ...routine, planId, updatedAt: Date.now() };
        const stripped = {
          standaloneRoutines: current.standaloneRoutines.filter((item) => item.id !== routineId),
          plans: current.plans.map((plan) => ({
            ...plan,
            routines: plan.routines.filter((item) => item.id !== routineId),
          })),
        };
        if (planId) {
          return {
            ...stripped,
            plans: stripped.plans.map((plan) => {
              if (plan.id !== planId) return plan;
              const insertionIndex = Math.max(
                0,
                Math.min(targetIndex ?? plan.routines.length, plan.routines.length),
              );
              const routines = [...plan.routines];
              routines.splice(insertionIndex, 0, detached);
              return { ...plan, routines, updatedAt: Date.now() };
            }),
          };
        }
        const insertionIndex = Math.max(
          0,
          Math.min(
            targetIndex ?? stripped.standaloneRoutines.length,
            stripped.standaloneRoutines.length,
          ),
        );
        const standaloneRoutines = [...stripped.standaloneRoutines];
        standaloneRoutines.splice(insertionIndex, 0, detached);
        return { ...stripped, standaloneRoutines };
      });
    },
    [commit],
  );
  const deleteRoutine = useCallback(
    (routineId: string): void => {
      commit((current) => ({
        standaloneRoutines: current.standaloneRoutines.filter(
          (routine) => routine.id !== routineId,
        ),
        plans: current.plans.map((plan) => ({
          ...plan,
          routines: plan.routines.filter((routine) => routine.id !== routineId),
        })),
      }));
    },
    [commit],
  );
  const duplicateRoutine = useCallback(
    (routineId: string): WorkoutRoutine | null => {
      const source = findRoutine(routineId);
      if (!source) return null;
      const copy = createRoutine({
        ...source,
        id: undefined,
        name: `${source.name} - copy`,
        planId: source.planId,
        exercises: source.exercises.map((exercise) => ({
          ...exercise,
          id: undefined,
          sets: exercise.sets?.map((set) => ({ ...set, id: undefined })),
        })),
      });
      return copy;
    },
    [createRoutine, findRoutine],
  );
  const value = useMemo(
    () => ({
      ...state,
      ready,
      reload,
      createPlan,
      updatePlan,
      reorderPlans,
      reorderAll,
      deletePlan,
      createRoutine,
      updateRoutine,
      reorderRoutines,
      deleteRoutine,
      duplicateRoutine,
      moveRoutine,
      findRoutine,
    }),
    [
      state,
      ready,
      createPlan,
      updatePlan,
      reorderPlans,
      reorderAll,
      deletePlan,
      createRoutine,
      updateRoutine,
      reorderRoutines,
      deleteRoutine,
      duplicateRoutine,
      moveRoutine,
      findRoutine,
    ],
  );
  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

export function usePlans(): PlansContextValue {
  const context = useContext(PlansContext);
  if (!context) throw new Error('usePlans must be used inside PlansProvider');
  return context;
}
