import React, { useEffect, useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ForgeConfirmationDialog, useAfterSheetClose } from '../../components/ui';
import { useWorkouts } from '../../state/WorkoutContext';
import { effectiveTracking, trackingFields } from '../../domain/exercises/tracking';
import { exerciseCatalogById } from '../../data/exerciseCatalog';
import { useForgeReducedMotion } from '../../theme/motion';
import { runWhenIdle } from '../../utils/idle';
import type { RootNavigationProp } from '../../types';
import type { ExerciseSectionProps } from './activeWorkoutTypes';
import { animateLayout } from './activeWorkoutFeedback';
import { ExerciseOptionsSheet } from './WorkoutSheets';

type Props = Pick<
  ExerciseSectionProps,
  | 'exercise'
  | 'onTrackingChange'
  | 'resolveTrackingSelection'
  | 'updateExercise'
  | 'removeExercise'
  | 'addWarmupSets'
  | 'onReplaceExercise'
> & { openRequest: number };

export function ExerciseOptionsController({
  exercise,
  openRequest,
  onTrackingChange,
  resolveTrackingSelection,
  updateExercise,
  removeExercise,
  addWarmupSets,
  onReplaceExercise,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [restorePreviousSessions, setRestorePreviousSessions] = useState(false);
  const [previousSessionPushStarted, setPreviousSessionPushStarted] = useState(false);
  const [enterInstant, setEnterInstant] = useState(false);
  const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);
  const { runAfterClose, onClosed } = useAfterSheetClose();
  const navigation = useNavigation<RootNavigationProp>();
  const screenIsFocused = useIsFocused();
  const reducedMotion = useForgeReducedMotion();
  const { completedWorkouts } = useWorkouts();
  const fields = trackingFields[effectiveTracking(exercise)];
  const canBuildWarmups =
    Boolean(addWarmupSets) && fields.includes('weight') && fields.includes('reps');
  const hasExerciseInfo =
    Boolean(exercise.exerciseSnapshot) || exerciseCatalogById.has(exercise.exerciseId ?? '');

  useEffect(() => {
    setEnterInstant(false);
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [openRequest]);

  useEffect(() => {
    if (!screenIsFocused) {
      if (previousSessionPushStarted) setPreviousSessionPushStarted(false);
      return;
    }
    if (restorePreviousSessions && !previousSessionPushStarted) {
      return runWhenIdle(() => {
        setEnterInstant(true);
        setVisible(true);
        setRestorePreviousSessions(false);
      });
    }
  }, [previousSessionPushStarted, restorePreviousSessions, screenIsFocused]);

  return (
    <>
      <ExerciseOptionsSheet
        exercise={exercise}
        visible={visible}
        enterInstant={enterInstant}
        resolveTrackingSelection={resolveTrackingSelection}
        groupedActions={resolveTrackingSelection === true}
        onTrackingChange={
          onTrackingChange
            ? (mode, confirmed) => onTrackingChange(exercise.id, mode, confirmed)
            : undefined
        }
        onClose={() => setVisible(false)}
        onClosed={onClosed}
        onEditNote={updateExercise ? (note) => updateExercise(exercise.id, { note }) : undefined}
        onToggleOffSession={
          updateExercise
            ? () =>
                runAfterClose(() =>
                  updateExercise(exercise.id, { offSession: !exercise.offSession }),
                )
            : undefined
        }
        onOpenPreviousSessions={() => undefined}
        addWarmupSets={
          canBuildWarmups && addWarmupSets ? (sets) => addWarmupSets(exercise.id, sets) : undefined
        }
        onOpenExerciseInfo={hasExerciseInfo ? () => undefined : undefined}
        completedWorkouts={completedWorkouts}
        onOpenWorkout={(workoutId) => {
          setVisible(false);
          setRestorePreviousSessions(true);
          setPreviousSessionPushStarted(true);
          navigation.push('WorkoutDetails', {
            workoutId,
            returnTo: 'ActiveWorkout',
            returnContext: 'previous-sessions',
          });
        }}
        onRemove={() => runAfterClose(() => setRemoveConfirmationOpen(true))}
        onReplaceExercise={
          onReplaceExercise ? () => runAfterClose(() => onReplaceExercise(exercise.id)) : undefined
        }
      />
      <ForgeConfirmationDialog
        visible={removeConfirmationOpen}
        title="Remove exercise?"
        message={`${exercise.name}\n\nIts sets and recorded values will be removed from this workout.`}
        cancelLabel="Keep exercise"
        confirmLabel="Remove exercise"
        onCancel={() => setRemoveConfirmationOpen(false)}
        onConfirm={() => {
          setRemoveConfirmationOpen(false);
          animateLayout(reducedMotion);
          removeExercise(exercise.id);
        }}
      />
    </>
  );
}
