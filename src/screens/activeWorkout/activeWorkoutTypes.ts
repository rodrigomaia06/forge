import type { GestureResponderEvent } from 'react-native';
import type { ReactNode } from 'react';
import type { WorkoutExercise, WorkoutSet, WorkoutSetChanges } from '../../types';

export interface ExerciseSectionProps {
  exercise: WorkoutExercise;
  index: number;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
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
  showMoreOptions?: boolean;
}

export interface SwipeableSetRowProps {
  set: WorkoutSet;
  index: number;
  onChange: (changes: WorkoutSetChanges) => void;
  onToggle: () => void;
  onDelete: () => void;
  deleteRevealed: boolean;
  onDeleteRevealChange: (revealed: boolean) => void;
}

export interface SetRowProps extends Omit<
  SwipeableSetRowProps,
  'deleteRevealed' | 'onDeleteRevealChange'
> {
  onOpenDetails: () => void;
  onInputTouchStart: (event: GestureResponderEvent) => void;
  onInputTouchMove: (event: GestureResponderEvent) => void;
  onInputTouchEnd: () => void;
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
  onSkip: () => void;
}
