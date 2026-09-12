import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlansState } from '../types';

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
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
