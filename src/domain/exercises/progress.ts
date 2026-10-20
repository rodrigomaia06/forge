import type { TrackingType, Workout, WorkoutExercise, SetMeasurementKind } from '../../types';
import { effectiveTracking, measurementsFor, measurementUnit, trackingFields } from './tracking';

export const progressMetrics = [
  'load',
  'volume',
  'best-reps',
  'total-reps',
  'longest-duration',
  'total-duration',
  'distance',
  'pace',
] as const;
export type ProgressMetric = (typeof progressMetrics)[number];
export type ProgressOverride = 'include' | 'exclude';
export type ProgressOverrides = Record<string, Record<string, ProgressOverride>>;
export type ExerciseSession = { workout: Workout; exercises: WorkoutExercise[] };
export type ProgressPoint = {
  workoutId: string;
  date: number;
  value: number;
  automatic: boolean;
  excluded: boolean;
  override?: ProgressOverride;
  trend?: number;
};
const normalizedName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export function exerciseIdentity(exercise: WorkoutExercise): string {
  const id = exercise.exerciseSnapshot?.id ?? exercise.exerciseId;
  return id ? `id:${id}` : `name:${normalizedName(exercise.name)}`;
}
export function progressScope(exercise: WorkoutExercise, metric: ProgressMetric): string {
  return JSON.stringify([exerciseIdentity(exercise), effectiveTracking(exercise), metric]);
}
export function exerciseSessions(
  exercise: WorkoutExercise,
  workouts: readonly Workout[],
): ExerciseSession[] {
  const id = exercise.exerciseSnapshot?.id ?? exercise.exerciseId;
  const identity = exerciseIdentity(exercise);
  const mode = effectiveTracking(exercise);
  return workouts
    .flatMap((workout) => {
      if (workout.completedAt === null || !Number.isFinite(workout.completedAt)) return [];
      const exercises = workout.exercises.filter(
        (candidate) =>
          effectiveTracking(candidate) === mode &&
          (id
            ? exerciseIdentity(candidate) === identity
            : normalizedName(candidate.name) === normalizedName(exercise.name)),
      );
      return exercises.length ? [{ workout, exercises }] : [];
    })
    .sort(
      (a, b) =>
        a.workout.startedAt - b.workout.startedAt || a.workout.id.localeCompare(b.workout.id),
    );
}
export function metricsFor(mode: TrackingType): ProgressMetric[] {
  const fields = trackingFields[mode];
  return [
    ...(fields.includes('weight') || fields.includes('addedWeight') ? ['load' as const] : []),
    ...(mode === 'weight-reps' ? ['volume' as const] : []),
    ...(fields.includes('reps') ? ['best-reps' as const, 'total-reps' as const] : []),
    ...(fields.includes('distance') ? ['distance' as const] : []),
    ...(fields.includes('duration')
      ? ['longest-duration' as const, 'total-duration' as const]
      : []),
    ...(mode === 'distance-duration' ? ['pace' as const] : []),
  ];
}
export function metricLabel(metric: ProgressMetric, mode: TrackingType): string {
  return {
    load: mode.startsWith('assisted')
      ? 'Assistance'
      : mode.startsWith('weighted-bodyweight')
        ? 'Added weight'
        : 'Weight',
    volume: 'Volume',
    'best-reps': 'Best-set reps',
    'total-reps': 'Session reps',
    'longest-duration': 'Longest set',
    'total-duration': 'Total duration',
    distance: 'Total distance',
    pace: 'Average pace',
  }[metric];
}
export function completedProgressSets(session: ExerciseSession, mode: TrackingType) {
  return session.exercises.flatMap((exercise) =>
    exercise.offSession
      ? []
      : exercise.sets.flatMap((set) => {
          if (
            !set.completed ||
            set.tag === 'Warm Up' ||
            (set.sideCompletion && (!set.sideCompletion.left || !set.sideCompletion.right))
          )
            return [];
          const recorded = measurementsFor(mode, set);
          const legacy = measurementsFor(mode, { ...set, measurements: undefined });
          const entries = [
            ...recorded,
            ...legacy.filter((entry) => !recorded.some((item) => item.kind === entry.kind)),
          ];
          const fields: Partial<Record<SetMeasurementKind, number>> = {};
          for (const kind of trackingFields[mode]) {
            const matches = entries.filter((entry) => entry.kind === kind);
            if (matches.length !== 1) return [];
            const entry = matches[0];
            if (
              entry.unit !== measurementUnit[kind] ||
              !Number.isFinite(entry.value) ||
              entry.value < 0 ||
              (['reps', 'distance', 'duration'].includes(kind) && entry.value === 0)
            )
              return [];
            fields[kind] = entry.value;
          }
          return [fields];
        }),
  );
}
function sessionValue(
  session: ExerciseSession,
  mode: TrackingType,
  metric: ProgressMetric,
): number | undefined {
  const values = completedProgressSets(session, mode);
  if (!values.length) return undefined;
  const sum = (kind: SetMeasurementKind) =>
    values.reduce((total, set) => total + (set[kind] ?? 0), 0);
  const maximum = (kind: SetMeasurementKind) => Math.max(...values.map((set) => set[kind] ?? 0));
  switch (metric) {
    case 'load':
      return mode.startsWith('assisted')
        ? Math.min(...values.map((set) => set.addedWeight!))
        : maximum(trackingFields[mode].includes('weight') ? 'weight' : 'addedWeight');
    case 'volume':
      return values.reduce((total, set) => total + set.weight! * set.reps!, 0);
    case 'best-reps':
      return maximum('reps');
    case 'total-reps':
      return sum('reps');
    case 'longest-duration':
      return maximum('duration');
    case 'total-duration':
      return sum('duration');
    case 'distance':
      return sum('distance');
    case 'pace':
      return sum('distance') > 0 && sum('duration') > 0
        ? sum('duration') / sum('distance')
        : undefined;
  }
}
export function median(values: readonly number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}
export function classifyProgress(
  points: readonly { workoutId: string; date: number; value: number }[],
  overrides: Record<string, ProgressOverride> = {},
): ProgressPoint[] {
  const included: number[] = [];
  return points.map((point, index) => {
    let automatic = false;
    if (points.length >= 7) {
      const start = Math.max(0, Math.min(index - 3, points.length - 7));
      const neighbours = points
        .slice(start, start + 7)
        .filter((_, offset) => start + offset !== index)
        .map((item) => item.value);
      const baseline = median(neighbours);
      const deviation = Math.abs(point.value - baseline);
      const scaledMad = median(neighbours.map((value) => Math.abs(value - baseline))) * 1.4826;
      automatic =
        baseline !== 0 && deviation > Math.abs(baseline) * 0.35 && deviation > 3.5 * scaledMad;
    }
    const override = overrides[point.workoutId];
    const excluded = override === 'exclude' || (override !== 'include' && automatic);
    if (!excluded) included.push(point.value);
    return {
      ...point,
      automatic,
      excluded,
      override,
      trend: !excluded && included.length >= 3 ? median(included.slice(-5)) : undefined,
    };
  });
}
export function exerciseProgress(
  exercise: WorkoutExercise,
  sessions: readonly ExerciseSession[],
  metric: ProgressMetric,
  overrides: ProgressOverrides = {},
): ProgressPoint[] {
  const mode = effectiveTracking(exercise);
  const raw = sessions.flatMap((session) => {
    const value = sessionValue(session, mode, metric);
    return value !== undefined && Number.isFinite(value)
      ? [{ workoutId: session.workout.id, date: session.workout.startedAt, value }]
      : [];
  });
  return classifyProgress(raw, overrides[progressScope(exercise, metric)]);
}
export function progressInRange(
  points: readonly ProgressPoint[],
  days: number | 'all',
  now = Date.now(),
): ProgressPoint[] {
  return days === 'all'
    ? [...points]
    : points.filter((point) => point.date >= now - days * 86400000);
}
export function validateProgressOverrides(value: unknown): ProgressOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([scope, records]) => {
      try {
        const key = JSON.parse(scope);
        if (
          !Array.isArray(key) ||
          key.length !== 3 ||
          typeof key[0] !== 'string' ||
          !/^(id|name):.+/.test(key[0]) ||
          !Object.hasOwn(trackingFields, key[1]) ||
          !metricsFor(key[1]).includes(key[2]) ||
          !records ||
          typeof records !== 'object' ||
          Array.isArray(records)
        )
          return [];
        const valid = Object.fromEntries(
          Object.entries(records).filter(
            ([id, choice]) => id.trim() && (choice === 'include' || choice === 'exclude'),
          ),
        );
        return Object.keys(valid).length
          ? [[scope, valid as Record<string, ProgressOverride>]]
          : [];
      } catch {
        return [];
      }
    }),
  );
}
export function mergeProgressOverrides(
  current: ProgressOverrides,
  incoming: unknown,
  workoutIds: ReadonlySet<string>,
): ProgressOverrides {
  const merged = { ...current };
  for (const [scope, overrides] of Object.entries(validateProgressOverrides(incoming))) {
    merged[scope] = {
      ...Object.fromEntries(Object.entries(overrides).filter(([id]) => workoutIds.has(id))),
      ...current[scope],
    };
  }
  return merged;
}
