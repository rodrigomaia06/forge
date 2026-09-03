import React, { useEffect, useState } from 'react';
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
import { usePreventRemove } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import {
  AppScreen,
  Button,
  errorHaptic,
  ForgeActionSheet,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  Icon,
  lightHaptic,
  selectionHaptic,
  successHaptic,
} from '../components/ui';
import { AddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { ExerciseSection } from './activeWorkout/ExerciseSection';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { usePlans } from '../state/PlansContext';
import { useSettings } from '../state/SettingsContext';
import { makeWorkoutId } from '../state/workoutMutations';
import type {
  RootStackParamList,
  WorkoutExercise,
  WorkoutRoutine,
  WorkoutSetChanges,
} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoutineEditor'>;
type AttributeSheetState = { originalLabel?: string; label: string; value: string } | null;
type RoutineDraftChange = (update: (current: WorkoutRoutine) => WorkoutRoutine) => void;

export function RoutineEditorScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { findRoutine, createRoutine, updateRoutine, deleteRoutine, plans, moveRoutine } = usePlans();
  const { preferences } = useSettings();
  const creating = route.params.mode === 'create';
  const viewing = route.params.mode === 'view';
  const source = route.params.mode === 'edit' || route.params.mode === 'view'
    ? findRoutine(route.params.routineId)
    : undefined;
  const [initialDraft] = useState<WorkoutRoutine | null>(() =>
    route.params.mode === 'create'
      ? createRoutineDraft(route.params.planId)
      : (source ? cloneRoutine(source) : null),
  );
  const [draft, setDraft] = useState<WorkoutRoutine | null>(() =>
    initialDraft ? cloneRoutine(initialDraft) : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingExercises, setAddingExercises] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [attributeSheet, setAttributeSheet] = useState<AttributeSheetState>(null);
  const [attributeError, setAttributeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canLeave, setCanLeave] = useState(false);
  const [noteHeight, setNoteHeight] = useState(56);
  const [revealedExerciseId, setRevealedExerciseId] = useState<string | null>(null);
  const [completedRoutineSetIds, setCompletedRoutineSetIds] = useState<string[]>([]);

  const dirty = Boolean(
    draft && initialDraft && JSON.stringify(draft) !== JSON.stringify(initialDraft),
  );
  const leave = (action: () => void): void => {
    setCanLeave(true);
    setTimeout(action, 0);
  };
  const confirmDiscard = (onDiscard: () => void): void =>
    Alert.alert('Discard changes?', 'Your edits to this routine will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => leave(onDiscard) },
    ]);
  usePreventRemove(dirty && !canLeave, ({ data }) => {
    confirmDiscard(() => navigation.dispatch(data.action));
  });

  if (!draft || !initialDraft || (!creating && !source)) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>This routine is unavailable.</Text>
      </View>
    );
  }

  const change = (update: (current: WorkoutRoutine) => WorkoutRoutine): void => {
    setDraft((current) => (current ? update(current) : current));
    setError(null);
  };
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
  const discard = (): void => {
    if (!dirty) return navigation.goBack();
    confirmDiscard(() => navigation.goBack());
  };
  const save = (): void => {
    const name = draft.name.trim();
    const type = draft.type.trim();
    if (!name || !type) return setError('Routine name and workout type are required.');
    if (draft.planId && !plans.some((plan) => plan.id === draft.planId)) {
      return setError('This plan is no longer available. Choose another destination before saving.');
    }
    if ((route.params.mode === 'edit' || route.params.mode === 'view') && !findRoutine(route.params.routineId)) {
      return setError('This routine is no longer available.');
    }
    const saved: WorkoutRoutine = {
      ...draft,
      name,
      type,
      note: optional(draft.note),
      attributes: normalizeAttributes(draft.attributes),
    };
    if (creating) {
      createRoutine(saved);
    } else {
      if (saved.planId !== initialDraft.planId) moveRoutine(saved.id, saved.planId);
      updateRoutine(saved.id, () => saved);
    }
    successHaptic();
    leave(() => navigation.goBack());
  };
  const confirmDelete = (): void =>
    Alert.alert('Delete routine?', 'This cannot be undone.', [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => leave(() => {
          deleteRoutine(draft.id);
          navigation.goBack();
        }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const openAttribute = (label?: string, value = ''): void => {
    setAttributeError(null);
    setAttributeSheet({ originalLabel: label, label: label ?? '', value });
  };
  const saveAttribute = (): void => {
    if (!attributeSheet) return;
    const label = attributeSheet.label.trim();
    const value = attributeSheet.value.trim();
    if (!label) return setAttributeError('Attribute name is required.');
    const duplicate = Object.keys(draft.attributes ?? {}).some(
      (key) =>
        key !== attributeSheet.originalLabel &&
        key.localeCompare(label, undefined, { sensitivity: 'accent' }) === 0,
    );
    if (duplicate) return setAttributeError('An attribute with this label already exists.');
    change((current) => {
      const attributes = { ...(current.attributes ?? {}) };
      if (attributeSheet.originalLabel) delete attributes[attributeSheet.originalLabel];
      attributes[label] = value;
      return { ...current, attributes };
    });
    setAttributeSheet(null);
    successHaptic();
  };
  const removeAttribute = (): void => {
    if (!attributeSheet?.originalLabel) return;
    const label = attributeSheet.originalLabel;
    change((current) => {
      const attributes = { ...(current.attributes ?? {}) };
      delete attributes[label];
      return { ...current, attributes: normalizeAttributes(attributes) };
    });
    setAttributeSheet(null);
    errorHaptic();
  };

  return (
    <AppScreen backgroundColor={theme.background}>
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <HeaderAction
            accessibilityLabel="Cancel editing routine"
            icon="close"
            iconOnly
            onPress={discard}
          />
          <View style={styles.headerTitleWrap} pointerEvents="none">
            <Text style={styles.headerTitle} numberOfLines={1}>
              {creating ? 'New routine' : viewing ? 'Routine' : 'Edit routine'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {!creating && !viewing && (
              <HeaderAction
                accessibilityLabel="Routine options"
                icon="ellipsis-horizontal"
                iconSize={20}
                iconOnly
                onPress={() => setOptionsOpen(true)}
              />
            )}
            {viewing ? (
              <HeaderAction
                accessibilityLabel="Edit routine"
                icon="note"
                iconOnly
                onPress={() => navigation.replace('RoutineEditor', { mode: 'edit', routineId: draft.id })}
              />
            ) : (
              <HeaderAction
                accessibilityLabel="Save routine"
                icon="check"
                iconOnly
                variant="outline"
                tone="success"
                disabled={!draft.name.trim() || !draft.type.trim()}
                haptic="none"
                onPress={save}
              />
            )}
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.sessionCard}>
            <TextInput
              accessibilityLabel="Routine name"
              value={draft.name}
              onChangeText={(name) => change((current) => ({ ...current, name }))}
              editable={!viewing}
              style={styles.nameInput}
              placeholder="Routine name"
              placeholderTextColor={theme.muted}
            />
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Workout type, ${draft.type}`}
              disabled={viewing}
              onPress={() => {
                selectionHaptic();
                setPickerOpen((current) => !current);
              }}
              style={({ pressed }) => [styles.typeRow, pressed && styles.pressed]}
            >
              <Text style={styles.fieldLabel}>Workout type</Text>
              <View
                style={[
                  styles.typeDot,
                  {
                    backgroundColor:
                      preferences.workoutTypes.find((type) => type.name === draft.type)?.color ??
                      theme.muted,
                  },
                ]}
              />
              <Text style={styles.typeValue}>{draft.type}</Text>
              <Icon
                name="chevron-down"
                size={17}
                color={theme.slate}
                style={pickerOpen ? styles.typeChevronExpanded : undefined}
              />
            </Pressable>
            {pickerOpen && (
              <View style={styles.typeChoices}>
                {preferences.workoutTypes
                  .filter((type) => !type.hidden || type.name === draft.type)
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
                      {draft.type === type.name && (
                        <Icon name="check" size={17} color={theme.selectionIndicator} />
                      )}
                    </Pressable>
                  ))}
              </View>
            )}
            <View style={styles.divider} />
            <TextInput
              accessibilityLabel="Routine note"
              value={draft.note || ''}
              onChangeText={(note) => change((current) => ({ ...current, note }))}
              editable={!viewing}
              onContentSizeChange={(event) =>
                setNoteHeight(Math.max(56, Math.min(120, event.nativeEvent.contentSize.height + 20)))
              }
              style={[styles.noteInput, { height: noteHeight }]}
              placeholder="Add a note"
              placeholderTextColor={theme.muted}
              multiline
            />
            {Object.entries(draft.attributes ?? {}).map(([label, value]) => (
              <React.Fragment key={label}>
                <View style={styles.divider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${label} attribute`}
                  disabled={viewing}
                  onPress={() => openAttribute(label, value)}
                  style={({ pressed }) => [styles.attributeRow, pressed && styles.pressed]}
                >
                  <Text style={styles.attributeLabel} numberOfLines={1}>{label}</Text>
                  {value ? <Text style={styles.attributeValue} numberOfLines={1}>{value}</Text> : null}
                  <Icon name="chevron-forward" size={17} color={theme.slate} />
                </Pressable>
              </React.Fragment>
            ))}
            {!viewing && (
              <>
                <View style={styles.divider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add attribute"
                  onPress={() => openAttribute()}
                  style={({ pressed }) => [styles.addAttribute, pressed && styles.pressed]}
                >
                  <Icon name="add" size={18} color={theme.textPrimary} />
                  <Text style={styles.addAttributeText}>Add attribute</Text>
                </Pressable>
              </>
            )}
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.exerciseSection}>
            <Text style={styles.sectionTitle}>Exercises</Text>
            <View pointerEvents={viewing ? 'none' : 'auto'} style={styles.exerciseList}>
              {draft.exercises.map((exercise, index) => {
                const exerciseId = exercise.id ?? `routine-exercise-${index}`;
                return (
                  <ExerciseSection
                    key={exerciseId}
                    index={index}
                    testID={`routine-exercise-${exerciseId}`}
                    exercise={asWorkoutExercise(exercise, completedRoutineSetIds)}
                    addSet={() => addRoutineSet(index, change)}
                    removeSet={(_, setId) => removeRoutineSet(index, setId, change)}
                    removeExercise={() =>
                      change((current) => ({
                        ...current,
                        exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    updateSet={(_, setId, changes) =>
                      updateRoutineSet(index, setId, changes, change)
                    }
                    toggleSet={(_, setId) =>
                      setCompletedRoutineSetIds((current) =>
                        current.includes(setId)
                          ? current.filter((item) => item !== setId)
                          : [...current, setId],
                      )
                    }
                    onSetCompleted={() => undefined}
                    deleteRevealed={revealedExerciseId === exerciseId}
                    onDeleteRevealChange={(id, revealed) =>
                      setRevealedExerciseId(revealed ? id : null)
                    }
                    collapsible
                    showMoreOptions={false}
                    dragHandle={
                      <RoutineExerciseDragHandle
                        name={exercise.name}
                        onMove={(direction) => moveRoutineExercise(index, direction, change)}
                      />
                    }
                  />
                );
              })}
              {!viewing && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add exercises to routine"
                  onPress={() => setAddingExercises(true)}
                  style={({ pressed }) => [styles.addExercise, pressed && styles.pressed]}
                >
                  <Icon name="add" size={17} color={theme.textPrimary} />
                  <Text style={styles.addExerciseText}>Add exercises</Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
        {!creating && !viewing && (
          <ForgeActionSheet
            visible={optionsOpen}
            onClose={() => setOptionsOpen(false)}
            accessibilityLabel="Close routine options"
            title="Routine options"
            testID="routine-options-sheet"
            actions={[
              {
                label: draft.planId ? 'Move to standalone routines' : 'Move to a plan',
                icon: 'layers',
                disabled: !draft.planId && !plans[0],
                onPress: () =>
                  change((current) => ({ ...current, planId: current.planId ? undefined : plans[0]?.id })),
              },
              { label: 'Delete routine', icon: 'trash', tone: 'destructive', onPress: confirmDelete },
            ]}
          />
        )}
        {addingExercises && (
          <AddExerciseSheet visible onClose={() => setAddingExercises(false)} onSubmit={addExercises} />
        )}
        {attributeSheet ? (
          <AttributeEditorSheet
            value={attributeSheet}
            error={attributeError}
            onChange={(next) => {
              setAttributeError(null);
              setAttributeSheet(next);
            }}
            onClose={() => {
              setAttributeError(null);
              setAttributeSheet(null);
            }}
            onSave={saveAttribute}
            onDelete={attributeSheet.originalLabel ? removeAttribute : undefined}
          />
        ) : null}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function AttributeEditorSheet({
  value,
  error,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  value: NonNullable<AttributeSheetState>;
  error: string | null;
  onChange: (value: NonNullable<AttributeSheetState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const editing = Boolean(value.originalLabel);
  return (
    <ForgeBottomSheet
      visible
      onClose={onClose}
      accessibilityLabel="Close attribute editor"
      surfaceTestID="routine-attribute-sheet"
    >
      {(close) => (
        <View style={styles.attributeSheet}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={editing ? 'Edit attribute' : 'Add attribute'}
            onClose={close}
            closePosition={editing ? 'left' : 'right'}
            trailing={
              editing ? (
                <HeaderAction
                  accessibilityLabel="Remove attribute"
                  icon="trash"
                  iconOnly
                  tone="destructive"
                  haptic="none"
                  onPress={onDelete ?? close}
                />
              ) : undefined
            }
          />
          <View style={styles.attributeForm}>
            <View style={styles.attributeFields}>
              <TextInput
                accessibilityLabel="Attribute label"
                value={value.label}
                onChangeText={(label) => onChange({ ...value, label })}
                placeholder="Name"
                placeholderTextColor={theme.textDisabled}
                style={styles.attributeInput}
              />
              <TextInput
                accessibilityLabel="Attribute value"
                value={value.value}
                onChangeText={(nextValue) => onChange({ ...value, value: nextValue })}
                placeholder="Value (optional)"
                placeholderTextColor={theme.textDisabled}
                style={styles.attributeInput}
              />
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Button
              accessibilityLabel="Save attribute"
              label="Save attribute"
              icon="check"
              variant="outline"
              tone="success"
              haptic="none"
              disabled={!value.label.trim()}
              onPress={onSave}
            />
          </View>
        </View>
      )}
    </ForgeBottomSheet>
  );
}

function RoutineExerciseDragHandle({
  name,
  onMove,
}: {
  name: string;
  onMove: (direction: -1 | 1) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const drag = Gesture.Pan()
    .activateAfterLongPress(180)
    .failOffsetX([-24, 24])
    .onStart(() => runOnJS(lightHaptic)())
    .onEnd((event) => {
      if (event.translationY > 30) runOnJS(onMove)(1);
      else if (event.translationY < -30) runOnJS(onMove)(-1);
    });
  return (
    <GestureDetector gesture={drag}>
      <View accessibilityLabel={`Drag to reorder ${name}`} style={styles.routineDragHandle}>
        <Icon name="drag" size={19} color={theme.muted} />
      </View>
    </GestureDetector>
  );
}

function asWorkoutExercise(
  exercise: WorkoutRoutine['exercises'][number],
  completedSetIds: string[],
): WorkoutExercise {
  const exerciseId = exercise.id ?? makeWorkoutId('routine-exercise');
  return {
    id: exerciseId,
    name: exercise.name,
    note: exercise.note,
    sets: (exercise.sets ?? []).map((set, index) => {
      const id = set.id ?? `${exerciseId}-set-${index}`;
      return {
        id,
        weight: set.weight ?? '',
        reps: set.reps ?? '',
        previous: set.previous,
        targetWeight: set.targetWeight,
        targetReps: set.targetReps,
        completed: completedSetIds.includes(id),
      };
    }),
  };
}

function addRoutineSet(index: number, change: RoutineDraftChange): void {
  change((current) => ({
    ...current,
    exercises: current.exercises.map((exercise, itemIndex) =>
      itemIndex === index
        ? {
            ...exercise,
            sets: [
              ...(exercise.sets ?? []),
              { id: makeWorkoutId('routine-set'), weight: '', reps: '', targetReps: '8–12' },
            ],
          }
        : exercise,
    ),
  }));
}

function removeRoutineSet(index: number, setId: string, change: RoutineDraftChange): void {
  change((current) => ({
    ...current,
    exercises: current.exercises.map((exercise, itemIndex) =>
      itemIndex === index
        ? { ...exercise, sets: (exercise.sets ?? []).filter((set) => set.id !== setId) }
        : exercise,
    ),
  }));
}

function updateRoutineSet(
  index: number,
  setId: string,
  changes: WorkoutSetChanges,
  change: RoutineDraftChange,
): void {
  const { completed: _completed, ...setChanges } = changes;
  change((current) => ({
    ...current,
    exercises: current.exercises.map((exercise, itemIndex) =>
      itemIndex === index
        ? {
            ...exercise,
            sets: (exercise.sets ?? []).map((set) =>
              set.id === setId ? { ...set, ...setChanges } : set,
            ),
          }
        : exercise,
    ),
  }));
}

function moveRoutineExercise(
  index: number,
  direction: -1 | 1,
  change: RoutineDraftChange,
): void {
  change((current) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.exercises.length) return current;
    const exercises = [...current.exercises];
    const [moved] = exercises.splice(index, 1);
    exercises.splice(targetIndex, 0, moved);
    return { ...current, exercises };
  });
}

function createRoutineDraft(planId?: string): WorkoutRoutine {
  const now = Date.now();
  return {
    id: makeWorkoutId('routine-draft'),
    name: '',
    type: 'Strength',
    exercises: [],
    planId,
    createdAt: now,
    updatedAt: now,
  };
}

function cloneRoutine(routine: WorkoutRoutine): WorkoutRoutine {
  return JSON.parse(JSON.stringify(routine)) as WorkoutRoutine;
}

function optional(value?: string): string | undefined {
  return value?.trim() || undefined;
}

function normalizeAttributes(attributes?: Record<string, string>): Record<string, string> | undefined {
  const entries = Object.entries(attributes ?? {})
    .map(([label, value]) => [label.trim(), value.trim()] as const)
    .filter(([label]) => Boolean(label));
  return entries.length ? Object.fromEntries(entries) : undefined;
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
    headerTitleWrap: { position: 'absolute', left: 74, right: 74, alignItems: 'center' },
    headerTitle: { ...typeScale.headerTitle, color: theme.ink },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    content: { padding: 16, paddingBottom: 50, gap: 12 },
    sessionCard: {
      overflow: 'hidden',
      borderRadius: theme.cardRadius,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    nameInput: {
      ...typeScale.headerTitle,
      color: theme.ink,
      minHeight: 68,
      paddingHorizontal: 16,
      paddingVertical: 0,
    },
    fieldLabel: {
      ...typeScale.caption,
      color: theme.slate,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    noteInput: {
      ...typeScale.body,
      color: theme.ink,
      minHeight: 56,
      maxHeight: 96,
      paddingHorizontal: 16,
      paddingVertical: 10,
      textAlignVertical: 'center',
      textAlign: 'left',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
    typeRow: {
      minHeight: 56,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    typeDot: { width: 10, height: 10, borderRadius: 5 },
    typeValue: { ...typeScale.body, color: theme.ink, flex: 1 },
    typeChevronExpanded: { transform: [{ rotate: '180deg' }] },
    typeChoices: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    typeChoice: {
      minHeight: 48,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    choiceDot: { width: 9, height: 9, borderRadius: 5 },
    typeChoiceText: { ...typeScale.body, color: theme.ink, flex: 1 },
    attributeRow: {
      minHeight: 56,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    attributeLabel: { ...typeScale.label, color: theme.slate, flex: 1 },
    attributeValue: { ...typeScale.supporting, color: theme.ink, flex: 1, textAlign: 'right' },
    addAttribute: {
      minHeight: 56,
      paddingHorizontal: 16,
      gap: 7,
      flexDirection: 'row',
      alignItems: 'center',
    },
    addAttributeText: { ...typeScale.controlLabel, color: theme.textPrimary },
    error: { ...typeScale.label, color: theme.textDestructive, paddingHorizontal: 4 },
    exerciseSection: { gap: 8 },
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    exerciseList: { gap: 12 },
    routineDragHandle: {
      width: 32,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -8,
    },
    addExercise: {
      minHeight: 50,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.textSecondary,
      borderRadius: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    addExerciseText: { ...typeScale.controlLabel, color: theme.textPrimary },
    attributeSheet: { paddingBottom: 24 },
    attributeForm: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
    attributeFields: { flexDirection: 'row', gap: 10 },
    attributeInput: {
      minHeight: 52,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderRadius: 14,
      borderColor: theme.border,
      backgroundColor: theme.input,
      color: theme.textPrimary,
      ...typeScale.body,
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    unavailable: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    unavailableText: { ...typeScale.body, color: theme.slate },
    pressed: { opacity: 0.55 },
  });
