import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlansState } from '../types';
import { uniqueById } from './uniqueById';

const KEY = '@forge/plans-v1';
const EMPTY: PlansState = { plans: [], standaloneRoutines: [] };
export async function loadPlansState(): Promise<PlansState> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    const parsed = value ? JSON.parse(value) as PlansState : EMPTY;
    return Array.isArray(parsed.plans) && Array.isArray(parsed.standaloneRoutines) ? parsed : EMPTY;
  } catch { return EMPTY; }
}
export async function savePlansState(state: PlansState): Promise<void> {
  const plans = uniqueById(state.plans).map((plan) => ({ ...plan, routines: uniqueById(plan.routines) }));
  const planRoutineIds = new Set(plans.flatMap((plan) => plan.routines.map((routine) => routine.id)));
  await AsyncStorage.setItem(KEY, JSON.stringify({
    plans,
    standaloneRoutines: uniqueById(state.standaloneRoutines).filter((routine) => !planRoutineIds.has(routine.id)),
  }));
}
