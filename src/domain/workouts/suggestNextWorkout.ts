import { calendarDateKey } from './calendarDate';
import type { Workout, WorkoutPlan, WorkoutRoutine } from '../../types';

/** One signal that moved a routine's priority, strongest contribution first. */
export interface SuggestionReason {
  kind:
    | 'overdue'
    | 'never-trained'
    | 'new-routine'
    | 'weekday-habit'
    | 'time-habit'
    | 'active-plan'
    | 'muscles-recovering'
    | 'dormant'
    | 'inactive-plan'
    | 'back-to-back';
  /** Signed contribution to the priority score. */
  points: number;
}

export interface WorkoutSuggestion {
  routine: WorkoutRoutine;
  plan?: WorkoutPlan;
  /** Why this routine won, strongest signal first (not shown in the card). */
  reasons?: SuggestionReason[];
}

export interface SuggestNextWorkoutInput {
  completedWorkouts: readonly Workout[];
  plans: readonly WorkoutPlan[];
  standaloneRoutines: readonly WorkoutRoutine[];
  now?: Date;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * Weights for each priority signal. Being due is the backbone; habits, plan
 * activity and recovery reorder routines that are similarly due; staleness and
 * fatigue push routines down without ever excluding them.
 */
const WEIGHT = {
  /** Per unit of "how due" (days since / usual cadence), capped at 2×. */
  due: 40,
  dueCap: 2,
  neverTrained: 60,
  /** A never-trained routine the user has consistently passed over. */
  ignoredNeverTrained: 10,
  newRoutine: 15,
  /** Per same-weekday session in the recent window, capped at 3. */
  weekday: 6,
  weekdayCap: 3,
  timeOfDay: 6,
  activePlan: 10,
  /** Full overlap with muscles trained in the last day. */
  recovery: 35,
  /** A long-untrained routine scores as if only this due. */
  dormantDue: 0.25,
  inactivePlan: 25,
  backToBack: 15,
} as const;

function completedAt(workout: Workout): number {
  return workout.completedAt ?? workout.startedAt;
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function routineMuscles(routine: WorkoutRoutine): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (muscle: string | undefined, weight: number) => {
    if (!muscle) return;
    const key = normalizedName(muscle);
    weights.set(key, Math.max(weights.get(key) ?? 0, weight));
  };
  for (const exercise of routine.exercises) {
    add(exercise.exerciseSnapshot?.primaryMuscle, 1);
    for (const muscle of exercise.exerciseSnapshot?.secondaryMuscles ?? []) add(muscle, 0.5);
  }
  return weights;
}

/**
 * Suggests the routine to start next with a priority score built from the
 * user's own history. Every routine — standalone first, then plan routines in
 * order — competes in one pool, and these signals add or remove priority:
 *
 * - **Due:** days since it was last trained relative to its usual cadence (its
 *   own median gap, or its plan's rotation length at the user's training pace).
 * - **Never trained:** treated as highly due, unless many sessions have passed
 *   since it was created without it ever being chosen; a freshly created one
 *   gets an extra nudge.
 * - **Habits:** sessions on this weekday and around this time of day.
 * - **Active plan:** routines in a plan trained recently rank above plans that
 *   have gone quiet while the user kept training elsewhere.
 * - **Recovery:** muscles worked in the last two days lower routines that load
 *   them again.
 * - **Dormant / back-to-back:** a routine untrained far beyond its cadence, or
 *   the one just done last, drops back.
 *
 * Sessions link to routines by `routineId`, or by matching name for imported
 * history. A routine already completed today is excluded, so the suggestion is
 * always what comes next. Ties fall back to definition order; with no history
 * this cold-starts on the first routine. Returns null only when nothing is left
 * to suggest today.
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
  if (!candidates.length) return null;

  // Link sessions to routines: by id, else by name (imported history keeps the
  // routine name, or `Plan - Routine`, but no id).
  const byId = new Map(candidates.map((candidate) => [candidate.routine.id, candidate]));
  const byName = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const names = [candidate.routine.name, candidate.plan ? `${candidate.plan.name} - ${candidate.routine.name}` : ''];
    for (const name of names) if (name && !byName.has(normalizedName(name))) byName.set(normalizedName(name), candidate);
  }
  const sessions = completedWorkouts
    .filter((workout) => workout.completedAt !== null && completedAt(workout) <= nowMs)
    .sort((a, b) => completedAt(a) - completedAt(b));
  const linked = new Map<string, number[]>();
  const lastByPlan = new Map<string, number>();
  let lastSessionRoutineId: string | undefined;
  const doneToday = new Set<string>();
  for (const workout of sessions) {
    const candidate = (workout.routineId ? byId.get(workout.routineId) : undefined)
      ?? (workout.routineId ? undefined : byName.get(normalizedName(workout.name)));
    const time = completedAt(workout);
    lastSessionRoutineId = candidate?.routine.id;
    if (!candidate) continue;
    const id = candidate.routine.id;
    linked.set(id, [...(linked.get(id) ?? []), time]);
    if (candidate.plan) lastByPlan.set(candidate.plan.id, Math.max(lastByPlan.get(candidate.plan.id) ?? 0, time));
    if (calendarDateKey(new Date(time)) === todayKey) doneToday.add(id);
  }

  // Training pace: average days between any sessions in the last four weeks,
  // kept within a sensible 1–7 day band (2 days with no recent history).
  const recent = sessions.filter((workout) => nowMs - completedAt(workout) <= 28 * DAY);
  const paceDays = recent.length >= 2
    ? Math.min(7, Math.max(1, (completedAt(recent[recent.length - 1]) - completedAt(recent[0])) / DAY / (recent.length - 1)))
    : recent.length === 1 ? 7 : 2;
  const recentStandalone = new Set(
    candidates
      .filter((candidate) => !candidate.plan && (linked.get(candidate.routine.id) ?? []).some((time) => nowMs - time <= 28 * DAY))
      .map((candidate) => candidate.routine.id),
  );

  // Muscle fatigue from the last two days of completed work.
  const fatigue = new Map<string, number>();
  for (const workout of sessions) {
    const age = nowMs - completedAt(workout);
    if (age > 48 * HOUR) continue;
    const decay = age <= 24 * HOUR ? 1 : 0.5;
    for (const exercise of workout.exercises) {
      if (!exercise.sets.some((set) => set.completed)) continue;
      const touch = (muscle: string | undefined, weight: number) => {
        if (!muscle) return;
        const key = normalizedName(muscle);
        fatigue.set(key, Math.max(fatigue.get(key) ?? 0, weight * decay));
      };
      touch(exercise.exerciseSnapshot?.primaryMuscle, 1);
      for (const muscle of exercise.exerciseSnapshot?.secondaryMuscles ?? []) touch(muscle, 0.5);
    }
  }

  const lastAnySession = sessions.length ? completedAt(sessions[sessions.length - 1]) : undefined;

  const score = (candidate: Candidate): { total: number; reasons: SuggestionReason[] } => {
    const { routine, plan } = candidate;
    const reasons: SuggestionReason[] = [];
    const add = (kind: SuggestionReason['kind'], points: number) => {
      if (points !== 0) reasons.push({ kind, points });
    };
    const times = linked.get(routine.id) ?? [];
    const last = times[times.length - 1];

    if (last === undefined) {
      const created = Math.max(routine.createdAt, plan?.createdAt ?? 0);
      const passedOver = sessions.filter((workout) => completedAt(workout) > created).length >= 6;
      add('never-trained', passedOver ? WEIGHT.ignoredNeverTrained : WEIGHT.neverTrained);
      if (nowMs - Math.max(routine.createdAt, routine.updatedAt) <= 7 * DAY) add('new-routine', WEIGHT.newRoutine);
    } else {
      const gaps = times.slice(1).map((time, index) => (time - times[index]) / DAY);
      const groupSize = plan ? plan.routines.length : Math.max(1, recentStandalone.size);
      const cadence = Math.max(1, gaps.length >= 2 ? median(gaps) : groupSize * paceDays);
      const daysSince = (nowMs - last) / DAY;
      const dormant = daysSince > Math.max(3 * cadence, 28) && lastAnySession !== undefined && lastAnySession > last;
      if (dormant) add('dormant', WEIGHT.due * WEIGHT.dormantDue);
      else add('overdue', WEIGHT.due * Math.min(WEIGHT.dueCap, daysSince / cadence));

      const windowStart = nowMs - 56 * DAY;
      const sameWeekday = times.filter((time) => time >= windowStart && new Date(time).getDay() === todayWeekday
        && calendarDateKey(new Date(time)) !== todayKey).length;
      add('weekday-habit', WEIGHT.weekday * Math.min(WEIGHT.weekdayCap, sameWeekday));

      if (times.length >= 2) {
        const hour = now.getHours() + now.getMinutes() / 60;
        const near = times.filter((time) => {
          const date = new Date(time);
          const diff = Math.abs(date.getHours() + date.getMinutes() / 60 - hour);
          return Math.min(diff, 24 - diff) <= 2;
        }).length;
        if (near / times.length >= 0.6) add('time-habit', WEIGHT.timeOfDay);
      }
      // Avoid repeating the very last session only while it is recent.
      if (routine.id === lastSessionRoutineId && daysSince <= 2) add('back-to-back', -WEIGHT.backToBack);
    }

    if (plan) {
      const planLast = lastByPlan.get(plan.id);
      if (planLast !== undefined && nowMs - planLast <= 14 * DAY) add('active-plan', WEIGHT.activePlan);
      else if (planLast !== undefined && lastAnySession !== undefined && lastAnySession > planLast && nowMs - planLast > 28 * DAY) {
        add('inactive-plan', -WEIGHT.inactivePlan);
      }
    }

    const muscles = routineMuscles(routine);
    if (muscles.size && fatigue.size) {
      let load = 0;
      let total = 0;
      for (const [muscle, weight] of muscles) {
        total += weight;
        load += weight * (fatigue.get(muscle) ?? 0);
      }
      add('muscles-recovering', -Math.round(WEIGHT.recovery * (load / total) * 10) / 10);
    }

    reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
    return { total: reasons.reduce((sum, reason) => sum + reason.points, 0), reasons };
  };

  const pool = candidates
    .filter((candidate) => !doneToday.has(candidate.routine.id))
    .map((candidate) => ({ candidate, ...score(candidate) }));
  if (!pool.length) return null;
  // Scores within a hair are a tie; definition order then decides.
  pool.sort((a, b) => (Math.abs(b.total - a.total) > 0.01 ? b.total - a.total : a.candidate.order - b.candidate.order));
  const best = pool[0];
  return { routine: best.candidate.routine, plan: best.candidate.plan, reasons: best.reasons };
}
