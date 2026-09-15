import type { IconName } from './icons';

export type WorkoutType = 'Strength' | 'Court sport' | 'Mobility' | 'Cardio' | string;

export type ExerciseSetMetric = 'reps' | 'time' | 'timeRange' | 'distance';
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
  sets: WorkoutSet[];
}
/** Editable fields that belong to an exercise rather than an individual set. */
export interface WorkoutExerciseChanges {
  note?: string;
}
export type TrackingType = 'weight-reps' | 'bodyweight-reps' | 'weighted-bodyweight' | 'assisted-bodyweight' | 'reps-only' | 'duration' | 'duration-weight' | 'distance-duration' | 'weight-distance';
export interface ExerciseVariationFacets {
  load?: string;
  grip?: string;
  stance?: string;
  setup?: string;
  laterality?: string;
  /** Curated source detail that does not fit one of Forge's standard facets. */
  other?: string[];
}
export interface ExerciseSnapshot { id?: string; name: string; catalogueVersion?: number; trackingType: TrackingType; familyId?: string; group?: string; variation?: string; variationFacets?: ExerciseVariationFacets; equipment?: string[]; primaryEquipment?: string; workoutTypeIds?: string[]; category?: string; bodyRegion?: string; primaryMuscle?: string; secondaryMuscles?: string[]; aliases?: string[]; searchTerms?: string[]; movementPattern?: string; /** Per-exercise rest preference captured with the workout for offline use. */ restSeconds?: number; }

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
  routines: WorkoutRoutine[];
  createdAt: number;
  updatedAt: number;
}
export interface PlansState {
  plans: WorkoutPlan[];
  standaloneRoutines: WorkoutRoutine[];
}
export interface PlansContextValue extends PlansState {
  ready: boolean;
  reload: () => Promise<void>;
  createPlan: (name?: string) => WorkoutPlan;
  updatePlan: (planId: string, update: (plan: WorkoutPlan) => WorkoutPlan) => void;
  reorderPlans: (plans: WorkoutPlan[]) => void;
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
  targetWeight?: string;
  targetReps?: string;
  tag?: string;
  comment?: string;
  measurements?: SetMeasurement[];
  targets?: SetTarget[];
  plannedTargets?: SetTarget[];
}
export interface WorkoutContextValue extends WorkoutState {
  ready: boolean;
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
  cancelWorkout: () => void;
  finishWorkout: () => Workout | null;
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
