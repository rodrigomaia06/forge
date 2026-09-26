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
 * It reasons from *recency*, not a fixed index, so it stays correct even when
 * sessions are skipped or repeated out of order:
 *
 *   1. Active plan — inside the plan you most recently trained, pick the routine
 *      that is least-recently trained (or never), i.e. the one that is due.
 *   2. Weekday habit — the routine you most often do on this weekday.
 *   3. Least-recently trained — across every routine you have history for.
 *   4. Recent repeat, then a cold start on the first available routine.
 *
 * A routine already completed today is pushed to the back so the suggestion is
 * always the *next* thing to do, never what was just finished.
 */
export function suggestNextWorkout({
  completedWorkouts,
  plans,
  standaloneRoutines,
  now = new Date(),
}: SuggestNextWorkoutInput): WorkoutSuggestion | null {
  const resolve = (routineId: string | undefined): WorkoutSuggestion | null => {
    if (!routineId) return null;
    const standalone = standaloneRoutines.find((routine) => routine.id === routineId);
    if (standalone) return { routine: standalone };
    for (const plan of plans) {
      const routine = plan.routines.find((item) => item.id === routineId);
      if (routine) return { routine, plan };
    }
    return null;
  };

  const history = [...completedWorkouts]
    .filter((workout) => workout.completedAt !== null)
    .sort((left, right) => completedAt(right) - completedAt(left));

  // When and how recently each routine was last trained, and which were trained
  // today (so we never re-suggest a session that is already done).
  const todayKey = calendarDateKey(now);
  const lastTrained = new Map<string, number>();
  const doneToday = new Set<string>();
  for (const workout of completedWorkouts) {
    if (!workout.routineId) continue;
    const time = completedAt(workout);
    const previous = lastTrained.get(workout.routineId);
    if (previous === undefined || time > previous) lastTrained.set(workout.routineId, time);
    if (calendarDateKey(new Date(time)) === todayKey) doneToday.add(workout.routineId);
  }
  // Lower is more "due": never-trained (-Infinity) beats old beats recent, and a
  // routine done today is sent to the very back.
  const dueScore = (routineId: string): number =>
    doneToday.has(routineId) ? Number.POSITIVE_INFINITY : (lastTrained.get(routineId) ?? Number.NEGATIVE_INFINITY);

  // 1. Active plan — the plan of the most recent plan-based session. Rotate to
  // the routine in it that is least recently trained (ties keep plan order).
  const activePlanWorkout = history.find(
    (workout) => workout.planId && plans.some((plan) => plan.id === workout.planId && plan.routines.length > 0),
  );
  if (activePlanWorkout) {
    const plan = plans.find((item) => item.id === activePlanWorkout.planId);
    if (plan) {
      let best: WorkoutRoutine | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      plan.routines.forEach((routine) => {
        const score = dueScore(routine.id);
        if (best === null || score < bestScore) {
          best = routine;
          bestScore = score;
        }
      });
      // Only skip the plan entirely when every routine in it was trained today.
      if (best && bestScore !== Number.POSITIVE_INFINITY) return { routine: best, plan };
    }
  }

  // 2. Weekday habit — most frequent routine on today's weekday, not done today.
  const todayWeekday = now.getDay();
  const weekdayCounts = new Map<string, number>();
  for (const workout of history) {
    if (!workout.routineId || doneToday.has(workout.routineId)) continue;
    const date = new Date(completedAt(workout));
    if (date.getDay() !== todayWeekday || calendarDateKey(date) === todayKey) continue;
    weekdayCounts.set(workout.routineId, (weekdayCounts.get(workout.routineId) ?? 0) + 1);
  }
  let habitRoutineId: string | undefined;
  let habitCount = 0;
  for (const [routineId, count] of weekdayCounts) {
    if (count > habitCount) {
      habitCount = count;
      habitRoutineId = routineId;
    }
  }
  const weekdaySuggestion = resolve(habitRoutineId);
  if (weekdaySuggestion) return weekdaySuggestion;

  // 3. Least-recently trained across everything with history (not done today).
  const candidates = [...lastTrained.keys()]
    .filter((routineId) => !doneToday.has(routineId))
    .sort((left, right) => (lastTrained.get(left) ?? 0) - (lastTrained.get(right) ?? 0));
  for (const routineId of candidates) {
    const suggestion = resolve(routineId);
    if (suggestion) return suggestion;
  }

  // 4. Recent repeat, then a cold start (new user with routines but no history).
  for (const workout of history) {
    const suggestion = resolve(workout.routineId);
    if (suggestion) return suggestion;
  }
  const firstPlan = plans.find((plan) => plan.routines.length > 0);
  if (firstPlan) return { routine: firstPlan.routines[0], plan: firstPlan };
  if (standaloneRoutines.length > 0) return { routine: standaloneRoutines[0] };
  return null;
}
