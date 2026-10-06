import { queueWebWrite } from './webWriteQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlansState } from '../types';
import { uniqueById } from './uniqueById';
import { canonicalizeRoutine } from './exerciseCanonicalization';

const KEY = '@forge/plans-v1';
const EMPTY: PlansState = { plans: [], standaloneRoutines: [] };
export async function loadPlansState(): Promise<PlansState> {
  return queueWebWrite(async () => {
    try {
      const value = await AsyncStorage.getItem(KEY);
      const parsed = value ? (JSON.parse(value) as PlansState) : EMPTY;
      if (!Array.isArray(parsed.plans) || !Array.isArray(parsed.standaloneRoutines)) return EMPTY;
      const canonical = {
        plans: parsed.plans.map((plan) => ({
          ...plan,
          routines: Array.isArray(plan.routines) ? plan.routines.map(canonicalizeRoutine) : [],
        })),
        standaloneRoutines: parsed.standaloneRoutines.map(canonicalizeRoutine),
      };
      if (JSON.stringify(canonical) !== value)
        await AsyncStorage.setItem(KEY, JSON.stringify(canonical));
      return canonical;
    } catch {
      return EMPTY;
    }
  });
}
export async function savePlansState(state: PlansState): Promise<void> {
  const plans = uniqueById(state.plans).map((plan) => ({
    ...plan,
    routines: uniqueById(plan.routines).map(canonicalizeRoutine),
  }));
  const planRoutineIds = new Set(
    plans.flatMap((plan) => plan.routines.map((routine) => routine.id)),
  );
  await queueWebWrite(() =>
    AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        plans,
        standaloneRoutines: uniqueById(state.standaloneRoutines)
          .map(canonicalizeRoutine)
          .filter((routine) => !planRoutineIds.has(routine.id)),
      }),
    ),
  );
}
