import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  AnchoredActionPopover,
  AppScreen,
  ForgeActionSheet,
  ForgeText as Text,
  HeaderAction,
  Icon,
  lightHaptic,
  mediumHaptic,
  ScreenTitle,
  selectionHaptic,
} from '../components/ui';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing, typeScale } from '../theme/tokens';
import { usePlans } from '../state/PlansContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkouts } from '../state/WorkoutContext';
import type {
  IconName,
  RootTabScreenProps,
  WorkoutPlan,
  WorkoutRoutine,
  WorkoutTypePreference,
} from '../types';
import { workoutTypeIcon } from './settings/workoutTypeIcon';
import { forgeDockScrollInset } from '../components/DockChrome';

type Props = RootTabScreenProps<'Plans'>;
type PlanActionTarget =
  | { kind: 'routine'; item: WorkoutRoutine }
  | { kind: 'plan'; item: WorkoutPlan };
const swipeSpring = { damping: 22, stiffness: 280, mass: 0.65, overshootClamping: true };

export function PlansScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const {
    plans,
    standaloneRoutines,
    createPlan,
    deletePlan,
    deleteRoutine,
  } = usePlans();
  const { startWorkout } = useWorkouts();
  const [creationOpen, setCreationOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<PlanActionTarget | null>(null);

  useEffect(() => {
    if (!route.params?.openCreation) return;
    setCreationOpen(true);
    navigation.setParams({ openCreation: undefined });
  }, [navigation, route.params?.openCreation]);

  const startRoutine = (routine: WorkoutRoutine, withHaptic = true): void => {
    if (withHaptic) selectionHaptic();
    startWorkout({
      name: routine.name,
      type: routine.type,
      note: routine.note,
      attributes: routine.attributes,
      routineId: routine.id,
      planId: routine.planId,
      exercises: routine.exercises,
    });
    navigation.navigate('ActiveWorkout');
  };
  const openRoutine = (routine: WorkoutRoutine, withHaptic = true): void => {
    if (withHaptic) selectionHaptic();
    navigation.navigate('RoutineEditor', { mode: 'edit', routineId: routine.id });
  };
  const viewRoutine = (routine: WorkoutRoutine, withHaptic = true): void => {
    if (withHaptic) selectionHaptic();
    navigation.navigate('RoutineEditor', { mode: 'view', routineId: routine.id });
  };
  const routineActions = (routine: WorkoutRoutine): void => {
    lightHaptic();
    setActionTarget({ kind: 'routine', item: routine });
  };
  const addPlan = (): void => {
    createPlan();
  };
  const startBlankWorkout = (): void => {
    selectionHaptic();
    startWorkout();
    navigation.navigate('ActiveWorkout');
  };
  const addRoutine = (planId?: string): void => {
    navigation.navigate('RoutineEditor', { mode: 'create', planId });
  };

  return (
    <AppScreen backgroundColor={theme.background} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ScreenTitle color={theme.textPrimary}>Plans</ScreenTitle>
          <HeaderAction
            accessibilityLabel="Create workout, routine, or plan"
            icon="add"
            iconOnly
            onPress={() => setCreationOpen(true)}
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {standaloneRoutines.length > 0 && (
            <Section title="Routines">
              <View style={styles.card}>
                {standaloneRoutines.map((routine, index) => (
                  <SwipeDelete
                    key={routine.id}
                    accessibilityLabel={`Delete ${routine.name}`}
                    testID={`routine-swipe-${routine.id}`}
                    onOpen={() => openRoutine(routine)}
                    onDelete={() => deleteRoutine(routine.id)}
                  >
                    {() => (
                      <RoutineRow
                        routine={routine}
                        workoutTypes={preferences.workoutTypes}
                        last={index === standaloneRoutines.length - 1}
                        onStart={() => startRoutine(routine)}
                        onPress={() => routineActions(routine)}
                      />
                    )}
                  </SwipeDelete>
                ))}
              </View>
            </Section>
          )}
          {plans.length > 0 && (
            <Section title="Plans">
              <View style={styles.planList}>
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    workoutTypes={preferences.workoutTypes}
                    onAddRoutine={() => addRoutine(plan.id)}
                    onOpenRoutine={routineActions}
                    onStartRoutine={startRoutine}
                    onDeleteRoutine={(routine) => deleteRoutine(routine.id)}
                    onOptions={(item) => {
                      lightHaptic();
                      setActionTarget({ kind: 'plan', item });
                    }}
                    onDelete={() => deletePlan(plan.id)}
                  />
                ))}
              </View>
            </Section>
          )}
          {!plans.length && !standaloneRoutines.length && <EmptyPlans />}
        </ScrollView>
        <AnchoredActionPopover
          visible={creationOpen}
          onClose={() => setCreationOpen(false)}
          testID="plans-creation-popover"
          actions={[
            { label: 'New workout', icon: 'fitness', onPress: startBlankWorkout },
            { label: 'New routine', icon: 'book', onPress: () => addRoutine() },
            { label: 'New workout plan', icon: 'layers', onPress: addPlan },
          ]}
        />
        <ForgeActionSheet
          visible={actionTarget !== null}
          onClose={() => setActionTarget(null)}
          accessibilityLabel={
            actionTarget?.kind === 'routine' ? 'Dismiss routine options' : 'Dismiss plan options'
          }
          title={actionTarget?.kind === 'routine' ? 'Routine options' : 'Plan options'}
          testID="plans-options-sheet"
          actions={
            actionTarget?.kind === 'routine'
              ? [
                  { label: 'Start', icon: 'play', onPress: () => startRoutine(actionTarget.item, false) },
                  { label: 'Edit', icon: 'note', onPress: () => openRoutine(actionTarget.item, false) },
                  { label: 'Visualize', icon: 'info', onPress: () => viewRoutine(actionTarget.item, false) },
                ]
              : actionTarget
                ? [
                  {
                    label: 'Add routine',
                    icon: 'add',
                    onPress: () => addRoutine(actionTarget.item.id),
                  },
                  {
                    label: 'Delete plan',
                    icon: 'trash',
                    tone: 'destructive' as const,
                    onPress: () => deletePlan(actionTarget.item.id),
                  },
                ]
              : []
          }
        />
      </View>
    </AppScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PlanCard({
  plan,
  workoutTypes,
  onAddRoutine,
  onOpenRoutine,
  onStartRoutine,
  onDeleteRoutine,
  onOptions,
  onDelete,
}: {
  plan: WorkoutPlan;
  workoutTypes: WorkoutTypePreference[];
  onAddRoutine: () => void;
  onOpenRoutine: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
  onOptions: (plan: WorkoutPlan) => void;
  onDelete: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <SwipeDelete
      accessibilityLabel={`Delete ${plan.name}`}
      testID={`plan-swipe-${plan.id}`}
      onDelete={onDelete}
      rounded
    >
      {() => (
        <View style={styles.card}>
          <Pressable
            testID={`plan-header-${plan.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Open options for ${plan.name}`}
            onPress={() => onOptions(plan)}
            style={({ pressed }) => [styles.planHeader, pressed && styles.pressed]}
          >
            <Text style={styles.planName}>{plan.name}</Text>
            <Icon name="chevron-forward" size={20} color={theme.slate} />
          </Pressable>
          {plan.routines.length > 0 && <View style={styles.planRoutineSeparation} />}
          {plan.routines.map((routine, index) => (
            <SwipeDelete
              key={routine.id}
              accessibilityLabel={`Delete ${routine.name}`}
              testID={`routine-swipe-${routine.id}`}
              onDelete={() => onDeleteRoutine(routine)}
            >
              {() => (
                <RoutineRow
                  routine={routine}
                  workoutTypes={workoutTypes}
                  last={index === plan.routines.length - 1}
                  onStart={() => onStartRoutine(routine)}
                  onPress={() => onOpenRoutine(routine)}
                />
              )}
            </SwipeDelete>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add routine to ${plan.name}`}
            onPress={onAddRoutine}
            style={({ pressed }) => [styles.addToPlan, pressed && styles.pressed]}
          >
            <Icon name="add" size={16} color={theme.textPrimary} />
            <Text style={styles.addToPlanText}>Add routine</Text>
          </Pressable>
        </View>
      )}
    </SwipeDelete>
  );
}

function RoutineRow({
  routine,
  workoutTypes,
  last,
  onStart,
  onPress,
}: {
  routine: WorkoutRoutine;
  workoutTypes: WorkoutTypePreference[];
  last: boolean;
  onStart: () => void;
  onPress: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.routineRow, !last && styles.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Start ${routine.name}`}
        onPress={onStart}
        style={({ pressed }) => [styles.typeMarker, pressed && styles.pressed]}
      >
        <Icon name={getRoutineTypeIcon(routine.type, workoutTypes)} size={21} color={theme.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Routine actions for ${routine.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.routineCopy, pressed && styles.pressed]}
      >
        <View style={styles.routineText}>
          <Text style={styles.routineName} numberOfLines={1}>
            {routine.name}
          </Text>
          <Text
            style={styles.routineSummary}
            numberOfLines={1}
          >{`${routine.type} · ${routine.exercises.length} ${routine.exercises.length === 1 ? 'exercise' : 'exercises'}`}</Text>
        </View>
        <Icon name="chevron-forward" size={19} color={theme.slate} />
      </Pressable>
    </View>
  );
}

function EmptyPlans() {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.empty}>
      <Icon name="book" size={32} color={theme.muted} />
      <Text style={styles.emptyTitle}>Build your first routine</Text>
      <Text style={styles.emptyText}>
        Use the add button above to create a routine or workout plan.
      </Text>
    </View>
  );
}

function getRoutineTypeIcon(type: string, workoutTypes: WorkoutTypePreference[]): IconName {
  const normalized = type.trim().toLowerCase();
  const preference = workoutTypes.find(
    (item) => item.id.toLowerCase() === normalized || item.name.toLowerCase() === normalized,
  );
  if (preference) return workoutTypeIcon(preference);
  if (normalized === 'strength') return 'fitness';
  if (normalized === 'mobility') return 'stretching';
  if (normalized === 'cardio') return 'running';
  if (normalized === 'court sport') return 'tennis-ball';
  return 'layers';
}

function SwipeDelete({
  accessibilityLabel,
  testID,
  onOpen,
  onDelete,
  rounded = false,
  children,
}: {
  accessibilityLabel: string;
  testID: string;
  onOpen?: () => void;
  onDelete: () => void;
  rounded?: boolean;
  children: (onOpen: () => void) => React.ReactNode;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const actionWidth = 76;
  const [revealed, setRevealed] = useState(false);
  const offset = useSharedValue(0);
  const open = useSharedValue(false);
  const suppressNextPress = useRef(false);

  useEffect(() => {
    open.value = revealed;
    offset.value = withSpring(revealed ? -actionWidth : 0, swipeSpring);
  }, [offset, open, revealed]);

  const settle = (next: boolean, dragged: boolean): void => {
    if (dragged) suppressNextPress.current = true;
    if (next !== revealed) {
      mediumHaptic();
      setRevealed(next);
    } else {
      offset.value = withSpring(next ? -actionWidth : 0, swipeSpring);
    }
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (!open.value && event.translationX >= 0) return;
      const initial = open.value ? -actionWidth : 0;
      offset.value = Math.max(-actionWidth, Math.min(0, initial + event.translationX));
    })
    .onEnd((event) => {
      const initial = open.value ? -actionWidth : 0;
      const next = initial + event.translationX < -actionWidth * 0.55;
      runOnJS(settle)(next, Math.abs(event.translationX) > 6);
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const handleOpen = (): void => {
    if (suppressNextPress.current) {
      suppressNextPress.current = false;
      return;
    }
    lightHaptic();
    onOpen?.();
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testID}
        style={[styles.swipeContainer, rounded && styles.roundedSwipeContainer]}
      >
        <View
          pointerEvents={revealed ? 'auto' : 'none'}
          style={[styles.deleteLayer, { backgroundColor: theme.destructiveSurface }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={() => {
              lightHaptic();
              onDelete();
            }}
            style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}
          >
            <Icon name="trash" size={18} color={theme.textDestructive} />
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
        <Animated.View
          style={[styles.swipeSurface, { backgroundColor: theme.surface }, animatedStyle]}
        >
          {children(handleOpen)}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const createStyles = (theme: import('../types').ForgeTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.cardRadius,
      backgroundColor: theme.surface,
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    screen: { flex: 1 },
    header: {
      height: 70,
      paddingHorizontal: spacing.screen,
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: 'row',
    },
    content: {
      paddingHorizontal: spacing.screen,
      paddingTop: 16,
      paddingBottom: forgeDockScrollInset,
      gap: 28,
    },
    section: { gap: 11 },
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    planList: { gap: 14 },
    planHeader: {
      minHeight: 56,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planRoutineSeparation: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: 12,
      backgroundColor: theme.divider,
    },
    planName: { ...typeScale.cardTitle, color: theme.ink },
    routineRow: {
      minHeight: 76,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    typeMarker: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
      marginRight: 10,
    },
    routineCopy: {
      flex: 1,
      minWidth: 0,
      minHeight: 62,
      paddingRight: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    routineText: { flex: 1, minWidth: 0 },
    routineName: { ...typeScale.cardTitle, color: theme.ink },
    routineSummary: { ...typeScale.supporting, color: theme.slate, marginTop: 1 },
    addToPlan: {
      minHeight: 46,
      margin: 12,
      paddingHorizontal: 16,
      gap: 7,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.textSecondary,
      borderRadius: 14,
    },
    addToPlanText: { ...typeScale.controlLabel, color: theme.textPrimary },
    empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 92, gap: 12 },
    emptyTitle: { ...typeScale.sectionTitle, color: theme.ink, marginTop: 4 },
    emptyText: {
      ...typeScale.body,
      color: theme.slate,
      textAlign: 'center',
      marginBottom: 8,
    },
    swipeContainer: {
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: theme.destructiveSurface,
    },
    roundedSwipeContainer: { borderRadius: theme.cardRadius },
    deleteLayer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 76,
      alignItems: 'stretch',
      justifyContent: 'center',
    },
    deleteAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
    deleteActionPressed: { backgroundColor: theme.destructiveSurfacePressed },
    deleteText: { ...typeScale.caption, color: theme.textDestructive },
    swipeSurface: { zIndex: 1 },
    pressed: { opacity: 0.58 },
  });
