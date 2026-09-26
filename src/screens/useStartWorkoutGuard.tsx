import React from 'react';
import { useNavigation } from '@react-navigation/native';

import { ForgeConfirmationDialog } from '../components/ui';
import { useActiveWorkout } from '../state/WorkoutContext';
import type { RootNavigationProp } from '../types';

/**
 * Guards starting a new workout while one is already in progress. Rather than
 * silently ignoring the new pick (startWorkout returns the existing session),
 * it resumes the current workout and tells the user why. Callers wrap their
 * start-and-navigate action with `guardStart` and render `notice` once.
 */
export function useStartWorkoutGuard(): {
  guardStart: (startAndNavigate: () => void) => void;
  notice: React.ReactNode;
} {
  const navigation = useNavigation<RootNavigationProp>();
  const activeWorkout = useActiveWorkout();
  const [noticeOpen, setNoticeOpen] = React.useState(false);

  const guardStart = React.useCallback(
    (startAndNavigate: () => void) => {
      if (activeWorkout) {
        setNoticeOpen(true);
        return;
      }
      startAndNavigate();
    },
    [activeWorkout],
  );

  const notice = (
    <ForgeConfirmationDialog
      visible={noticeOpen}
      title="Workout in progress"
      message="You already have a workout running — resuming it. Finish or discard it to start a new one."
      cancelLabel="Cancel"
      confirmLabel="Resume"
      confirmTone="neutral"
      showCancel={false}
      onCancel={() => setNoticeOpen(false)}
      onConfirm={() => {
        setNoticeOpen(false);
        navigation.navigate('ActiveWorkout');
      }}
      testID="resume-workout-notice"
    />
  );

  return { guardStart, notice };
}
