import { ForgeSheetScrollView } from '../../components/ui/ForgeSheetScrollView';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  ForgeActionSheet,
  ForgeBackButton,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeSheetHeader,
  ForgeText as Text,
  Icon,
  lightHaptic,
  pressedFeedbackSubtle,
  selectionHaptic,
  useAfterSheetClose,
} from '../../components/ui';
import { useSettings } from '../../state/SettingsContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { usePlans } from '../../state/PlansContext';
import { routineExercisesWithNextSessionTargets } from '../../domain/workouts/nextSessionTargets';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { workoutTypeIcon } from '../settings/workoutTypeIcon';
import { useStartWorkoutGuard } from '../useStartWorkoutGuard';
import type { ReactNode } from 'react';
import type {
  ForgeTheme,
  RootNavigationProp,
  WorkoutPlan,
  WorkoutRoutine,
} from '../../types';

type RoutineSourceStep = 'routine-list' | { planId: string } | null;

export interface WorkoutStarter {
  /** Opens the blank / routine chooser sheet. */
  openChooser: () => void;
  /** Starts a specific routine immediately, bypassing the chooser. */
  startRoutine: (routine: WorkoutRoutine, plan?: WorkoutPlan) => void;
  /** The chooser sheet element. Render it once inside the screen tree. */
  sheet: ReactNode;
}

/**
 * Owns the "start a workout" flow shared by the dashboard header action and the
 * suggested-workout hero: the blank/routine chooser sheet, and starting either a
 * blank session or a routine (seeded with next-session targets).
 */
export function useWorkoutStarter(): WorkoutStarter {
  const navigation = useNavigation<RootNavigationProp>();
  const { startWorkout, completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const { guardStart, notice } = useStartWorkoutGuard();
  const { runAfterClose, onClosed } = useAfterSheetClose();
  const [workoutSourceOpen, setWorkoutSourceOpen] = React.useState(false);
  const [routineSourceStep, setRoutineSourceStep] = React.useState<RoutineSourceStep>(null);

  const openChooser = React.useCallback(() => {
    lightHaptic();
    setWorkoutSourceOpen(true);
  }, []);

  const startBlankWorkout = React.useCallback(() => {
    // Run guardStart (which may present the "workout in progress" dialog) only
    // once the source sheet has fully closed; iOS drops a Modal shown while
    // another is dismissing.
    runAfterClose(() => guardStart(() => {
      startWorkout();
      // Land on the empty workout and let the user open the picker explicitly via
      // "Add exercise" — starting a blank session should not force the picker open.
      navigation.navigate('ActiveWorkout');
    }));
    setWorkoutSourceOpen(false);
  }, [guardStart, navigation, runAfterClose, startWorkout]);

  const startRoutineImmediate = React.useCallback(
    (routine: WorkoutRoutine, plan?: WorkoutPlan) => {
      guardStart(() => {
        startWorkout({
          name: plan ? `${plan.name} - ${routine.name}` : routine.name,
          type: routine.type,
          note: routine.note,
          attributes: routine.attributes
            ? Object.fromEntries(Object.keys(routine.attributes).map((label) => [label, '']))
            : undefined,
          attributeIcons: routine.attributeIcons,
          routineId: routine.id,
          routineTemplate: routine,
          planId: plan?.id ?? routine.planId,
          exercises: routineExercisesWithNextSessionTargets(routine, completedWorkouts),
        });
        navigation.navigate('ActiveWorkout');
      });
    },
    [completedWorkouts, guardStart, navigation, startWorkout],
  );

  // Direct entry (e.g. the suggested-workout hero) has no chooser sheet to wait on.
  const startRoutine = React.useCallback(
    (routine: WorkoutRoutine, plan?: WorkoutPlan) => {
      selectionHaptic();
      startRoutineImmediate(routine, plan);
    },
    [startRoutineImmediate],
  );

  // Chosen from the chooser sheet: defer until it has fully closed.
  const startRoutineFromChooser = React.useCallback(
    (routine: WorkoutRoutine, plan?: WorkoutPlan) => {
      selectionHaptic();
      runAfterClose(() => startRoutineImmediate(routine, plan));
      setRoutineSourceStep(null);
      setWorkoutSourceOpen(false);
    },
    [runAfterClose, startRoutineImmediate],
  );

  const sheet = (
    <>
    <ForgeActionSheet
      visible={workoutSourceOpen}
      onClose={() => {
        setWorkoutSourceOpen(false);
        setRoutineSourceStep(null);
      }}
      onClosed={onClosed}
      accessibilityLabel="Dismiss workout source chooser"
      title="Start workout"
      testID="dashboard-workout-source-chooser"
      waitForContentLayoutBeforeEnter
      actions={[
        {
          label: 'Blank workout',
          description: 'Choose exercises for a new session',
          icon: 'fitness',
          onPress: startBlankWorkout,
        },
        {
          label: 'From routine or plan',
          description: 'Use one of your saved templates',
          icon: 'book',
          // Keep this sheet mounted and swap its content to the routine chooser,
          // so it continues from this card rather than dismissing and
          // re-presenting a second sheet.
          dismiss: false,
          onPress: () => setRoutineSourceStep('routine-list'),
        },
      ]}
      replacement={routineSourceStep !== null ? (closeSheet) => (
        <RoutineSourceContent
          step={routineSourceStep}
          plans={plans}
          standaloneRoutines={standaloneRoutines}
          closeSheet={closeSheet}
          onBack={() =>
            setRoutineSourceStep((current) =>
              current && typeof current === 'object' ? 'routine-list' : null,
            )
          }
          onChoosePlan={(planId) => setRoutineSourceStep({ planId })}
          onSelectRoutine={startRoutineFromChooser}
        />
      ) : null}
    />
    {notice}
    </>
  );

  return { openChooser, startRoutine, sheet };
}

function RoutineSourceContent({
  step,
  plans,
  standaloneRoutines,
  closeSheet,
  onBack,
  onChoosePlan,
  onSelectRoutine,
}: {
  step: Exclude<RoutineSourceStep, null>;
  plans: WorkoutPlan[];
  standaloneRoutines: WorkoutRoutine[];
  closeSheet: () => void;
  onBack: () => void;
  onChoosePlan: (planId: string) => void;
  onSelectRoutine: (routine: WorkoutRoutine, plan?: WorkoutPlan) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createRoutineSourceStyles);
  const selectedPlan = typeof step === 'object' ? plans.find((plan) => plan.id === step.planId) : undefined;
  return (
    <View>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title={selectedPlan ? selectedPlan.name : 'Choose routine'}
        onClose={closeSheet}
        closeAccessibilityLabel="Close routine chooser"
        leading={
          <ForgeBackButton
            accessibilityLabel={selectedPlan ? 'Back to routines' : 'Back to workout source'}
            onPress={onBack}
          />
        }
      />
      <ForgeSheetScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {selectedPlan ? (
          selectedPlan.routines.length ? (
            <RoutineChoiceCard routines={selectedPlan.routines} onPress={(routine) => onSelectRoutine(routine, selectedPlan)} />
          ) : <Text style={styles.empty}>This plan has no routines yet.</Text>
        ) : (
          <>
            {standaloneRoutines.length ? <View style={styles.group}>
              <Text style={styles.label}>Standalone routines</Text>
              <RoutineChoiceCard routines={standaloneRoutines} onPress={(routine) => onSelectRoutine(routine)} />
            </View> : null}
            {plans.length ? <View style={styles.group}>
              <Text style={styles.label}>Plans</Text>
              <ForgeCard variant="nested" size="compact">
                {plans.map((plan, index) => (
                  <Pressable
                    key={plan.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose routine from ${plan.name}`}
                    onPress={() => {
                      lightHaptic();
                      onChoosePlan(plan.id);
                    }}
                    style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && pressedFeedbackSubtle]}
                  >
                    <Icon name="layers" size={21} color={theme.ink} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel}>{plan.name}</Text>
                      <Text style={styles.rowDetail}>{plan.routines.length === 1 ? '1 routine' : `${plan.routines.length} routines`}</Text>
                    </View>
                    <Icon name="chevron-forward" size={20} color={theme.slate} />
                  </Pressable>
                ))}
              </ForgeCard>
            </View> : null}
            {!standaloneRoutines.length && !plans.length ? <Text style={styles.empty}>Create a routine first, then start it from here.</Text> : null}
          </>
        )}
      </ForgeSheetScrollView>
    </View>
  );
}

function RoutineChoiceCard({
  routines,
  onPress,
}: {
  routines: WorkoutRoutine[];
  onPress: (routine: WorkoutRoutine) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createRoutineSourceStyles);
  const { preferences } = useSettings();
  return (
    <ForgeCard variant="nested" size="compact">
      {routines.map((routine, index) => {
        const type = preferences.workoutTypes.find((item) => item.name === routine.type)
          ?? { id: 'retained-routine-type', name: routine.type, color: theme.ink, source: 'custom' as const, hidden: true };
        return <Pressable key={routine.id} accessibilityRole="button" accessibilityLabel={`Use ${routine.name} routine`} onPress={() => onPress(routine)} style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && pressedFeedbackSubtle]}>
          <Icon name={workoutTypeIcon(type)} size={21} color={theme.ink} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{routine.name}</Text>
            <Text style={styles.rowDetail}>{routine.type}</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={theme.slate} />
        </Pressable>;
      })}
    </ForgeCard>
  );
}

const createRoutineSourceStyles = (theme: ForgeTheme) => StyleSheet.create({
  // Hug the content when short, shrink to scroll within the sheet cap when tall.
  scroll: { flexShrink: 1 },
  content: { paddingTop: 14, paddingBottom: 24, paddingHorizontal: 20, gap: 18 },
  group: { gap: 8 },
  label: { color: theme.slate, ...typeScale.label },
  row: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: theme.ink, ...typeScale.label },
  rowDetail: { color: theme.slate, ...typeScale.caption },
  empty: { paddingHorizontal: 4, color: theme.slate, ...typeScale.supporting },
});
