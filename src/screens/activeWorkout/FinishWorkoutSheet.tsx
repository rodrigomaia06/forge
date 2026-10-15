import { ForgeSheetScrollView } from '../../components/ui/ForgeSheetScrollView';
import { scaleUI } from '../../theme/scale';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeSheetHeader,
  ForgeSingleSelectList,
  ForgeText as Text,
  ForgeTextInput,
  Icon,
  ForgeWorkoutFinishAction,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { spacing, typeScale, restTimerColors, radii } from '../../theme/tokens';
import type { FinishRoutineChoice, Workout, WorkoutPlan, WorkoutRoutine } from '../../types';
import { workoutFinishSummary } from '../../domain/workouts/finishWorkout';
import { hasRoutineStructureChanged } from '../../domain/workouts/routineStructure';
import { formatElapsed } from './activeWorkoutFormatters';

export function FinishWorkoutSheet({
  workout,
  visible,
  source,
  plans,
  onClose,
  onFinish,
}: {
  workout: Workout;
  visible: boolean;
  source?: WorkoutRoutine;
  plans: WorkoutPlan[];
  onClose: () => void;
  onFinish: (choice: FinishRoutineChoice) => Promise<boolean>;
}) {
  const theme = useForgeTheme();
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState('');
  const [name, setName] = useState(
    `${source?.name ?? workout.routineStructureBaseline?.routineName ?? workout.name} (new)`,
  );
  const [busy, setBusy] = useState(false);
  const defaultName = `${source?.name ?? workout.routineStructureBaseline?.routineName ?? workout.name} (new)`;
  useEffect(() => {
    if (visible) {
      setChoice('');
      setName(defaultName);
      setError('');
    }
  }, [visible, defaultName]);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const summary = workoutFinishSummary(workout);
  const changed = Boolean(workout.routineId && (hasRoutineStructureChanged(workout) || !source));
  const requiresRoutineChoice = changed || !workout.routineId;
  const destination = plans.find((plan) => plan.id === (workout.planId ?? source?.planId));
  const close = () => {
    if (!locked.current) onClose();
  };
  const body = { ...typeScale.body, color: theme.textSecondary };
  const title = { ...typeScale.cardTitle, color: theme.textPrimary };
  const finishLabel = summary.incomplete
    ? `Finish with ${summary.incomplete} incomplete ${summary.incomplete === 1 ? 'set' : 'sets'}`
    : 'Finish workout';
  const submit = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onFinish(
        choice === 'new'
          ? { kind: 'new', name }
          : choice === 'update'
            ? { kind: 'update' }
            : { kind: 'keep' },
      );
      if (!result)
        setError(
          'The workout could not be saved. Your workout and choices are still here. Try again.',
        );
    } catch {
      setError(
        'The workout could not be saved. Your workout and choices are still here. Try again.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  if (!requiresRoutineChoice && summary.incomplete > 0) {
    return (
      <ForgeConfirmationDialog
        visible={visible}
        title={`${summary.incomplete} ${summary.incomplete === 1 ? 'set is' : 'sets are'} incomplete`}
        message={`Finish ${workout.name}? ${summary.completed}/${summary.total} sets are complete. Partially completed sides will keep their progress.`}
        cancelLabel="Keep working out"
        confirmLabel={finishLabel}
        confirmTone="success"
        busy={busy}
        error={error}
        onCancel={close}
        onConfirm={() => void submit()}
        testID="finish-incomplete-confirmation"
      />
    );
  }
  return (
    <ForgeBottomSheet
      visible={visible}
      accessibilityLabel="Dismiss Finish workout"
      onClose={close}
      onBeforeClose={() => !locked.current}
      dragEnabled={!busy}
      testID="finish-workout-sheet"
      keyboardAvoiding
    >
      {(dismiss) => (
        <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            testID="finish-workout-header"
            title="Finish workout"
            onClose={dismiss}
            closePosition="left"
            trailing={
              <ForgeWorkoutFinishAction
                accessibilityLabel={finishLabel}
                loading={busy}
                disabled={(requiresRoutineChoice && !choice) || (choice === 'new' && !name.trim())}
                onPress={() => void submit()}
              />
            }
          />
          {error ? (
            <View style={{ paddingHorizontal: spacing.screen, paddingVertical: scaleUI(8) }}>
              <Text accessibilityRole="alert" style={{ ...body, color: theme.textDestructive }}>
                {error}
              </Text>
            </View>
          ) : null}
          <ForgeSheetScrollView
            testID="finish-workout-scroll"
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              padding: spacing.screen,
              paddingBottom: spacing.screen + insets.bottom,
              gap: scaleUI(16),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: scaleUI(16) }}>
              <View style={{ flex: 1, minWidth: 0, gap: scaleUI(6) }}>
                <Text style={title}>{workout.name}</Text>
                <Text style={body}>
                  {formatElapsed(
                    workout.automaticTimeTracking === false
                      ? (workout.durationSeconds ?? 0)
                      : Math.max(0, Math.round((Date.now() - workout.startedAt) / 1000)),
                  )}{' '}
                  · {workout.exercises.length}{' '}
                  {workout.exercises.length === 1 ? 'exercise' : 'exercises'}
                </Text>
                <Text style={body}>
                  {summary.completed}/{summary.total} sets completed
                </Text>
              </View>
              {workout.exercises.length > 0 && summary.incomplete > 0 ? (
                <View
                  testID="finish-incomplete-count"
                  accessibilityLabel={`${summary.incomplete} ${summary.incomplete === 1 ? 'set is' : 'sets are'} incomplete`}
                  style={{ alignItems: 'flex-end', gap: scaleUI(2), flexShrink: 0 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scaleUI(6) }}>
                    <Icon name="alert-triangle" size={20} color={restTimerColors.warning} />
                    <Text style={{ ...typeScale.metricLarge, color: theme.textPrimary }}>
                      {summary.incomplete}
                    </Text>
                  </View>
                  <Text style={{ ...typeScale.supporting, color: theme.textSecondary }}>
                    Incomplete
                  </Text>
                </View>
              ) : null}
            </View>
            {requiresRoutineChoice ? (
              <View style={{ gap: scaleUI(8) }}>
                <Text style={title}>{changed ? 'Routine changes' : 'Save workout'}</Text>
                {changed && !source ? (
                  <Text style={{ ...typeScale.supporting, color: theme.textSecondary }}>
                    The original routine was deleted.
                  </Text>
                ) : null}
                <ForgeCard variant="nested" size="compact" testID="finish-routine-choices">
                  <ForgeSingleSelectList
                    embedded
                    selectedValue={choice}
                    onSelect={setChoice}
                    disableVirtualization
                    options={[
                      {
                        value: 'keep',
                        label: changed
                          ? source
                            ? 'Keep original routine'
                            : 'Save workout only'
                          : 'History only',
                        description:
                          changed && source
                            ? 'Leave the template unchanged'
                            : 'Save this session to History',
                      },
                      ...(changed && source
                        ? [
                            {
                              value: 'update',
                              label: 'Update existing routine',
                              description: 'Use this exercise and set structure',
                            },
                          ]
                        : []),
                      {
                        value: 'new',
                        label: changed ? 'Save as new routine' : 'Save as routine',
                        description: changed
                          ? 'Keep the original and create a copy'
                          : 'Save to History and create a reusable routine',
                      },
                    ]}
                  />
                  {choice === 'new' ? (
                    <View style={{ paddingHorizontal: scaleUI(12), paddingBottom: scaleUI(12) }}>
                      <ForgeCard
                        variant="nested"
                        size="compact"
                        testID="new-routine-details"
                        style={{
                          backgroundColor: theme.surfaceInset,
                          padding: scaleUI(14),
                          gap: scaleUI(8),
                        }}
                      >
                        <Text style={{ ...typeScale.supporting, color: theme.textSecondary }}>
                          Routine name
                        </Text>
                        <ForgeTextInput
                          accessibilityLabel="New routine name"
                          value={name}
                          onChangeText={setName}
                          style={{
                            ...typeScale.body,
                            color: theme.textPrimary,
                            minHeight: scaleUI(48),
                            paddingHorizontal: scaleUI(14),
                            paddingVertical: scaleUI(10),
                            borderRadius: radii.control,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor:
                              theme.colorScheme === 'light' ? theme.surfaceElevated : theme.input,
                          }}
                        />
                        <Text style={{ ...typeScale.supporting, color: theme.textSecondary }}>
                          Destination: {destination?.name ?? 'Standalone routines'}
                        </Text>
                      </ForgeCard>
                    </View>
                  ) : null}
                </ForgeCard>
              </View>
            ) : null}
          </ForgeSheetScrollView>
        </>
      )}
    </ForgeBottomSheet>
  );
}
