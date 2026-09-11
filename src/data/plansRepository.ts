import type { PlansState, WorkoutPlan } from '../types';
import { database } from './database';
const EMPTY: PlansState = { plans: [], standaloneRoutines: [] };

export async function loadPlansState(): Promise<PlansState> {
  const db = await database();
  const [planRows, routineRows] = await Promise.all([db.getAllAsync<{ value_json: string }>('SELECT value_json FROM plans ORDER BY position'), db.getAllAsync<{ value_json: string; plan_id: string | null }>('SELECT value_json, plan_id FROM routines ORDER BY position')]);
  if (!planRows.length && !routineRows.length) return EMPTY;
  const plans: WorkoutPlan[] = planRows.map((row) => ({ ...(JSON.parse(row.value_json) as Omit<WorkoutPlan, 'routines'>), routines: [] }));
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  const standaloneRoutines: PlansState['standaloneRoutines'] = [];
  routineRows.forEach((row) => { const routine = JSON.parse(row.value_json) as PlansState['standaloneRoutines'][number]; const plan = row.plan_id ? byId.get(row.plan_id) : undefined; if (plan) plan.routines.push(routine); else standaloneRoutines.push(routine); });
  return { plans, standaloneRoutines };
}

export async function savePlansState(state: PlansState): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM routines'); await db.runAsync('DELETE FROM plans');
    for (const [position, plan] of state.plans.entries()) await db.runAsync('INSERT INTO plans (id, position, value_json) VALUES (?, ?, ?)', plan.id, position, JSON.stringify({ ...plan, routines: undefined }));
    for (const [position, routine] of [...state.standaloneRoutines, ...state.plans.flatMap((plan) => plan.routines)].entries()) await db.runAsync('INSERT INTO routines (id, plan_id, position, value_json) VALUES (?, ?, ?, ?)', routine.id, routine.planId ?? null, position, JSON.stringify(routine));
  });
}
