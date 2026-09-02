import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

type Props = RootTabScreenProps<'Plans'>;
const swipeSpring = { damping: 22, stiffness: 280, mass: 0.65, overshootClamping: true };

export function PlansScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const {
    plans,
    standaloneRoutines,
    createPlan,
    createRoutine,
    duplicateRoutine,
    deletePlan,
    deleteRoutine,
  } = usePlans();
  const { startWorkout } = useWorkouts();
  const [creationOpen, setCreationOpen] = useState(false);

  useEffect(() => {
    if (!route.params?.openCreation) return;
    setCreationOpen(true);
    navigation.setParams({ openCreation: undefined });
  }, [navigation, route.params?.openCreation]);

  const startRoutine = (routine: WorkoutRoutine): void => {
    selectionHaptic();
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
  const openRoutine = (routine: WorkoutRoutine): void => {
    selectionHaptic();
    navigation.navigate('RoutineEditor', { routineId: routine.id });
  };
  const routineActions = (routine: WorkoutRoutine): void => {
    Alert.alert(routine.name, undefined, [
      { text: 'Start', onPress: () => startRoutine(routine) },
      { text: 'Edit', onPress: () => openRoutine(routine) },
      { text: 'Duplicate', onPress: () => duplicateRoutine(routine.id) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRoutine(routine.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    const routine = createRoutine({ planId });
    navigation.navigate('RoutineEditor', { routineId: routine.id });
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
                    {(onOpen) => (
                      <RoutineRow
                        routine={routine}
                        workoutTypes={preferences.workoutTypes}
                        last={index === standaloneRoutines.length - 1}
                        onStart={() => startRoutine(routine)}
                        onPress={onOpen}
                        onMore={() => routineActions(routine)}
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
                    onOpenRoutine={openRoutine}
                    onStartRoutine={startRoutine}
                    onRoutineActions={routineActions}
                    onDeleteRoutine={(routine) => deleteRoutine(routine.id)}
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
  onRoutineActions,
  onDeleteRoutine,
  onDelete,
}: {
  plan: WorkoutPlan;
  workoutTypes: WorkoutTypePreference[];
  onAddRoutine: () => void;
  onOpenRoutine: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onRoutineActions: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
  onDelete: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const more = (): void =>
    Alert.alert(plan.name, undefined, [
      { text: 'Add routine', onPress: onAddRoutine },
      { text: 'Delete plan', style: 'destructive', onPress: onDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  return (
    <View style={styles.card}>
      <SwipeDelete
        accessibilityLabel={`Delete ${plan.name}`}
        testID={`plan-swipe-${plan.id}`}
        onDelete={onDelete}
      >
        {() => (
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text
                style={styles.planSummary}
              >{`${plan.routines.length} ${plan.routines.length === 1 ? 'routine' : 'routines'}`}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Options for ${plan.name}`}
              onPress={more}
              style={({ pressed }) => [styles.more, pressed && styles.pressed]}
            >
              <Icon name="ellipsis-horizontal" size={20} color={theme.slate} />
            </Pressable>
          </View>
        )}
      </SwipeDelete>
      {plan.routines.map((routine, index) => (
        <SwipeDelete
          key={routine.id}
          accessibilityLabel={`Delete ${routine.name}`}
          testID={`routine-swipe-${routine.id}`}
          onOpen={() => onOpenRoutine(routine)}
          onDelete={() => onDeleteRoutine(routine)}
        >
          {(onOpen) => (
            <RoutineRow
              routine={routine}
              workoutTypes={workoutTypes}
              last={index === plan.routines.length - 1}
              onStart={() => onStartRoutine(routine)}
              onPress={onOpen}
              onMore={() => onRoutineActions(routine)}
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
  );
}

function RoutineRow({
  routine,
  workoutTypes,
  last,
  onStart,
  onPress,
  onMore,
}: {
  routine: WorkoutRoutine;
  workoutTypes: WorkoutTypePreference[];
  last: boolean;
  onStart: () => void;
  onPress: () => void;
  onMore: () => void;
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
        accessibilityLabel={`Edit ${routine.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.routineCopy, pressed && styles.pressed]}
      >
        <Text style={styles.routineName} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text
          style={styles.routineSummary}
          numberOfLines={1}
        >{`${routine.type} · ${routine.exercises.length} ${routine.exercises.length === 1 ? 'exercise' : 'exercises'}`}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More options for ${routine.name}`}
        onPress={onMore}
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}
      >
        <Icon name="ellipsis-horizontal" size={19} color={theme.slate} />
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
  children,
}: {
  accessibilityLabel: string;
  testID: string;
  onOpen?: () => void;
  onDelete: () => void;
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
      <View testID={testID} style={styles.swipeContainer}>
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
    content: { paddingHorizontal: spacing.screen, paddingTop: 16, paddingBottom: 80, gap: 28 },
    section: { gap: 11 },
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    planList: { gap: 14 },
    planHeader: {
      minHeight: 76,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planName: { ...typeScale.cardTitle, color: theme.ink },
    planSummary: { ...typeScale.supporting, color: theme.slate, marginTop: 2 },
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
    routineCopy: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 52 },
    routineName: { ...typeScale.cardTitle, color: theme.ink },
    routineSummary: { ...typeScale.supporting, color: theme.slate, marginTop: 1 },
    more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
