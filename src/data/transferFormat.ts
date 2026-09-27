import type { ExerciseCatalogItem } from './exerciseCatalog';
import type { PlansState, SettingsPreferences, WorkoutState } from '../types';

/**
 * The portable Forge transfer format and its selection/share vocabulary. Kept
 * free of any native/storage imports so pure logic (and its unit tests) can use
 * it without pulling in the SQLite layer. `backupRepository` re-exports these.
 */
export const FORGE_TRANSFER_VERSION = 1;

export type DataTransferCategory =
  'workouts' | 'plans' | 'exercises' | 'workoutTypes' | 'measurements';
export type DataTransferSelection = Record<DataTransferCategory, boolean>;

export const allDataTransferSelection = (): DataTransferSelection => ({
  workouts: true,
  plans: true,
  exercises: true,
  workoutTypes: true,
  measurements: true,
});

/** The single item a scoped share is centred on; drives the friendlier import preview. */
export type ShareKind = 'routine' | 'plan' | 'workout' | 'exercise';
export type ShareDescriptor = { kind: ShareKind; title: string; summary?: string };

export type ForgeDataTransfer = {
  format: 'forge-data';
  version: number;
  exportedAt: string;
  settings: SettingsPreferences;
  plans: PlansState;
  workouts: WorkoutState;
  customExercises: ExerciseCatalogItem[];
  /** Describes the intentionally selected portable sections. Older v1 files safely omit it. */
  selection?: DataTransferSelection;
  /** Present on a single-item share; advisory only, safely omitted by whole-data exports. */
  share?: ShareDescriptor;
};
