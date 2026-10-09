import type { SetMeasurement, SetMeasurementKind, TrackingType, WorkoutSet } from '../../types';
export const trackingFields: Record<TrackingType, readonly SetMeasurementKind[]> = {
  'weight-reps': ['weight', 'reps'], 'bodyweight-reps': ['reps'], 'weighted-bodyweight': ['addedWeight', 'reps'], 'assisted-bodyweight': ['addedWeight', 'reps'], 'reps-only': ['reps'],
  duration: ['duration'], 'duration-weight': ['duration', 'weight'], 'distance-duration': ['distance', 'duration'], 'weight-distance': ['weight', 'distance'],
  distance: ['distance'],
  'weighted-bodyweight-duration': ['addedWeight', 'duration'],
  'assisted-bodyweight-duration': ['addedWeight', 'duration'],
};
export const measurementUnit: Record<SetMeasurementKind, SetMeasurement['unit']> = { reps: 'count', weight: 'kg', addedWeight: 'kg', duration: 'sec', distance: 'km', rpe: 'rpe' };
export const trackingLabels: Record<SetMeasurementKind, string> = { reps: 'Reps', weight: 'Kg', addedWeight: 'Kg', duration: 'Time', distance: 'KM', rpe: 'RPE',
};
export function trackingFieldLabel(type: TrackingType, kind: SetMeasurementKind): string {
  if (kind === 'addedWeight') return type.startsWith('assisted-bodyweight') ? 'Assisted kg' : 'Added kg';
  return trackingLabels[kind];
}
export function measurementsFor(mode: TrackingType | undefined, set: WorkoutSet): SetMeasurement[] {
  if (set.measurements?.length) return mode && !set.importMetadata
      ? set.measurements.filter(
          (entry) => trackingFields[mode].includes(entry.kind) || entry.kind === 'rpe',
        )
      : set.measurements;
  return trackingFields[mode ?? 'weight-reps'].flatMap((kind) => {
    // Legacy sets only ever stored reps + a single weight. Never fabricate a
    // distance/duration/rpe value from the weight column for multi-field types
    // (e.g. weight-distance, distance-duration).
    const legacy = kind === 'reps' ? set.reps : (kind === 'weight' || kind === 'addedWeight') ? set.weight : undefined;
    if (legacy === undefined) return [];
    const value = Number(String(legacy).replace(',', '.'));
    return Number.isFinite(value) && String(legacy).trim() ? [{ id: `${set.id}-${kind}`, kind, unit: measurementUnit[kind], value }] : [];
  });
}
export function updateMeasurement(
  set: WorkoutSet,
  kind: SetMeasurementKind,
  text: string,
): SetMeasurement[] {
  const existing = measurementsFor(undefined, set).filter((entry) => entry.kind !== kind);
  const value = kind === 'duration' ? parseDuration(text) : Number(text.replace(',', '.'));
  return Number.isFinite(value) && text.trim() ? [...existing, { id: `${set.id}-${kind}`, kind, unit: measurementUnit[kind], value }] : existing;
}
export function measurementText(set: WorkoutSet, kind: SetMeasurementKind): string { const value = measurementsFor(undefined, set).find((entry) => entry.kind === kind)?.value; return value !== undefined ? String(value) : kind === 'reps' ? set.reps : kind === 'weight' || kind === 'addedWeight' ? set.weight : ''; }

/** A user choice is independent of catalogue metadata and survives reseeding. */
export function effectiveTracking(exercise: {
  trackingOverride?: TrackingType;
  trackingType?: TrackingType;
  exerciseSnapshot?: { trackingType?: TrackingType };
}): TrackingType {
  const override = exercise.trackingOverride;
  return override && Object.hasOwn(trackingFields, override)
    ? override
    : (exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps');
}
export function parseDuration(text: string): number {
  const clock = text.trim().replace(/,/g, ':');
  if (!/^\d+(?::\d{1,2})*$/.test(clock)) return NaN;
  const parts = clock.split(':').map(Number);
  if (parts.slice(1).some((value) => value >= 60)) return NaN;
  const seconds = parts.reduce((total, value) => total * 60 + value, 0);
  return Number.isSafeInteger(seconds) ? seconds : NaN;
}
export function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function measurementDisplay(set: WorkoutSet, kind: SetMeasurementKind): string {
  const text = measurementText(set, kind);
  return kind === 'duration' && text ? formatDuration(Number(text)) : text;
}
export function trackingModeLabel(mode: TrackingType): string {
  const labels: Record<TrackingType, string> = {
    'weight-reps': 'Weight + reps',
    'bodyweight-reps': 'Reps',
    'reps-only': 'Reps',
    'weighted-bodyweight': 'Added weight + reps',
    'assisted-bodyweight': 'Assisted weight + reps',
    duration: 'Time',
    'duration-weight': 'Weight + time',
    distance: 'Distance',
    'distance-duration': 'Distance + time',
    'weight-distance': 'Weight + distance',
    'weighted-bodyweight-duration': 'Added weight + time',
    'assisted-bodyweight-duration': 'Assisted weight + time',
  };
  return labels[mode];
}
export function trackingChoices(
  exercise: Parameters<typeof effectiveTracking>[0] & {
    exerciseSnapshot?: { trackingType?: TrackingType; workoutTypeIds?: string[] };
  },
): TrackingType[] {
  const base = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps';
  if (base.startsWith('assisted-bodyweight'))
    return ['assisted-bodyweight', 'assisted-bodyweight-duration'];
  if (base.startsWith('weighted-bodyweight'))
    return ['weighted-bodyweight', 'weighted-bodyweight-duration'];
  if (base === 'weight-distance') return ['weight-distance', 'duration-weight'];
  if (base === 'weight-reps' || base === 'duration-weight')
    return ['weight-reps', 'duration-weight'];
  if (
    base === 'distance' ||
    base === 'distance-duration' ||
    exercise.exerciseSnapshot?.workoutTypeIds?.includes('cardio')
  )
    return ['distance', 'duration', 'distance-duration'];
  return [base === 'reps-only' ? 'reps-only' : 'bodyweight-reps', 'duration'];
}

export function missingTrackingFields(mode: TrackingType, set: WorkoutSet): SetMeasurementKind[] {
  return trackingFields[mode].filter((kind) => {
    const value = measurementText(set, kind);
    return !value.trim() || !Number.isFinite(Number(value.replace(',', '.')));
  });
}
