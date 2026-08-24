import type { ReactNode } from 'react';
import type { NavigationProp } from '@react-navigation/native';

export type WorkoutType = 'Strength' | 'Court sport' | 'Mobility' | 'Cardio' | string;

export interface WorkoutSet {
  id: string;
  weight: string;
  reps: string;
  previous?: string;
  targetWeight?: string;
  targetReps?: string;
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
}

export interface WorkoutState {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
}

export interface WorkoutSetChanges {
  weight?: string;
  reps?: string;
  completed?: boolean;
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
  finishWorkout: () => Workout | null;
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
}

export type WorkoutMap = Record<number, WorkoutSummary[]>;

export interface ForgeTheme {
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  slate: string;
  muted: string;
  divider: string;
  accent?: string;
  inkInteractive?: string;
  success?: string;
  calendarSurface?: string;
  calendarDay?: string;
  selected?: string;
  selectedText?: string;
  marker?: string;
  navigation?: string;
  dockSurface?: string;
  dockSelected?: string;
  dockBorder?: string;
  dockForeground?: string;
  dockMuted?: string;
  cardRadius?: number;
  topBar?: boolean;
  headerVariant?: 'greeting' | 'archive' | 'month';
  startButtonVariant?: string;
  iconCalendar?: string;
  iconStrength?: string;
  iconSport?: string;
  iconActivity?: string;
  iconTime?: string;
}

export interface ChildrenProps {
  children?: ReactNode;
}

export type RootStackParamList = {
  Dashboard: { selectedDay?: number } | undefined;
  ActiveWorkout: undefined;
  History: undefined;
  Plans: undefined;
  More: undefined;
};

export type RootNavigationProp = NavigationProp<RootStackParamList>;

export type IconName =
  | 'add'
  | 'chevron-back'
  | 'chevron-forward'
  | 'chevron-down'
  | 'calendar'
  | 'calendar-outline'
  | 'calendar-clear-outline'
  | 'home'
  | 'home-outline'
  | 'layers'
  | 'layers-outline'
  | 'book'
  | 'play'
  | 'time'
  | 'time-outline'
  | 'ellipsis-horizontal'
  | 'menu'
  | 'fitness'
  | 'fitness-outline'
  | 'basketball'
  | 'activity'
  | 'running'
  | 'stretching'
  | 'tennis-ball'
  | 'stopwatch'
  | 'stopwatch-outline'
  | 'trash'
  | 'check';
export type IconWeight = 'thin' | 'regular' | 'bold' | 'fill';
