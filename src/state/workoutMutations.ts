import type {
  StartWorkoutOptions,
  Workout,
  WorkoutExerciseChanges,
  WorkoutExerciseInput,
  WorkoutSetChanges,
} from '../types';
import { routineStructureBaseline } from '../domain/workouts/routineStructure';

export function makeWorkoutId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createWorkout(options: StartWorkoutOptions): Workout {
  const isRoutineStart = Boolean(options.routineId);
  return {
    id: makeWorkoutId('workout'),
    name: options.name || 'Workout',
    type: options.type || 'Strength',
    startedAt: Date.now(),
    completedAt: null,
    note: options.note || '',
    averageRestSeconds: options.averageRestSeconds,
    routineId: options.routineId,
    routineStructureBaseline: isRoutineStart ? routineStructureBaseline(options.exercises ?? []) : undefined,
    planId: options.planId,
    attributes: options.attributes,
    attributeIcons: options.attributeIcons,
    exercises: (options.exercises || []).map((exercise) => ({
      id: exercise.id || makeWorkoutId('exercise'),
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      note: exercise.note,
      supersetId: exercise.supersetId,
      // The snapshot is the routine's durable exercise contract. Older
      // routines can have a snapshot while omitting the legacy top-level
      // field, so prefer it when materialising a live workout.
      trackingType: exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps',
      exerciseSnapshot: exercise.exerciseSnapshot,
      sets: (exercise.sets || []).map((set) => ({
        id: set.id || makeWorkoutId('set'),
        weight: set.weight || '',
        reps: set.reps || '',
        previous: set.previous,
        tag: set.tag,
        comment: set.comment,
        measurements: set.measurements,
        // A routine can guide the current session with a planned interval,
        // but it must never manufacture a next-session target. Those are a
        // deliberate user choice in the prior completed workout.
        plannedTargets: set.plannedTargets,
        ...(!isRoutineStart ? {
          targetWeight: set.targetWeight,
          targetReps: set.targetReps,
          targets: set.targets,
        } : {}),
        completed: false,
      })),
    })),
  };
}

/**
 * Average rest that reflects the real story of a session. Only the gaps between
 * consecutive completed sets *within the same exercise* count as rest: the jump
 * from one exercise to the next is a transition (walking to a machine, setup),
 * not rest, so folding it in used to inflate the figure. A single long
 * interruption (a phone call, a chat) is trimmed via a median-relative ceiling
 * so it cannot distort the average either. Older workouts did not retain
 * per-set timestamps, so with none their existing average is left untouched.
 */
export function recordRestTimerSample(workout: Workout, _durationSeconds: number): Workout {
  const intervals: number[] = [];
  for (const exercise of workout.exercises) {
    const completionTimes = exercise.sets
      .filter((set) => set.completed && typeof set.completedAt === 'number')
      .map((set) => set.completedAt as number)
      .sort((left, right) => left - right);
    for (let index = 1; index < completionTimes.length; index += 1) {
      intervals.push(Math.max(0, Math.round((completionTimes[index] - completionTimes[index - 1]) / 1000)));
    }
  }
  if (!intervals.length) return { ...workout, averageRestSeconds: undefined, restTimerSamples: 0 };
  const sorted = [...intervals].sort((left, right) => left - right);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  // Keep gaps up to 2.5x the median (with a floor so a set of short, tightly
  // spaced rests is never entirely trimmed); drop longer ones as interruptions.
  const ceiling = Math.max(20, median * 2.5);
  const kept = intervals.filter((interval) => interval <= ceiling);
  const used = kept.length ? kept : intervals;
  const total = used.reduce((sum, interval) => sum + interval, 0);
  return {
    ...workout,
    averageRestSeconds: Math.round(total / used.length),
    restTimerSamples: used.length,
  };
}

export function addExerciseToWorkout(workout: Workout | null, input: WorkoutExerciseInput | string): Workout | null {
  return addExercisesToWorkout(workout, [input]);
}

/** Adds picker selections in one workout update so multi-select does not cascade renders. */
export function addExercisesToWorkout(
  workout: Workout | null,
  inputs: readonly (WorkoutExerciseInput | string)[],
): Workout | null {
  if (!workout) return workout;
  const exercises = inputs
    .map((input) => (typeof input === 'string' ? { name: input } : input))
    .filter((exercise) => exercise.name.trim())
    .map((exercise) => ({
      id: makeWorkoutId('exercise'),
      exerciseId: exercise.exerciseId,
      name: exercise.name.trim(),
      trackingType: exercise.trackingType ?? 'weight-reps',
      exerciseSnapshot: exercise.exerciseSnapshot,
      sets: Array.from({ length: 3 }, () => ({
        id: makeWorkoutId('set'),
        weight: '',
        reps: '',
        completed: false,
      })),
    }));
  if (!exercises.length) return workout;
  return {
    ...workout,
    exercises: [...workout.exercises, ...exercises],
  };
}

export function addSetToWorkout(workout: Workout | null, exerciseId: string): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: [
              ...exercise.sets,
              { id: makeWorkoutId('set'), weight: '', reps: '', completed: false },
            ],
          }
        : exercise,
    ),
  };
}

export function removeSetFromWorkout(
  workout: Workout | null,
  exerciseId: string,
  setId: string,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises
      .map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      )
      .filter((exercise) => exercise.sets.length > 0),
  };
}

export function removeExerciseFromWorkout(
  workout: Workout | null,
  exerciseId: string,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId),
  };
}

export function updateWorkoutExercise(
  workout: Workout | null,
  exerciseId: string,
  changes: WorkoutExerciseChanges,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, ...changes } : exercise,
    ),
  };
}

/** Inserts computed warm-up work before the working sets without replacing any recorded work. */
export function addWarmupSetsToWorkout(
  workout: Workout | null,
  exerciseId: string,
  sets: readonly { weight: string; reps: string }[],
): Workout | null {
  if (!workout || !sets.length) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      const warmups = sets.map((set) => ({
        id: makeWorkoutId('set'),
        weight: set.weight,
        reps: set.reps,
        tag: 'Warm Up',
        completed: false,
      }));
      const firstWorkingSet = exercise.sets.findIndex((set) => set.tag !== 'Warm Up');
      const insertAt = firstWorkingSet === -1 ? exercise.sets.length : firstWorkingSet;
      return {
        ...exercise,
        sets: [
          ...exercise.sets.slice(0, insertAt),
          ...warmups,
          ...exercise.sets.slice(insertAt),
        ],
      };
    }),
  };
}

export function updateWorkoutSet(
  workout: Workout | null,
  exerciseId: string,
  setId: string,
  changes: WorkoutSetChanges,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...changes } : set)),
          }
        : exercise,
    ),
  };
}

export function toggleWorkoutSet(
  workout: Workout | null,
  exerciseId: string,
  setId: string,
): Workout | null {
  if (!workout) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.id === setId
                ? { ...set, completed: !set.completed, completedAt: set.completed ? undefined : Date.now() }
                : set,
            ),
          }
        : exercise,
    ),
  };
}
