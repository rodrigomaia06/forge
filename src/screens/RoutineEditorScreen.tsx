import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AppScreen,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  HeaderCircleAction,
  Icon,
  lightHaptic,
  selectionHaptic,
} from '../components/ui';
import { AddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { usePlans } from '../state/PlansContext';
import { useSettings } from '../state/SettingsContext';
import { makeWorkoutId } from '../state/workoutMutations';
import type { RootStackParamList, WorkoutRoutine } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoutineEditor'>;

export function RoutineEditorScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { findRoutine, updateRoutine, deleteRoutine, plans, moveRoutine } = usePlans();
  const { preferences } = useSettings();
  const routine = findRoutine(route.params.routineId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingExercises, setAddingExercises] = useState(false);
  const planName = useMemo(
    () => plans.find((plan) => plan.id === routine?.planId)?.name,
    [plans, routine?.planId],
  );
  if (!routine) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>This routine is unavailable.</Text>
      </View>
    );
  }
  const change = (update: (current: WorkoutRoutine) => WorkoutRoutine): void =>
    updateRoutine(routine.id, update);
  const addExercises = (names: string[]): void => {
    lightHaptic();
    change((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        ...names.map((name) => ({
          id: makeWorkoutId('routine-exercise'),
          name,
          sets: [{ id: makeWorkoutId('routine-set'), weight: '', reps: '', targetReps: '8–12' }],
        })),
      ],
    }));
    setAddingExercises(false);
  };
  const confirmDelete = (): void =>
    Alert.alert('Delete routine?', 'This cannot be undone.', [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRoutine(routine.id);
          navigation.goBack();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const showRoutineOptions = (): void => {
    selectionHaptic();
    Alert.alert(routine.name, undefined, [
      {
        text: routine.planId ? 'Move to standalone routines' : 'Move to a plan',
        onPress: () => {
          if (routine.planId) moveRoutine(routine.id);
          else if (plans[0]) moveRoutine(routine.id, plans[0].id);
        },
      },
      { text: 'Delete routine', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <AppScreen backgroundColor={theme.background}>
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <HeaderAction
            accessibilityLabel="Back to Plans"
            icon="chevron-back"
            label="Back"
            iconOnly
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerTitleWrap} pointerEvents="none">
            <Text style={styles.headerTitle} numberOfLines={1}>
              Edit routine
            </Text>
          </View>
          <HeaderCircleAction
            accessibilityLabel="Routine options"
            icon="ellipsis-horizontal"
            iconSize={20}
            onPress={showRoutineOptions}
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.sessionCard}>
            <TextInput
              accessibilityLabel="Routine name"
              value={routine.name}
              onChangeText={(name) => change((current) => ({ ...current, name }))}
              style={styles.nameInput}
              placeholder="Routine name"
              placeholderTextColor={theme.muted}
            />
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Workout type, ${routine.type}`}
              onPress={() => {
                selectionHaptic();
                setPickerOpen((current) => !current);
              }}
              style={({ pressed }) => [styles.typeRow, pressed && styles.pressed]}
            >
              <Text style={styles.fieldLabel}>Workout type</Text>
              <View style={styles.typeDot} />
              <Text style={styles.typeValue}>{routine.type}</Text>
              <Icon name="chevron-forward" size={17} color={theme.slate} />
            </Pressable>
            {pickerOpen && (
              <View style={styles.typeChoices}>
                {preferences.workoutTypes
                  .filter((type) => !type.hidden || type.name === routine.type)
                  .map((type) => (
                    <Pressable
                      key={type.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${type.name} workout type`}
                      onPress={() => {
                        change((current) => ({ ...current, type: type.name }));
                        setPickerOpen(false);
                      }}
                      style={({ pressed }) => [styles.typeChoice, pressed && styles.pressed]}
                    >
                      <View style={[styles.choiceDot, { backgroundColor: type.color }]} />
                      <Text style={styles.typeChoiceText}>{type.name}</Text>
                      {routine.type === type.name && (
                        <Icon name="check" size={17} color={theme.accent} />
                      )}
                    </Pressable>
                  ))}
              </View>
            )}
            <View style={styles.divider} />
            <TextInput
              accessibilityLabel="Routine note"
              value={routine.note || ''}
              onChangeText={(note) => change((current) => ({ ...current, note }))}
              style={styles.noteInput}
              placeholder="Add a note"
              placeholderTextColor={theme.muted}
              multiline
            />
          </View>
          {planName && <Text style={styles.planNote}>{`Part of ${planName}`}</Text>}
          <View style={styles.exerciseSection}>
            <Text style={styles.sectionTitle}>Exercises</Text>
            <View style={styles.exerciseCard}>
              {routine.exercises.map((exercise, index) => (
                <RoutineExerciseRow
                  key={exercise.id || `${exercise.name}-${index}`}
                  exercise={exercise}
                  onRemove={() =>
                    change((current) => ({
                      ...current,
                      exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  onAddSet={() =>
                    change((current) => ({
                      ...current,
                      exercises: current.exercises.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              sets: [
                                ...(item.sets || []),
                                {
                                  id: makeWorkoutId('routine-set'),
                                  weight: '',
                                  reps: '',
                                  targetReps: '8–12',
                                },
                              ],
                            }
                          : item,
                      ),
                    }))
                  }
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add exercises to routine"
                onPress={() => setAddingExercises(true)}
                style={({ pressed }) => [styles.addExercise, pressed && styles.pressed]}
              >
                <Icon name="add" size={17} color={theme.textPrimary} />
                <Text style={styles.addExerciseText}>Add exercises</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        {addingExercises && (
          <AddExerciseSheet
            visible
            onClose={() => setAddingExercises(false)}
            onSubmit={addExercises}
          />
        )}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function RoutineExerciseRow({
  exercise,
  onRemove,
  onAddSet,
}: {
  exercise: { name: string; sets?: unknown[] };
  onRemove: () => void;
  onAddSet: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const count = exercise.sets?.length || 0;
  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseCopy}>
        <Text style={styles.exerciseName} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text
          style={styles.exerciseSets}
        >{`${count} ${count === 1 ? 'set' : 'sets'} · Target 8–12 reps`}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${exercise.name}`}
        onPress={onAddSet}
        style={({ pressed }) => [styles.addSet, pressed && styles.pressed]}
      >
        <Icon name="add" size={16} color={theme.textPrimary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${exercise.name}`}
        onPress={onRemove}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
      >
        <Icon name="trash" size={17} color="#D64848" />
      </Pressable>
    </View>
  );
}

const createStyles = (theme: import('../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      minHeight: 70,
      paddingHorizontal: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    headerTitleWrap: { position: 'absolute', left: 94, right: 94, alignItems: 'center' },
    headerTitle: { ...typeScale.headerTitle, color: theme.ink },
    content: { padding: 16, paddingBottom: 50, gap: 12 },
    sessionCard: {
      borderRadius: theme.cardRadius,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      gap: 0,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    fieldLabel: { ...typeScale.label, color: theme.slate },
    nameInput: {
      ...typeScale.cardTitle,
      color: theme.ink,
      minHeight: 44,
      paddingVertical: 0,
    },
    noteInput: {
      ...typeScale.body,
      color: theme.ink,
      minHeight: 44,
      maxHeight: 64,
      paddingVertical: 0,
      textAlignVertical: 'center',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
    typeRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
    typeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent },
    typeValue: { ...typeScale.body, color: theme.ink, flex: 1 },
    typeChoices: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    typeChoice: {
      minHeight: 40,
      paddingHorizontal: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    choiceDot: { width: 9, height: 9, borderRadius: 5 },
    typeChoiceText: { ...typeScale.body, color: theme.ink, flex: 1 },
    planNote: { ...typeScale.supporting, color: theme.slate, paddingHorizontal: 4 },
    exerciseSection: { gap: 8 },
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    exerciseCard: {
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    exerciseRow: {
      minHeight: 66,
      paddingLeft: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    exerciseCopy: { flex: 1, minWidth: 0 },
    exerciseName: { ...typeScale.cardTitle, color: theme.ink },
    exerciseSets: { ...typeScale.supporting, color: theme.slate, marginTop: 2 },
    addSet: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
    remove: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
    addExercise: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    addExerciseText: { ...typeScale.controlLabel, color: theme.textPrimary },
    unavailable: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    unavailableText: { ...typeScale.body, color: theme.slate },
    pressed: { opacity: 0.55 },
  });
