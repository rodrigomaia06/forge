import { calendarDateKey } from './calendarDate';
import type { Workout, WorkoutPlan, WorkoutRoutine } from '../../types';

export interface WorkoutSuggestion {
  routine: WorkoutRoutine;
  plan?: WorkoutPlan;
}

export interface SuggestNextWorkoutInput {
  completedWorkouts: readonly Workout[];
  plans: readonly WorkoutPlan[];
  standaloneRoutines: readonly WorkoutRoutine[];
  now?: Date;
}

function completedAt(workout: Workout): number {
  return workout.completedAt ?? workout.startedAt;
}

/**
 * Suggests the routine to start next, inferred from the user's own history.
 *
 * Every routine competes in one pool — standalone routines first, then plan
 * routines in order — ranked by how *overdue* it is (days since last trained; a
 * never-trained routine is the most due), then by weekday habit, then by
 * definition order. A routine already completed today is excluded, so the
 * suggestion is always the next thing to do, never what was just finished. With no
 * history it cold-starts on the first routine; it returns null only when there is
 * nothing left to suggest today (everything done, or no routines).
 */
export function suggestNextWorkout({
  completedWorkouts,
  plans,
  standaloneRoutines,
  now = new Date(),
}: SuggestNextWorkoutInput): WorkoutSuggestion | null {
  const todayKey = calendarDateKey(now);
  const nowMs = now.getTime();
  const todayWeekday = now.getDay();
  // Last-trained time per routine, which were done today (excluded), and how often
  // each is trained on this weekday (a tiebreak).
  const lastTrained = new Map<string, number>();
  const doneToday = new Set<string>();
  const weekdayHabit = new Map<string, number>();
  for (const workout of completedWorkouts) {
    if (!workout.routineId || workout.completedAt === null) continue;
    const time = completedAt(workout);
    const previous = lastTrained.get(workout.routineId);
    if (previous === undefined || time > previous) lastTrained.set(workout.routineId, time);
    const date = new Date(time);
    if (calendarDateKey(date) === todayKey) doneToday.add(workout.routineId);
    else if (date.getDay() === todayWeekday) {
      weekdayHabit.set(workout.routineId, (weekdayHabit.get(workout.routineId) ?? 0) + 1);
    }
  }

  // One candidate pool: standalone routines first, then plan routines in order,
  // deduped by id. Plan membership travels with each candidate for the result.
  type Candidate = { routine: WorkoutRoutine; plan?: WorkoutPlan; order: number };
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let order = 0;
  for (const routine of standaloneRoutines) {
    if (seen.has(routine.id)) continue;
    seen.add(routine.id);
    candidates.push({ routine, order: order++ });
  }
  for (const plan of plans) {
    for (const routine of plan.routines) {
      if (seen.has(routine.id)) continue;
      seen.add(routine.id);
      candidates.push({ routine, plan, order: order++ });
    }
  }

  // Days since last trained; a never-trained routine is the most due. A large
  // finite sentinel (not +Infinity) avoids NaN when two never-trained routines are
  // compared, so the tiebreaks still decide between them.
  const DAY = 86_400_000;
  const overdue = (id: string): number => {
    const last = lastTrained.get(id);
    return last === undefined ? Number.MAX_SAFE_INTEGER : (nowMs - last) / DAY;
  };

  // Exclude anything already done today, then pick the most overdue, breaking ties
  // by weekday habit, then by definition order (standalone-first, then plan order).
  const pool = candidates.filter((candidate) => !doneToday.has(candidate.routine.id));
  if (pool.length === 0) return null;
  pool.sort((a, b) =>
    overdue(b.routine.id) - overdue(a.routine.id)
    || (weekdayHabit.get(b.routine.id) ?? 0) - (weekdayHabit.get(a.routine.id) ?? 0)
    || a.order - b.order,
  );
  const best = pool[0];
  return { routine: best.routine, plan: best.plan };
}
