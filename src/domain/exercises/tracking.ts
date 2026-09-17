import type { SetMeasurement, SetMeasurementKind, TrackingType, WorkoutSet } from '../../types';
export const trackingFields: Record<TrackingType, readonly SetMeasurementKind[]> = {
  'weight-reps': ['weight', 'reps'], 'bodyweight-reps': ['reps'], 'weighted-bodyweight': ['addedWeight', 'reps'], 'assisted-bodyweight': ['addedWeight', 'reps'], 'reps-only': ['reps'], 'duration': ['duration'], 'duration-weight': ['duration', 'weight'], 'distance-duration': ['distance', 'duration'], 'weight-distance': ['weight', 'distance'],
};
export const measurementUnit: Record<SetMeasurementKind, SetMeasurement['unit']> = { reps: 'count', weight: 'kg', addedWeight: 'kg', duration: 'sec', distance: 'km', rpe: 'rpe' };
export const trackingLabels: Record<SetMeasurementKind, string> = { reps: 'Reps', weight: 'Kg', addedWeight: 'Kg', duration: 'Sec', distance: 'KM', rpe: 'RPE' };
export function trackingFieldLabel(type: TrackingType, kind: SetMeasurementKind): string {
  if (kind === 'addedWeight') return type === 'assisted-bodyweight' ? 'Assisted kg' : 'Added kg';
  return trackingLabels[kind];
}
export function measurementsFor(mode: TrackingType | undefined, set: WorkoutSet): SetMeasurement[] {
  if (set.measurements?.length) return set.measurements;
  return trackingFields[mode ?? 'weight-reps'].flatMap((kind) => { const legacy = kind === 'reps' ? set.reps : set.weight; const value = Number(String(legacy).replace(',', '.')); return Number.isFinite(value) && String(legacy).trim() ? [{ id: `${set.id}-${kind}`, kind, unit: measurementUnit[kind], value }] : []; });
}
export function updateMeasurement(set: WorkoutSet, kind: SetMeasurementKind, text: string): SetMeasurement[] {
  const existing = measurementsFor(undefined, set).filter((entry) => entry.kind !== kind); const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && text.trim() ? [...existing, { id: `${set.id}-${kind}`, kind, unit: measurementUnit[kind], value }] : existing;
}
export function measurementText(set: WorkoutSet, kind: SetMeasurementKind): string { const value = measurementsFor(undefined, set).find((entry) => entry.kind === kind)?.value; return value !== undefined ? String(value) : kind === 'reps' ? set.reps : kind === 'weight' || kind === 'addedWeight' ? set.weight : ''; }
