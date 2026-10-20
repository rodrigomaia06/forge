import { measurementText, updateMeasurement } from '../exercises/tracking';
import type { SetMeasurement, WorkoutSet } from '../../types';

/** Keep the portable RPE field compatible while presenting reps in reserve. */
export function setRirText(set: WorkoutSet): string {
  const recorded = measurementText(set, 'rpe');
  if (!recorded) return '';
  const rpe = Number(recorded);
  return Number.isFinite(rpe) && rpe >= 0 && rpe <= 10 ? String(Number((10 - rpe).toFixed(6))) : '';
}

export function updateSetRir(set: WorkoutSet, text: string): SetMeasurement[] {
  if (!text.trim()) return updateMeasurement(set, 'rpe', '');
  const rir = Number(text.replace(',', '.'));
  if (!Number.isFinite(rir) || rir < 0 || rir > 10) return set.measurements ?? [];
  return updateMeasurement(set, 'rpe', String(Number((10 - rir).toFixed(6))));
}
