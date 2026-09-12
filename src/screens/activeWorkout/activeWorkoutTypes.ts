import type { GestureResponderEvent } from 'react-native';
import type { ReactNode } from 'react';
import type { WorkoutExercise, WorkoutExerciseChanges, WorkoutSet, WorkoutSetChanges } from '../../types';

export type SetInputFrame = { y: number; height: number };
export type MeasureSetInput = (callback: (frame: SetInputFrame) => void) => void;

export interface ExerciseSectionProps {
  exercise: WorkoutExercise;
  index: number;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise?: (exerciseId: string, changes: WorkoutExerciseChanges) => void;
  /** Active Workout alone can turn a calculated ramp into editable warm-up sets. */
  addWarmupSets?: (exerciseId: string, sets: readonly { weight: string; reps: string }[]) => void;
  updateSet: (exerciseId: string, setId: string, changes: WorkoutSetChanges) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  onSetCompleted: (duration?: number) => void;
  deleteRevealed: boolean;
  onDeleteRevealChange: (exerciseId: string, revealed: boolean) => void;
  size?: 'standard' | 'large';
  dragHandle?: ReactNode;
  testID?: string;
  /** Routine editor uses the same set editor under a compact expandable header. */
  collapsible?: boolean;
  /** A parent reorder gesture collapses compact exercise cards before movement begins. */
  forceCollapsed?: boolean;
  showMoreOptions?: boolean;
  /** Live Workout presents saved catalogue variation and primary equipment beneath the canonical name. */
  showCatalogMetadata?: boolean;
  /** Routine drafts do not record completed sets. */
  showSetCompletion?: boolean;
  showWarmupSets?: boolean;
  /** Lets an owning editor keep a focused set input clear of its keyboard. */
  onSetInputFocus?: (measure: MeasureSetInput) => void;
}

export interface SwipeableSetRowProps {
  set: WorkoutSet;
  index: number;
  onChange: (changes: WorkoutSetChanges) => void;
  onToggle: () => void;
  onDelete: () => void;
  deleteRevealed: boolean;
  onDeleteRevealChange: (revealed: boolean) => void;
  showCompletion?: boolean;
  onInputFocus?: (measure: MeasureSetInput) => void;
  trackingType?: import('../../types').TrackingType;
}

export interface SetRowProps extends Omit<
  SwipeableSetRowProps,
  'deleteRevealed' | 'onDeleteRevealChange'
> {
  onOpenDetails: () => void;
  onInputTouchStart: (event: GestureResponderEvent) => void;
  onInputTouchMove: (event: GestureResponderEvent) => void;
  onInputTouchEnd: () => void;
  onInputFocus?: (measure: MeasureSetInput) => void;
}

export interface RestTimerSheetProps {
  visible: boolean;
  selectedDuration: number;
  remaining: number;
  duration: number;
  running: boolean;
  onClose: () => void;
  onSelect: (duration: number) => void;
  onStart: () => void;
  onAdjust: (amount: number) => void;
  onStop: () => void;
}
