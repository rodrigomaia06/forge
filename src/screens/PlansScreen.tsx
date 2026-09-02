import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AnchoredActionPopover,
  AppScreen,
  Button,
  ForgeText as Text,
  HeaderAction,
  Icon,
  ScreenTitle,
  selectionHaptic,
} from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing, typeScale } from '../theme/tokens';
import { usePlans } from '../state/PlansContext';
import { useWorkouts } from '../state/WorkoutContext';
import type { RootStackParamList, WorkoutPlan, WorkoutRoutine } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Plans'>;

export function PlansScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
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
    <AppScreen backgroundColor={theme.background}>
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
                  <RoutineRow
                    key={routine.id}
                    routine={routine}
                    last={index === standaloneRoutines.length - 1}
                    onStart={() => startRoutine(routine)}
                    onPress={() => openRoutine(routine)}
                    onMore={() => routineActions(routine)}
                  />
                ))}
              </View>
            </Section>
          )}
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onAddRoutine={() => addRoutine(plan.id)}
              onOpenRoutine={openRoutine}
              onStartRoutine={startRoutine}
              onRoutineActions={routineActions}
              onDelete={() => deletePlan(plan.id)}
            />
          ))}
          {!plans.length && !standaloneRoutines.length && (
            <EmptyPlans onNewRoutine={() => addRoutine()} onNewPlan={addPlan} />
          )}
          {(plans.length > 0 || standaloneRoutines.length > 0) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create standalone routine"
              onPress={() => addRoutine()}
              style={({ pressed }) => [styles.addRoutine, pressed && styles.pressed]}
            >
              <Icon name="add" size={18} color={theme.ink} />
              <Text style={styles.addRoutineText}>New routine</Text>
            </Pressable>
          )}
        </ScrollView>
        <NavigationFooter />
        <AnchoredActionPopover
          visible={creationOpen}
          onClose={() => setCreationOpen(false)}
          testID="plans-creation-popover"
          actions={[
            { label: 'New workout', icon: 'play', onPress: startBlankWorkout },
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
  onAddRoutine,
  onOpenRoutine,
  onStartRoutine,
  onRoutineActions,
  onDelete,
}: {
  plan: WorkoutPlan;
  onAddRoutine: () => void;
  onOpenRoutine: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onRoutineActions: (routine: WorkoutRoutine) => void;
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
    <Section title="Plan">
      <View style={styles.card}>
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
        {plan.routines.map((routine, index) => (
          <RoutineRow
            key={routine.id}
            routine={routine}
            last={false}
            nested={index === 0}
            onStart={() => onStartRoutine(routine)}
            onPress={() => onOpenRoutine(routine)}
            onMore={() => onRoutineActions(routine)}
          />
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
    </Section>
  );
}

function RoutineRow({
  routine,
  last,
  nested = false,
  onStart,
  onPress,
  onMore,
}: {
  routine: WorkoutRoutine;
  last: boolean;
  nested?: boolean;
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
        style={({ pressed }) => [styles.start, pressed && styles.pressed]}
      >
        <Icon name="play" size={17} color={theme.textPrimary} />
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
function EmptyPlans({
  onNewRoutine,
  onNewPlan,
}: {
  onNewRoutine: () => void;
  onNewPlan: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.empty}>
      <Icon name="book" size={32} color={theme.muted} />
      <Text style={styles.emptyTitle}>Build your first routine</Text>
      <Text style={styles.emptyText}>
        Save exercises and targets so your next workout is ready to start.
      </Text>
      <Button label="New routine" onPress={onNewRoutine} theme={theme} />
      <Button
        accessibilityLabel="New plan"
        label="New plan"
        variant="secondary"
        tone="neutral"
        onPress={onNewPlan}
        style={styles.secondaryAction}
      />
    </View>
  );
}
const createStyles = (theme: import('../types').ForgeTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.cardRadius,
      backgroundColor: theme.surface,
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
    content: { paddingHorizontal: spacing.screen, paddingTop: 16, paddingBottom: 112, gap: 22 },
    section: { gap: 9 },
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    planHeader: {
      minHeight: 70,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planName: { ...typeScale.cardTitle, color: theme.ink },
    planSummary: { ...typeScale.supporting, color: theme.slate, marginTop: 2 },
    routineRow: {
      minHeight: 66,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    start: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    routineCopy: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 52 },
    routineName: { ...typeScale.cardTitle, color: theme.ink },
    routineSummary: { ...typeScale.supporting, color: theme.slate, marginTop: 1 },
    more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addToPlan: {
      minHeight: 48,
      paddingHorizontal: 16,
      gap: 7,
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    addToPlanText: { ...typeScale.controlLabel, color: theme.textPrimary },
    addRoutine: {
      borderRadius: theme.cardRadius,
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      minHeight: 54,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 7,
      flexDirection: 'row',
    },
    addRoutineText: { ...typeScale.controlLabel, color: theme.ink },
    empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 72, gap: 12 },
    emptyTitle: { ...typeScale.sectionTitle, color: theme.ink, marginTop: 4 },
    emptyText: {
      ...typeScale.body,
      color: theme.slate,
      textAlign: 'center',
      marginBottom: 8,
    },
    secondaryAction: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
    secondaryActionText: { ...typeScale.controlLabel, color: theme.textPrimary },
    pressed: { opacity: 0.58 },
  });
