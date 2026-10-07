import type { IconName } from './icons';

export type WorkoutType = 'Strength' | 'Court sport' | 'Mobility' | 'Cardio' | string;

export type ExerciseSetMetric = 'reps' | 'time' | 'timeRange' | 'distance';
/** A single body side, for unilateral (one-side-at-a-time) exercises. */
export type WorkoutSide = 'left' | 'right';
export type SetMeasurementKind = 'reps' | 'weight' | 'addedWeight' | 'duration' | 'distance' | 'rpe';
export interface SetMeasurement { id: string; kind: SetMeasurementKind; unit: 'count' | 'kg' | 'sec' | 'km' | 'rpe'; value: number; }
export interface SetTarget { id: string; kind: SetMeasurementKind; unit: SetMeasurement['unit']; minValue?: number; maxValue?: number; }

export interface WorkoutSet {
  id: string;
  weight: string;
  reps: string;
  previous?: string;
  targetWeight?: string;
  targetReps?: string;
  tag?: string;
  comment?: string;
  completed: boolean;
  /** Timestamp of the current completion transition. Legacy records omit it. */
  completedAt?: number;
  /**
   * Per-side completion for a unilateral exercise: the set is `completed` only
   * once both sides are done. Omitted for bilateral exercises and legacy rows.
   */
  sideCompletion?: { left: boolean; right: boolean };
  measurements?: SetMeasurement[];
  targets?: SetTarget[];
  /** A routine's rep/time/distance interval. It guides this workout only and is never a next-session target. */
  plannedTargets?: SetTarget[];
}

export interface WorkoutExercise {
  id: string;
  exerciseId?: string;
  name: string;
  note?: string;
  supersetId?: string;
  metric?: ExerciseSetMetric;
  exerciseSnapshot?: ExerciseSnapshot;
  trackingType?: TrackingType;
  trackingOverride?: TrackingType;
  /**
   * Marked as done outside the tracked session (the per-exercise counterpart of
   * a workout's off-plan flag). It stays in history for the record but is
   * excluded from every stat and from next/previous-session data — it counts for
   * nothing beyond being visible.
   */
  offSession?: boolean;
  sets: WorkoutSet[];
}
/** Editable fields that belong to an exercise rather than an individual set. */
export interface WorkoutExerciseChanges {
  note?: string;
  offSession?: boolean;
  trackingOverride?: TrackingType;
}
export type TrackingType =
  | 'weight-reps' | 'bodyweight-reps' | 'weighted-bodyweight' | 'assisted-bodyweight' | 'reps-only' | 'duration' | 'duration-weight' | 'distance-duration' | 'weight-distance'
  | 'distance'
  | 'weighted-bodyweight-duration'
  | 'assisted-bodyweight-duration';
export interface ExerciseVariationFacets {
  load?: string;
  /** Assistance method is meaningful only with the Assisted load mode. */
  assistance?: string;
  grip?: string;
  stance?: string;
  setup?: string;
  laterality?: string;
  /** Curated source detail that does not fit one of Forge's standard facets. */
  other?: string[];
}
export interface ExerciseSnapshot { id?: string; name: string; catalogueVersion?: number; trackingType: TrackingType; familyId?: string; group?: string; variation?: string; variationFacets?: ExerciseVariationFacets; equipment?: string[]; primaryEquipment?: string; workoutTypeIds?: string[]; category?: string; bodyRegion?: string; primaryMuscle?: string; secondaryMuscles?: string[]; aliases?: string[]; searchTerms?: string[]; movementPattern?: string; /** Base catalog laterality (`unilateral` | `bilateral` | `alternating`), captured so per-side completion survives future catalog releases. */ laterality?: string; /** Per-exercise rest preference captured with the workout for offline use. */ restSeconds?: number; }

export interface Workout {
  id: string;
  name: string;
  type: WorkoutType;
  startedAt: number;
  completedAt: number | null;
  durationSeconds?: number;
  /** Legacy workouts omit this and therefore continue tracking automatically. */
  automaticTimeTracking?: boolean;
  note: string;
  averageRestSeconds?: number;
  /** Number of completed-set rest intervals behind averageRestSeconds. Internal
   * accounting for a stable average; omitted safely by legacy records. */
  restTimerSamples?: number;
  exercises: WorkoutExercise[];
  /**
   * When true this whole session is ignored when deriving the next session's
   * "previous" values and targets — for a workout done off your usual gym or
   * gear that should not skew future targets.
   */
  excludeFromTargets?: boolean;
  routineId?: string;
  /** Immutable routine structure captured at start so finishing can offer a safe update. */
  routineStructureBaseline?: import('../domain/workouts/routineStructure').RoutineStructureBaseline;
  planId?: string;
  attributes?: Record<string, string>;
  /** Presentation chosen for a user-defined attribute. Existing records omit this safely. */
  attributeIcons?: Record<string, IconName>;
}

export interface WorkoutSetInput {
  id?: string;
  weight?: string;
  reps?: string;
  previous?: string;
  targetWeight?: string;
  targetReps?: string;
  targets?: SetTarget[];
  /** A routine's rep/time/distance interval, copied as a non-propagating hint when it starts. */
  plannedTargets?: SetTarget[];
  measurements?: SetMeasurement[];
  tag?: string;
  comment?: string;
}

export interface WorkoutExerciseInput {
  id?: string;
  exerciseId?: string;
  name: string;
  note?: string;
  supersetId?: string;
  metric?: ExerciseSetMetric;
  exerciseSnapshot?: ExerciseSnapshot;
  trackingType?: TrackingType;
  trackingOverride?: TrackingType;
  excludeFromTargets?: boolean;
  sets?: WorkoutSetInput[];
}
export interface WorkoutRoutine {
  id: string;
  name: string;
  type: WorkoutType;
  note?: string;
  attributes?: Record<string, string>;
  attributeIcons?: Record<string, IconName>;
  exercises: WorkoutExerciseInput[];
  planId?: string;
  createdAt: number;
  updatedAt: number;
}
export interface WorkoutPlan {
  id: string;
  name: string;
  /** Optional short free-text description shown on the plan card header. */
  description?: string;
  routines: WorkoutRoutine[];
  createdAt: number;
  updatedAt: number;
}
export interface PlansState {
  plans: WorkoutPlan[];
  standaloneRoutines: WorkoutRoutine[];
}
export interface PlansContextValue extends PlansState {
  loadError: boolean;
  ready: boolean;
  reload: () => Promise<void>;
  createPlan: (name?: string) => WorkoutPlan;
  updatePlan: (planId: string, update: (plan: WorkoutPlan) => WorkoutPlan) => void;
  reorderPlans: (plans: WorkoutPlan[]) => void;
  /**
   * Applies a full reordering/regrouping of plans and standalone routines at
   * once — plans in the given order (each carrying the routine ids listed for
   * it), and standalone routines in the given order. Routine objects are kept
   * by id; only order and plan membership change. A no-op if the id set differs.
   */
  reorderAll: (plans: { id: string; routineIds: string[] }[], standaloneRoutineIds: string[]) => void;
  deletePlan: (planId: string) => void;
  createRoutine: (options?: Partial<WorkoutRoutine>) => WorkoutRoutine;
  updateRoutine: (routineId: string, update: (routine: WorkoutRoutine) => WorkoutRoutine) => void;
  reorderRoutines: (routines: WorkoutRoutine[], planId?: string) => void;
  deleteRoutine: (routineId: string) => void;
  duplicateRoutine: (routineId: string) => WorkoutRoutine | null;
  moveRoutine: (routineId: string, planId?: string, targetIndex?: number) => void;
  findRoutine: (routineId: string) => WorkoutRoutine | undefined;
}
export interface StartWorkoutOptions {
  /** Original template before history-derived next-session hints are applied. */
  routineTemplate?: WorkoutRoutine;
  name?: string;
  type?: WorkoutType;
  exercises?: WorkoutExerciseInput[];
  note?: string;
  averageRestSeconds?: number;
  routineId?: string;
  planId?: string;
  attributes?: Record<string, string>;
  attributeIcons?: Record<string, IconName>;
}
export interface WorkoutState {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
}
export interface WorkoutSetChanges {
  weight?: string;
  reps?: string;
  completed?: boolean;
  completedAt?: number;
  sideCompletion?: { left: boolean; right: boolean };
  targetWeight?: string;
  targetReps?: string;
  tag?: string;
  comment?: string;
  measurements?: SetMeasurement[];
  targets?: SetTarget[];
  plannedTargets?: SetTarget[];
}
export interface WorkoutContextValue extends Omit<WorkoutState, 'activeWorkout'> {
  loadError: boolean;
  ready: boolean;
  /** Identity/start-time scalars for consumers that only need presence, kept out
   * of the live activeWorkout object so they do not re-render on every keystroke. */
  activeWorkoutId: string | null;
  activeWorkoutStartedAt: number | null;
  /** Total sets in the active workout, as a scalar — lets consumers gate on an
   * empty session without subscribing to the live workout object. */
  activeWorkoutSetCount: number;
  reload: () => Promise<void>;
  startWorkout: (options?: StartWorkoutOptions) => Workout;
  addExercise: (exercise: WorkoutExerciseInput | string) => void;
  addExercises: (exercises: readonly WorkoutExerciseInput[]) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise: (exerciseId: string, changes: WorkoutExerciseChanges) => void;
  addWarmupSets: (exerciseId: string, sets: readonly { weight: string; reps: string }[]) => void;
  updateSet: (exerciseId: string, setId: string, changes: WorkoutSetChanges) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  updateActiveWorkout: (update: (workout: Workout) => Workout) => void;
  changeTracking: (blockId: string, mode: TrackingType, confirmed?: boolean) => Promise<import('../domain/exercises/trackingChanges').TrackingChangeResult>;
  cancelWorkout: () => void;
  finishWorkout: (choice: FinishRoutineChoice) => Promise<Workout | null>;
  createCompletedWorkout: (workout: Workout) => Promise<void>;
  deleteCompletedWorkout: (workoutId: string) => void;
  updateCompletedWorkout: (workoutId: string, update: (workout: Workout) => Workout) => Promise<void>;
}
export interface WorkoutSummary {
  name: string;
  type: WorkoutType;
  duration?: string;
  summary?: string;
  exercises?: WorkoutExercise[];
  durationSeconds?: number;
  startedAt?: number;
  completedAt?: number | null;
  id?: string;
  note?: string;
  averageRestSeconds?: number;
}
export type WorkoutMap = Record<string, WorkoutSummary[]>;

export type FinishRoutineChoice =
  { kind: 'keep' } | { kind: 'update' } | { kind: 'new'; name: string; };
