import { dateFormatter } from '../../utils/dateFormatters';
import type { Workout, WorkoutExercise, WorkoutSet } from '../../types';
import type { WeekStartsOn } from '../../types';
import { exerciseCatalogById } from '../../data/exerciseCatalog';
import { startOfWeek, computeWorkoutVolume } from '../../screens/dashboard/dashboardSummary';

function completedAt(workout: Workout): number {
  return workout.completedAt ?? workout.startedAt;
}
function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

// ---------------------------------------------------------------------------
// Muscle grouping — the catalogue tags a primary muscle (label or slug); both
// normalise to one of six display groups.
// ---------------------------------------------------------------------------
export type MuscleGroup = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core';
export const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

const MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'Chest',
  lats: 'Back', upperback: 'Back', lowerback: 'Back', traps: 'Back',
  quads: 'Legs', hamstrings: 'Legs', glutes: 'Legs', calves: 'Legs',
  adductors: 'Legs', abductors: 'Legs', hipflexors: 'Legs', tibialis: 'Legs',
  frontdelts: 'Shoulders', sidedelts: 'Shoulders', reardelts: 'Shoulders', neck: 'Shoulders',
  biceps: 'Arms', triceps: 'Arms', forearms: 'Arms',
  abs: 'Core', obliques: 'Core',
};

function normaliseMuscle(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}
export function muscleGroupOf(muscle: string | undefined): MuscleGroup | null {
  if (!muscle) return null;
  return MUSCLE_TO_GROUP[normaliseMuscle(muscle)] ?? null;
}
function exerciseGroup(exercise: WorkoutExercise): MuscleGroup | null {
  const label = exercise.exerciseSnapshot?.primaryMuscle
    ?? (exercise.exerciseId ? exerciseCatalogById.get(exercise.exerciseId)?.primaryMuscle : undefined);
  return muscleGroupOf(label ?? undefined);
}
function isWorkingSet(set: WorkoutSet): boolean {
  return (set.tag ?? '').trim().toLowerCase() !== 'warm up';
}

/** Display names for individual muscles (keyed by normalised slug). */
export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  lats: 'Lats', upperback: 'Upper back', lowerback: 'Lower back', traps: 'Traps',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  adductors: 'Adductors', abductors: 'Abductors', hipflexors: 'Hip flexors', tibialis: 'Tibialis',
  frontdelts: 'Front delts', sidedelts: 'Side delts', reardelts: 'Rear delts', neck: 'Neck',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques',
};

/** Individual muscles grouped, for the muscle-balance detail picker (in order). */
export const MUSCLES_BY_GROUP: { group: MuscleGroup; slugs: string[] }[] = [
  { group: 'Chest', slugs: ['chest'] },
  { group: 'Back', slugs: ['lats', 'upperback', 'lowerback', 'traps'] },
  { group: 'Legs', slugs: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'hipflexors', 'tibialis'] },
  { group: 'Shoulders', slugs: ['frontdelts', 'sidedelts', 'reardelts', 'neck'] },
  { group: 'Arms', slugs: ['biceps', 'triceps', 'forearms'] },
  { group: 'Core', slugs: ['abs', 'obliques'] },
];

export interface MuscleBalanceEntry {
  label: string;
  sets: number;
  group: MuscleGroup;
}
function exercisePrimarySlug(exercise: WorkoutExercise): string | null {
  const label = exercise.exerciseSnapshot?.primaryMuscle
    ?? (exercise.exerciseId ? exerciseCatalogById.get(exercise.exerciseId)?.primaryMuscle : undefined);
  return label ? normaliseMuscle(label) : null;
}

/** Working sets per muscle group over the trailing `windowWeeks` weeks. */
export function muscleBalance(
  completedWorkouts: readonly Workout[],
  windowWeeks: number,
  now: Date,
): MuscleBalanceEntry[] {
  const since = addDays(now, -windowWeeks * 7).getTime();
  const counts = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  for (const workout of completedWorkouts) {
    if (completedAt(workout) < since) continue;
    for (const exercise of workout.exercises) {
      const group = exerciseGroup(exercise);
      if (!group) continue;
      const working = exercise.sets.filter(isWorkingSet).length;
      counts.set(group, (counts.get(group) ?? 0) + working);
    }
  }
  return MUSCLE_GROUPS.map((group) => ({ label: group, group, sets: counts.get(group) ?? 0 }));
}

/** Working sets for the chosen individual muscles over `windowWeeks` weeks. */
export function muscleBalanceByMuscle(
  completedWorkouts: readonly Workout[],
  windowWeeks: number,
  now: Date,
  slugs: string[],
): MuscleBalanceEntry[] {
  const since = addDays(now, -windowWeeks * 7).getTime();
  const wanted = new Set(slugs);
  const counts = new Map<string, number>(slugs.map((s) => [s, 0]));
  for (const workout of completedWorkouts) {
    if (completedAt(workout) < since) continue;
    for (const exercise of workout.exercises) {
      const slug = exercisePrimarySlug(exercise);
      if (!slug || !wanted.has(slug)) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + exercise.sets.filter(isWorkingSet).length);
    }
  }
  return slugs.map((slug) => ({
    label: MUSCLE_LABELS[slug] ?? slug,
    group: MUSCLE_TO_GROUP[slug] ?? 'Core',
    sets: counts.get(slug) ?? 0,
  }));
}

function exerciseSecondarySlugs(exercise: WorkoutExercise): string[] {
  const list = exercise.exerciseSnapshot?.secondaryMuscles
    ?? (exercise.exerciseId ? exerciseCatalogById.get(exercise.exerciseId)?.secondaryMuscles : undefined)
    ?? [];
  return list.map(normaliseMuscle).filter(Boolean);
}

/**
 * Per-individual-muscle intensity 0..1 (relative to the busiest muscle) over
 * `windowDays`, keyed by normalised muscle slug (e.g. `frontdelts`, `quads`).
 * The primary muscle takes a full working set; each secondary muscle takes half
 * — so a bench press lights up chest fully and triceps / front delts partially.
 */
export function muscleHeatBySlug(
  completedWorkouts: readonly Workout[],
  windowDays: number,
  now: Date,
): Record<string, number> {
  const since = addDays(now, -windowDays).getTime();
  const counts = new Map<string, number>();
  for (const workout of completedWorkouts) {
    if (completedAt(workout) < since) continue;
    for (const exercise of workout.exercises) {
      const working = exercise.sets.filter(isWorkingSet).length;
      if (working <= 0) continue;
      const primary = exercisePrimarySlug(exercise);
      if (primary) counts.set(primary, (counts.get(primary) ?? 0) + working);
      for (const secondary of exerciseSecondarySlugs(exercise)) {
        if (secondary === primary) continue;
        counts.set(secondary, (counts.get(secondary) ?? 0) + working * 0.5);
      }
    }
  }
  const max = Math.max(1, ...counts.values());
  const out: Record<string, number> = {};
  for (const [slug, c] of counts) out[slug] = c / max;
  return out;
}

/** Per-group intensity 0..1 (relative to the busiest group) over `windowDays`. */
export function muscleHeat(
  completedWorkouts: readonly Workout[],
  windowDays: number,
  now: Date,
): Record<MuscleGroup, number> {
  const since = addDays(now, -windowDays).getTime();
  const counts = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  for (const workout of completedWorkouts) {
    if (completedAt(workout) < since) continue;
    for (const exercise of workout.exercises) {
      const group = exerciseGroup(exercise);
      if (!group) continue;
      counts.set(group, (counts.get(group) ?? 0) + exercise.sets.filter(isWorkingSet).length);
    }
  }
  const max = Math.max(1, ...counts.values());
  const out = {} as Record<MuscleGroup, number>;
  for (const group of MUSCLE_GROUPS) out[group] = (counts.get(group) ?? 0) / max;
  return out;
}

// ---------------------------------------------------------------------------
// Rest-timer stats
// ---------------------------------------------------------------------------
export interface RestStats {
  avgRestSeconds: number | null;
  totalRestSeconds: number;
  sessions: number;
  /** Average rest of the most recent sessions (oldest→newest), for a sparkline. */
  recent: number[];
  /** Change in weighted-average rest vs the previous equal window; null when either side is empty. */
  deltaSeconds: number | null;
}

/** Sample-weighted average rest over workouts whose completion falls in [since, until). */
function weightedAvgRest(workouts: readonly Workout[], since: number, until: number): number | null {
  let weighted = 0;
  let samples = 0;
  for (const w of workouts) {
    const at = completedAt(w);
    if (at < since || at >= until) continue;
    if (typeof w.averageRestSeconds !== 'number' || (w.restTimerSamples ?? 0) <= 0) continue;
    const n = w.restTimerSamples ?? 0;
    weighted += w.averageRestSeconds * n;
    samples += n;
  }
  return samples > 0 ? weighted / samples : null;
}

export function restStats(
  completedWorkouts: readonly Workout[],
  windowDays: number,
  now: Date,
): RestStats {
  const until = now.getTime();
  const since = addDays(now, -windowDays).getTime();
  const priorSince = addDays(now, -windowDays * 2).getTime();
  const inWindow = [...completedWorkouts]
    .filter((w) => completedAt(w) >= since && completedAt(w) < until && typeof w.averageRestSeconds === 'number' && (w.restTimerSamples ?? 0) > 0)
    .sort((a, b) => completedAt(a) - completedAt(b));
  let weighted = 0;
  let samples = 0;
  for (const w of inWindow) {
    const n = w.restTimerSamples ?? 0;
    weighted += (w.averageRestSeconds as number) * n;
    samples += n;
  }
  const current = samples > 0 ? weighted / samples : null;
  const prior = weightedAvgRest(completedWorkouts, priorSince, since);
  return {
    avgRestSeconds: current !== null ? Math.round(current) : null,
    totalRestSeconds: Math.round(weighted),
    sessions: inWindow.length,
    recent: inWindow.slice(-8).map((w) => w.averageRestSeconds as number),
    deltaSeconds: current !== null && prior !== null ? Math.round(current - prior) : null,
  };
}

// ---------------------------------------------------------------------------
// Consistency — session count per day for the trailing weeks (column-major).
// ---------------------------------------------------------------------------
export interface Consistency {
  /**
   * windowWeeks*7 values, column by column (each column a week, top→bottom =
   * weekdays). A cell is that day's training load (completed sets); 0 = rest,
   * -1 = a future day. The grid colours load *relative* to `maxDayLoad`, so the
   * gradient spreads to a typical trainer instead of everyone sitting on level 1.
   */
  cells: number[];
  weeks: number;
  sessions: number;
  activeDays: number;
  /** Busiest day's load in the window, for relative colour scaling. */
  maxDayLoad: number;
  /** Timestamp of the grid's first day (the oldest column, top row). */
  startTs: number;
}
function completedSetCount(workout: Workout): number {
  let n = 0;
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) if (set.completed) n += 1;
  }
  return n;
}
export function consistency(
  completedWorkouts: readonly Workout[],
  windowWeeks: number,
  now: Date,
  weekStartsOn: WeekStartsOn = 1,
): Consistency {
  const gridStart = startOfWeek(addDays(startOfWeek(now, weekStartsOn), -(windowWeeks - 1) * 7), weekStartsOn);
  const loadPerDay = new Map<number, number>();
  let sessions = 0;
  for (const workout of completedWorkouts) {
    const day = new Date(completedAt(workout));
    const key = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    if (key < gridStart.getTime()) continue;
    // A day with a logged workout counts as active even with zero completed
    // sets (e.g. a cardio session), so floor its load at 1.
    loadPerDay.set(key, (loadPerDay.get(key) ?? 0) + Math.max(1, completedSetCount(workout)));
    sessions += 1;
  }
  const cells: number[] = [];
  let activeDays = 0;
  let maxDayLoad = 0;
  for (let week = 0; week < windowWeeks; week += 1) {
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(gridStart, week * 7 + d);
      const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const load = date.getTime() > now.getTime() ? -1 : (loadPerDay.get(key) ?? 0); // -1 = future
      if (load > 0) {
        activeDays += 1;
        maxDayLoad = Math.max(maxDayLoad, load);
      }
      cells.push(load);
    }
  }
  return { cells, weeks: windowWeeks, sessions, activeDays, maxDayLoad, startTs: gridStart.getTime() };
}

// ---------------------------------------------------------------------------
// Streak — consecutive weeks that hit a workouts-per-week goal (optionally set
// per workout type), plus this week's progress and rest days.
// ---------------------------------------------------------------------------
export interface StreakStats {
  streakWeeks: number;
  thisWeekCount: number;
  thisWeekGoal: number;
  restDays: number;
  metThisWeek: boolean;
}
function weekWorkouts(completedWorkouts: readonly Workout[], weekStart: number): Workout[] {
  const weekEnd = weekStart + 7 * 24 * 3600 * 1000;
  return completedWorkouts.filter((w) => {
    const t = completedAt(w);
    return t >= weekStart && t < weekEnd;
  });
}
function weekMeetsGoal(
  workouts: Workout[],
  weeklyTargetDefault: number,
  weeklyTargets: Record<string, number>,
): boolean {
  const perType = Object.entries(weeklyTargets).filter(([, target]) => target > 0);
  if (perType.length) {
    return perType.every(([typeName, target]) => {
      const key = typeName.trim().toLowerCase();
      return workouts.filter((w) => w.type.trim().toLowerCase() === key).length >= target;
    });
  }
  return workouts.length >= Math.max(1, weeklyTargetDefault);
}
export function streakStats(
  completedWorkouts: readonly Workout[],
  weeklyTargetDefault: number,
  weeklyTargets: Record<string, number>,
  now: Date,
  weekStartsOn: WeekStartsOn = 1,
): StreakStats {
  const currentWeekStart = startOfWeek(now, weekStartsOn).getTime();
  const goalTotal = Object.values(weeklyTargets).filter((t) => t > 0).reduce((a, b) => a + b, 0)
    || Math.max(1, weeklyTargetDefault);

  const thisWeek = weekWorkouts(completedWorkouts, currentWeekStart);
  const metThisWeek = weekMeetsGoal(thisWeek, weeklyTargetDefault, weeklyTargets);

  // Count consecutive fully-elapsed weeks that met the goal, then add this week.
  let streak = 0;
  for (let back = 1; back < 260; back += 1) {
    const weekStart = currentWeekStart - back * 7 * 24 * 3600 * 1000;
    const workouts = weekWorkouts(completedWorkouts, weekStart);
    if (workouts.length === 0 && streak === 0 && back > 1) break; // no history that far
    if (weekMeetsGoal(workouts, weeklyTargetDefault, weeklyTargets)) streak += 1;
    else break;
  }
  if (metThisWeek) streak += 1;

  const trainingDays = new Set(
    thisWeek.map((w) => {
      const d = new Date(completedAt(w));
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }),
  ).size;

  return {
    streakWeeks: streak,
    thisWeekCount: thisWeek.length,
    thisWeekGoal: goalTotal,
    restDays: Math.max(0, 7 - trainingDays),
    metThisWeek,
  };
}

// ---------------------------------------------------------------------------
// Training volume — lifted volume per week over a trailing window.
// ---------------------------------------------------------------------------
export interface VolumeWeek {
  weekStart: number;
  volume: number;
  /** Short label for the week (month/day of the week's start). */
  label: string;
}
export interface VolumeSeries {
  weeks: VolumeWeek[]; // oldest → newest, exactly windowWeeks entries
  currentKg: number; // most recent (current) week
  previousKg: number; // week before the current one
  deltaPct: number | null; // current vs previous week
  totalKg: number; // summed across the window
}

export function volumeSeries(
  completedWorkouts: readonly Workout[],
  windowWeeks: number,
  now: Date,
  weekStartsOn: WeekStartsOn = 1,
): VolumeSeries {
  const currentWeekStart = startOfWeek(now, weekStartsOn);
  const weeks: VolumeWeek[] = [];
  for (let i = windowWeeks - 1; i >= 0; i -= 1) {
    const start = addDays(currentWeekStart, -7 * i);
    weeks.push({ weekStart: start.getTime(), volume: 0, label: shortDate(start) });
  }
  const firstStart = weeks[0]?.weekStart ?? currentWeekStart.getTime();
  for (const workout of completedWorkouts) {
    const at = completedAt(workout);
    if (at < firstStart) continue;
    // Bucket against the actual (DST-correct) week-start timestamps rather than a
    // fixed 7×24h division, which drifts by ±1h across a DST transition and can
    // land a boundary workout in the adjacent week.
    let idx = -1;
    for (let i = 0; i < weeks.length; i += 1) {
      if (at >= weeks[i].weekStart) idx = i;
      else break;
    }
    if (idx < 0) continue;
    weeks[idx].volume += computeWorkoutVolume(workout);
  }
  const currentKg = weeks[weeks.length - 1]?.volume ?? 0;
  const previousKg = weeks[weeks.length - 2]?.volume ?? 0;
  const deltaPct = previousKg > 0 ? Math.round(((currentKg - previousKg) / previousKg) * 100) : null;
  const totalKg = weeks.reduce((sum, w) => sum + w.volume, 0);
  return { weeks, currentKg, previousKg, deltaPct, totalKg };
}

function shortDate(date: Date): string {
  return dateFormatter({ month: 'short', day: 'numeric' }).format(date);
}

// ---------------------------------------------------------------------------
// Measurement tiles — trend of any tracked daily measurement over a window.
// ---------------------------------------------------------------------------
export interface MeasurementSeries {
  /** Chronological values (oldest → newest) inside the window, for the sparkline. */
  values: number[];
  latest: number | null;
  /** Change from the first in-window value to the latest, or null when < 2 points. */
  delta: number | null;
  /** Total points recorded inside the window. */
  count: number;
}

/** A daily measurement entry: `{ definitionId, date: 'YYYY-MM-DD', value }`. */
interface MeasurementEntryLike {
  definitionId: string;
  date: string;
  value: number;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Windowed, date-sorted series for one measurement definition. */
export function measurementSeries(
  entries: MeasurementEntryLike[],
  definitionId: string,
  windowDays: number,
  now: Date = new Date(),
): MeasurementSeries {
  // Inclusive of today: a 7-day window is today plus the previous 6 days, matching
  // the half-open windows the other dashboard selectors use.
  const cutoff = localDateKey(addDays(now, -(windowDays - 1)));
  const inWindow = entries
    .filter((entry) => entry.definitionId === definitionId && entry.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  const values = inWindow.map((entry) => entry.value);
  return {
    values,
    latest: values.length ? values[values.length - 1] : null,
    delta: values.length >= 2 ? values[values.length - 1] - values[0] : null,
    count: values.length,
  };
}
