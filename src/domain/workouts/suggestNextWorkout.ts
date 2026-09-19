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
 * First matching strategy wins; returns null when there is nothing to lean on
 * (no routines, or no completed sessions tied to an existing routine).
 *
 *   1. Plan rotation — continue the plan you last trained, one routine forward.
 *   2. Weekday habit — the routine you most often do on this weekday.
 *   3. Recent repeat — the routine behind your most recent session.
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

  // 1. Plan rotation.
  for (const workout of history) {
    if (!workout.planId) continue;
    const plan = plans.find((item) => item.id === workout.planId);
    if (!plan || plan.routines.length < 2) continue;
    const lastIndex = plan.routines.findIndex((routine) => routine.id === workout.routineId);
    const nextIndex = lastIndex < 0 ? 0 : (lastIndex + 1) % plan.routines.length;
    return { routine: plan.routines[nextIndex], plan };
  }

  // 2. Weekday habit — most frequent routine done on today's weekday, excluding
  // one already trained today so we always point at the next thing to do.
  const todayWeekday = now.getDay();
  const todayKey = calendarDateKey(now);
  const weekdayCounts = new Map<string, number>();
  for (const workout of history) {
    if (!workout.routineId) continue;
    const date = new Date(completedAt(workout));
    if (date.getDay() !== todayWeekday) continue;
    if (calendarDateKey(date) === todayKey) continue;
    weekdayCounts.set(workout.routineId, (weekdayCounts.get(workout.routineId) ?? 0) + 1);
  }
  let bestRoutineId: string | undefined;
  let bestCount = 0;
  for (const [routineId, count] of weekdayCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestRoutineId = routineId;
    }
  }
  const weekdaySuggestion = resolve(bestRoutineId);
  if (weekdaySuggestion) return weekdaySuggestion;

  // 3. Recent repeat — the most recent session tied to a routine that still exists.
  for (const workout of history) {
    const suggestion = resolve(workout.routineId);
    if (suggestion) return suggestion;
  }

  return null;
}
