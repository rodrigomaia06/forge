import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlansState } from '../types';

const PLANS_KEY = '@forge/plans-v1';
const EMPTY: PlansState = { plans: [], standaloneRoutines: [] };

export async function loadPlansState(): Promise<PlansState> {
  const value = await AsyncStorage.getItem(PLANS_KEY);
  if (!value) return EMPTY;
  const parsed = JSON.parse(value) as Partial<PlansState>;
  return {
    plans: Array.isArray(parsed.plans) ? parsed.plans : [],
    standaloneRoutines: Array.isArray(parsed.standaloneRoutines) ? parsed.standaloneRoutines : [],
  };
}

export function savePlansState(state: PlansState): Promise<void> {
  return AsyncStorage.setItem(PLANS_KEY, JSON.stringify(state));
}
