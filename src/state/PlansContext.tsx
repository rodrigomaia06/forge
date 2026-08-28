import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadPlansState, savePlansState } from '../data/plansRepository';
import type { ChildrenProps, PlansContextValue, PlansState, WorkoutPlan, WorkoutRoutine } from '../types';
import { makeWorkoutId } from './workoutMutations';

const PlansContext = createContext<PlansContextValue | null>(null);
const emptyState: PlansState = { plans: [], standaloneRoutines: [] };

export function PlansProvider({ children }: ChildrenProps) {
  const [state, setState] = useState<PlansState>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPlansState().then(setState).catch(() => setState(emptyState)).finally(() => setReady(true));
  }, []);
  const commit = useCallback((update: (current: PlansState) => PlansState): void => {
    setState((current) => {
      const next = update(current);
      void savePlansState(next);
      return next;
    });
  }, []);
  const findRoutine = useCallback((routineId: string): WorkoutRoutine | undefined => {
    const standalone = state.standaloneRoutines.find((routine) => routine.id === routineId);
    return standalone ?? state.plans.flatMap((plan) => plan.routines).find((routine) => routine.id === routineId);
  }, [state]);
  const createPlan = useCallback((name = 'New plan'): WorkoutPlan => {
    const now = Date.now();
    const plan = { id: makeWorkoutId('plan'), name, routines: [], createdAt: now, updatedAt: now };
    commit((current) => ({ ...current, plans: [...current.plans, plan] }));
    return plan;
  }, [commit]);
  const updatePlan = useCallback((planId: string, update: (plan: WorkoutPlan) => WorkoutPlan): void => {
    commit((current) => ({ ...current, plans: current.plans.map((plan) => plan.id === planId ? { ...update(plan), updatedAt: Date.now() } : plan) }));
  }, [commit]);
  const deletePlan = useCallback((planId: string): void => {
    commit((current) => {
      const plan = current.plans.find((item) => item.id === planId);
      return { plans: current.plans.filter((item) => item.id !== planId), standaloneRoutines: [...current.standaloneRoutines, ...(plan?.routines.map((routine) => ({ ...routine, planId: undefined, updatedAt: Date.now() })) ?? [])] };
    });
  }, [commit]);
  const createRoutine = useCallback((options: Partial<WorkoutRoutine> = {}): WorkoutRoutine => {
    const now = Date.now();
    const routine: WorkoutRoutine = { id: makeWorkoutId('routine'), name: options.name || 'New routine', type: options.type || 'Strength', note: options.note, attributes: options.attributes, exercises: options.exercises || [], planId: options.planId, createdAt: now, updatedAt: now };
    commit((current) => options.planId ? { ...current, plans: current.plans.map((plan) => plan.id === options.planId ? { ...plan, updatedAt: now, routines: [...plan.routines, routine] } : plan) } : { ...current, standaloneRoutines: [...current.standaloneRoutines, routine] });
    return routine;
  }, [commit]);
  const updateRoutine = useCallback((routineId: string, update: (routine: WorkoutRoutine) => WorkoutRoutine): void => {
    commit((current) => ({
      standaloneRoutines: current.standaloneRoutines.map((routine) => routine.id === routineId ? { ...update(routine), updatedAt: Date.now() } : routine),
      plans: current.plans.map((plan) => ({ ...plan, routines: plan.routines.map((routine) => routine.id === routineId ? { ...update(routine), updatedAt: Date.now() } : routine) })),
    }));
  }, [commit]);
  const moveRoutine = useCallback((routineId: string, planId?: string): void => {
    commit((current) => {
      const routine = current.standaloneRoutines.find((item) => item.id === routineId) ?? current.plans.flatMap((plan) => plan.routines).find((item) => item.id === routineId);
      if (!routine || (planId && !current.plans.some((plan) => plan.id === planId))) return current;
      const detached = { ...routine, planId, updatedAt: Date.now() };
      const stripped = { standaloneRoutines: current.standaloneRoutines.filter((item) => item.id !== routineId), plans: current.plans.map((plan) => ({ ...plan, routines: plan.routines.filter((item) => item.id !== routineId) })) };
      return planId ? { ...stripped, plans: stripped.plans.map((plan) => plan.id === planId ? { ...plan, routines: [...plan.routines, detached], updatedAt: Date.now() } : plan) } : { ...stripped, standaloneRoutines: [...stripped.standaloneRoutines, detached] };
    });
  }, [commit]);
  const deleteRoutine = useCallback((routineId: string): void => {
    commit((current) => ({ standaloneRoutines: current.standaloneRoutines.filter((routine) => routine.id !== routineId), plans: current.plans.map((plan) => ({ ...plan, routines: plan.routines.filter((routine) => routine.id !== routineId) })) }));
  }, [commit]);
  const duplicateRoutine = useCallback((routineId: string): WorkoutRoutine | null => {
    const source = findRoutine(routineId); if (!source) return null;
    const copy = createRoutine({ ...source, id: undefined, name: `${source.name} copy`, planId: source.planId, exercises: source.exercises.map((exercise) => ({ ...exercise, id: undefined, sets: exercise.sets?.map((set) => ({ ...set, id: undefined })) })) });
    return copy;
  }, [createRoutine, findRoutine]);
  const value = useMemo(() => ({ ...state, ready, createPlan, updatePlan, deletePlan, createRoutine, updateRoutine, deleteRoutine, duplicateRoutine, moveRoutine, findRoutine }), [state, ready, createPlan, updatePlan, deletePlan, createRoutine, updateRoutine, deleteRoutine, duplicateRoutine, moveRoutine, findRoutine]);
  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

export function usePlans(): PlansContextValue {
  const context = useContext(PlansContext);
  if (!context) throw new Error('usePlans must be used inside PlansProvider');
  return context;
}
