import { measurementsFor } from '../../domain/exercises/tracking';
import { calendarDateKey } from '../../domain/workouts/calendarDate';
import type { Workout, WeekStartsOn } from '../../types';

/** Local start-of-day, so week math never shifts with UTC conversion. */
function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Start of the week containing `value`, honouring the user's week-start day. */
export function startOfWeek(value: Date, weekStartsOn: WeekStartsOn = 1): Date {
  const result = startOfDay(value);
  const delta = (result.getDay() - weekStartsOn + 7) % 7;
  result.setDate(result.getDate() - delta);
  return result;
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function completedAt(workout: Workout): number {
  return workout.completedAt ?? workout.startedAt;
}

/** Total lifted volume for a workout: Σ (weight × reps) over completed sets. */
export function computeWorkoutVolume(workout: Pick<Workout, 'exercises'>): number {
  let volume = 0;
  for (const exercise of workout.exercises) {
    const mode = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType;
    for (const set of exercise.sets) {
      if (!set.completed) continue;
      const measurements = measurementsFor(mode, set);
      const weight = measurements.find((entry) => entry.kind === 'weight' || entry.kind === 'addedWeight')?.value;
      const reps = measurements.find((entry) => entry.kind === 'reps')?.value;
      if (weight === undefined || reps === undefined) continue;
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) continue;
      volume += weight * reps;
    }
  }
  return volume;
}

export interface WeekStripDay {
  date: Date;
  label: string;
  hasWorkout: boolean;
  isToday: boolean;
  isFuture: boolean;
}

const MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The seven days of the current week with per-day training presence. */
export function weekStrip(
  completedWorkouts: readonly Workout[],
  now: Date,
  weekStartsOn: WeekStartsOn = 1,
): { days: WeekStripDay[]; workoutCount: number } {
  const weekStart = startOfWeek(now, weekStartsOn);
  const weekEndExclusive = addDays(weekStart, 7).getTime();
  const trainedKeys = new Set<string>();
  let workoutCount = 0;
  for (const workout of completedWorkouts) {
    const time = completedAt(workout);
    if (time >= weekStart.getTime() && time < weekEndExclusive) {
      trainedKeys.add(calendarDateKey(time));
      workoutCount += 1;
    }
  }
  const labels = weekStartsOn === 0 ? SUNDAY_FIRST : MONDAY_FIRST;
  const todayKey = calendarDateKey(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const key = calendarDateKey(date);
    return {
      date,
      label: labels[index],
      hasWorkout: trainedKeys.has(key),
      isToday: key === todayKey,
      isFuture: startOfDay(date).getTime() > startOfDay(now).getTime(),
    };
  });
  return { days, workoutCount };
}

/** This week's total training seconds plus a per-weekday breakdown for the bar chart. */
export function trainingTimeThisWeek(
  completedWorkouts: readonly Workout[],
  now: Date,
  weekStartsOn: WeekStartsOn = 1,
): { totalSeconds: number; perDaySeconds: number[] } {
  const weekStart = startOfWeek(now, weekStartsOn);
  const perDaySeconds = new Array(7).fill(0) as number[];
  let totalSeconds = 0;
  for (const workout of completedWorkouts) {
    const time = completedAt(workout);
    const dayIndex = Math.floor((startOfDay(new Date(time)).getTime() - weekStart.getTime()) / 86400000);
    if (dayIndex < 0 || dayIndex > 6) continue;
    const seconds = workout.durationSeconds ?? 0;
    perDaySeconds[dayIndex] += seconds;
    totalSeconds += seconds;
  }
  return { totalSeconds, perDaySeconds };
}

/** This week's lifted volume against last week's, with a rounded percentage delta. */
export function weekVolume(
  completedWorkouts: readonly Workout[],
  now: Date,
  weekStartsOn: WeekStartsOn = 1,
): { thisWeekKg: number; lastWeekKg: number; deltaPct: number | null } {
  const thisWeekStart = startOfWeek(now, weekStartsOn).getTime();
  const lastWeekStart = addDays(startOfWeek(now, weekStartsOn), -7).getTime();
  let thisWeekKg = 0;
  let lastWeekKg = 0;
  for (const workout of completedWorkouts) {
    const time = completedAt(workout);
    if (time >= thisWeekStart) {
      thisWeekKg += computeWorkoutVolume(workout);
    } else if (time >= lastWeekStart) {
      lastWeekKg += computeWorkoutVolume(workout);
    }
  }
  const deltaPct = lastWeekKg > 0 ? Math.round(((thisWeekKg - lastWeekKg) / lastWeekKg) * 100) : null;
  return { thisWeekKg, lastWeekKg, deltaPct };
}

/** The most recently completed workout, if any. */
export function lastCompletedWorkout(completedWorkouts: readonly Workout[]): Workout | null {
  let latest: Workout | null = null;
  for (const workout of completedWorkouts) {
    if (workout.completedAt === null) continue;
    if (!latest || completedAt(workout) > completedAt(latest)) latest = workout;
  }
  return latest;
}

/** "Xh Ym" / "Ym" from a duration in seconds. */
export function formatTrainingTime(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Thousands-grouped kilograms, e.g. 12450 -> "12,450 kg". */
export function formatVolume(kg: number): string {
  return `${Math.round(kg).toLocaleString('en-US')} kg`;
}
