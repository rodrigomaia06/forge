export type WorkoutType = 'Strength' | 'Court sport' | 'Mobility' | 'Cardio' | string;

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
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string;
  type: WorkoutType;
  startedAt: number;
  completedAt: number | null;
  durationSeconds?: number;
  location?: string;
  mood?: string;
  note: string;
  averageRestSeconds?: number;
  exercises: WorkoutExercise[];
}

export interface WorkoutSetInput {
  id?: string;
  weight?: string;
  reps?: string;
  previous?: string;
  targetWeight?: string;
  targetReps?: string;
}

export interface WorkoutExerciseInput {
  id?: string;
  name: string;
  sets?: WorkoutSetInput[];
}
export interface StartWorkoutOptions {
  name?: string;
  type?: WorkoutType;
  exercises?: WorkoutExerciseInput[];
  location?: string;
  mood?: string;
  note?: string;
  averageRestSeconds?: number;
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
}
export interface WorkoutContextValue extends WorkoutState {
  ready: boolean;
  startWorkout: (options?: StartWorkoutOptions) => Workout;
  addExercise: (name: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, changes: WorkoutSetChanges) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  cancelWorkout: () => void;
  finishWorkout: () => Workout | null;
  deleteCompletedWorkout: (workoutId: string) => void;
  updateCompletedWorkout: (workoutId: string, update: (workout: Workout) => Workout) => void;
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
  location?: string;
  mood?: string;
  note?: string;
  averageRestSeconds?: number;
}
export type WorkoutMap = Record<number, WorkoutSummary[]>;
