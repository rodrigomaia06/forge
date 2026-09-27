import { loadCustomExercises } from './exerciseRepository';
import { loadPlansState } from './plansRepository';
import { loadSettingsPreferences } from './settingsRepository';
import { loadWorkoutState } from './workoutRepository';
import { shareTransfer } from './backupRepository';
import { scopedTransferFrom, type ShareScope } from './scopedTransferCore';
import type { ForgeDataTransfer } from './transferFormat';

export { scopedTransferFrom } from './scopedTransferCore';
export type { ShareScope, ScopedTransferState } from './scopedTransferCore';

/** Loads the current state, then derives the scoped transfer purely. */
export async function buildScopedTransfer(scope: ShareScope): Promise<ForgeDataTransfer> {
  const [settings, plans, workouts, customExercises] = await Promise.all([
    loadSettingsPreferences(),
    loadPlansState(),
    loadWorkoutState(),
    loadCustomExercises(),
  ]);
  return scopedTransferFrom({ settings, plans, workouts, customExercises }, scope);
}

/** Builds a single-item transfer and hands it to the OS share sheet as a .forge file. */
export async function shareScopedItem(scope: ShareScope): Promise<void> {
  await shareTransfer(await buildScopedTransfer(scope));
}
