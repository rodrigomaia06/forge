import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { FlatList as GestureHandlerFlatList } from 'react-native-gesture-handler';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import DraggableFlatList, {
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';

import {
  AppScreen,
  errorHaptic,
  ForgeActionSheet,
  ForgeAttributeEditorSheet,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeConfirmationDialog,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  HeaderEdge,
  Icon,
  lightHaptic,
  selectionHaptic,
  successHaptic,
} from '../components/ui';
import type { ForgeAttributeDraft } from '../components/ui';
import { AddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { ExerciseSection, ReadOnlyExerciseSection } from './activeWorkout/ExerciseSection';
import { useFocusedSetKeyboardLift } from './activeWorkout/useFocusedSetKeyboardLift';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { usePlans } from '../state/PlansContext';
import { useWorkouts } from '../state/WorkoutContext';
import { routineExercisesWithNextSessionTargets } from '../domain/workouts/nextSessionTargets';
import { useSettings } from '../state/SettingsContext';
import { makeWorkoutId } from '../state/workoutMutations';
import { createExerciseSnapshot } from '../domain/exercises/exerciseSnapshot';
import type { ExerciseCatalogItem } from '../data/exerciseCatalog';
import type {
  RootStackParamList,
  WorkoutExercise,
  WorkoutRoutine,
  WorkoutSetChanges,
  WorkoutTypePreference,
} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoutineEditor'>;
type AttributeSheetState = ForgeAttributeDraft | null;
type RoutineDraftChange = (update: (current: WorkoutRoutine) => WorkoutRoutine) => void;
type RoutineConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function RoutineEditorScreen({ navigation, route }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { findRoutine, createRoutine, updateRoutine, deleteRoutine, plans, moveRoutine } = usePlans();
  const { completedWorkouts } = useWorkouts();
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
  // In read-only Visualize, enrich each exercise with the previous session it
  // was last performed so the set table shows history like the live workout.
  const viewingExercises = useMemo(
    () => (viewing && draft ? routineExercisesWithNextSessionTargets(draft, completedWorkouts) : null),
    [viewing, draft, completedWorkouts],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingExercises, setAddingExercises] = useState(false);
  const [replacingExerciseIndex, setReplacingExerciseIndex] = useState<number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [attributeSheet, setAttributeSheet] = useState<AttributeSheetState>(null);
  const [error, setError] = useState<string | null>(null);
  const [canLeave, setCanLeave] = useState(false);
  const [revealedExerciseId, setRevealedExerciseId] = useState<string | null>(null);
  const [completedRoutineSetIds, setCompletedRoutineSetIds] = useState<string[]>([]);
  const [reorderingExercises, setReorderingExercises] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [confirmation, setConfirmation] = useState<RoutineConfirmation | null>(null);
  const changedSinceOpenRef = useRef(false);
  const exerciseListRef = React.useRef<GestureHandlerFlatList<WorkoutRoutine['exercises'][number]>>(null);
  const { onSetInputFocus, onScrollOffsetChange } = useFocusedSetKeyboardLift(exerciseListRef);
  const handleRoutineScrollOffset = (offset: number) => {
    onScrollOffsetChange(offset);
    setHeaderElevated((current) => {
      const next = offset > 1;
      return current === next ? current : next;
    });
  };

  const dirty = changedSinceOpenRef.current || Boolean(
    draft && initialDraft && JSON.stringify(draft) !== JSON.stringify(initialDraft),
  );
  const noteHeight = routineNoteHeight(draft?.note);
  const leave = (action: () => void): void => {
    setCanLeave(true);
    setTimeout(action, 0);
  };
  const confirmDiscard = (onDiscard: () => void): void =>
    setConfirmation({
      title: 'Discard changes?',
      message: 'Your edits to this routine will not be saved.',
      confirmLabel: 'Discard changes',
      onConfirm: () => leave(onDiscard),
    });
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
    // React may batch the final text event with a rapid header press. Record
    // the intent synchronously so Cancel still offers to preserve that draft.
    changedSinceOpenRef.current = true;
    setDraft((current) => (current ? update(current) : current));
    setError(null);
  };
  const addExercises = (exercises: ExerciseCatalogItem[]): void => {
    lightHaptic();
    change((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        ...exercises.map((exercise) => ({
          id: makeWorkoutId('routine-exercise'),
          exerciseId: exercise.id,
          name: exercise.name,
          trackingType: exercise.trackingType,
          exerciseSnapshot: createExerciseSnapshot(exercise),
          sets: Array.from({ length: 3 }, () => ({
            id: makeWorkoutId('routine-set'),
            weight: '',
            reps: '',
          })),
        })),
      ],
    }));
    setAddingExercises(false);
  };
  const replaceExercise = (exercises: ExerciseCatalogItem[]): void => {
    const replacement = exercises[0];
    if (!replacement || replacingExerciseIndex === null) return;
    change((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, index) => index === replacingExerciseIndex ? {
        ...exercise,
        exerciseId: replacement.id,
        name: replacement.name,
        trackingType: replacement.trackingType,
        exerciseSnapshot: createExerciseSnapshot(replacement),
      } : exercise),
    }));
    setReplacingExerciseIndex(null);
  };
  const discard = (): void => {
    if (!(dirty || changedSinceOpenRef.current)) return navigation.goBack();
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
      exercises: draft.exercises.map((exercise) => ({
        ...exercise,
        sets: (exercise.sets ?? []).map(normalizeRoutineSet),
      })),
      ...normalizeAttributes(draft.attributes, draft.attributeIcons),
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
    setConfirmation({
      title: 'Delete routine?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete routine',
      onConfirm: () => leave(() => {
        deleteRoutine(draft.id);
        navigation.goBack();
      }),
    });
  const openAttribute = (label?: string, value = ''): void => {
    setAttributeSheet({ original: label, label: label ?? '', value, icon: draft.attributeIcons?.[label ?? ''] ?? 'note' });
  };
  const saveAttribute = (next: NonNullable<AttributeSheetState>): void => {
    const label = next.label.trim();
    const value = next.value.trim();
    if (!label) return;
    const duplicate = Object.keys(draft.attributes ?? {}).some(
      (key) =>
        key !== next.original &&
        key.localeCompare(label, undefined, { sensitivity: 'accent' }) === 0,
    );
    if (duplicate) return;
    change((current) => {
      const attributes = { ...(current.attributes ?? {}) };
      const attributeIcons = { ...(current.attributeIcons ?? {}) };
      if (next.original) {
        delete attributes[next.original];
        delete attributeIcons[next.original];
      }
      attributes[label] = value;
      attributeIcons[label] = next.icon;
      return { ...current, attributes, attributeIcons };
    });
    setAttributeSheet(null);
    successHaptic();
  };
  const removeAttribute = (): void => {
    if (!attributeSheet?.original) return;
    const label = attributeSheet.original;
    change((current) => {
      const attributes = { ...(current.attributes ?? {}) };
      const attributeIcons = { ...(current.attributeIcons ?? {}) };
      delete attributes[label];
      delete attributeIcons[label];
      return { ...current, ...normalizeAttributes(attributes, attributeIcons) };
    });
    setAttributeSheet(null);
    errorHaptic();
  };
  const renderRoutineExercise = (
    exercise: WorkoutRoutine['exercises'][number],
    index: number,
    drag?: () => void,
    isActive = false,
  ) => {
    const exerciseId = exercise.id ?? `routine-exercise-${index}`;
    if (viewing) {
      return (
        <View style={styles.exerciseRow}>
          <ReadOnlyExerciseSection
            exercise={asWorkoutExercise(viewingExercises?.[index] ?? exercise, completedRoutineSetIds)}
            minimal
          />
        </View>
      );
    }
    const section = (
      <ExerciseSection
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
        updateSet={(_, setId, changes) => updateRoutineSet(index, setId, changes, change)}
        updateExercise={(_, changes) =>
          change((current) => ({
            ...current,
            exercises: current.exercises.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...changes } : item,
            ),
          }))
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
        onDeleteRevealChange={(id, revealed) => setRevealedExerciseId(revealed ? id : null)}
        collapsible
        forceCollapsed={false}
        swipeEnabled={!reorderingExercises && !isActive}
        showMoreOptions={!viewing}
        onReplaceExercise={() => setReplacingExerciseIndex(index)}
        showSetCompletion={false}
        setTargetMode="routine"
        onSetInputFocus={onSetInputFocus}
        dragHandle={
          drag && !viewing ? (
            <RoutineExerciseDragHandle
              name={exercise.name}
              onDrag={drag}
              disabled={isActive}
            />
          ) : undefined
        }
      />
    );
    // Keep the inter-card spacing inside the draggable cell.  A FlatList
    // separator is not included in the cell's measured height, which makes
    // the dropped position drift upwards after a reorder.
    return (
      <View style={styles.exerciseRow}>
        {drag ? (
          <ShadowDecorator elevation={12} radius={14} color={theme.shadow} opacity={0.28}>
            <ScaleDecorator activeScale={1.015}>{section}</ScaleDecorator>
          </ShadowDecorator>
        ) : section}
      </View>
    );
  };
  const addExercisesButton = !viewing ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add exercises to routine"
      onPress={() => setAddingExercises(true)}
      style={({ pressed }) => [styles.addExercise, pressed && styles.pressed]}
    >
      <Icon name="add" size={17} color={theme.textPrimary} />
      <Text style={styles.addExerciseText}>Add exercises</Text>
    </Pressable>
  ) : null;

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: theme.background }]}
        enabled={Platform.OS !== 'ios'}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
      >
        <View style={styles.header}>
          <HeaderAction
            accessibilityLabel="Cancel editing routine"
            icon="close"
            iconOnly
            onPress={discard}
          />
          <View style={[styles.headerTitleWrap, styles.pointerEventsNone]}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {creating ? 'New routine' : viewing ? draft.name.trim() || 'Routine' : 'Edit routine'}
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
          {headerElevated ? <HeaderEdge /> : null}
        </View>
        <DraggableFlatList
          ref={exerciseListRef}
          containerStyle={styles.listViewport}
          style={styles.listViewport}
          data={draft.exercises}
          keyExtractor={(exercise, index) => exercise.id ?? `routine-exercise-${index}`}
          contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          scrollsChildToFocus
          activationDistance={12}
          autoscrollThreshold={70}
          autoscrollSpeed={120}
          dragItemOverflow
          extraData={reorderingExercises}
          animationConfig={{ damping: 28, stiffness: 340, mass: 0.65, overshootClamping: true }}
          onScrollOffsetChange={handleRoutineScrollOffset}
          ListHeaderComponent={
            <View style={styles.listHeader}>
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
                    setPickerOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.typeRow,
                    viewing && styles.viewTypeRow,
                    !viewing && pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.typeLabel}>Type</Text>
                  <View
                    style={[
                      styles.typeSelection,
                      viewing && styles.viewTypeSelection,
                      styles.pointerEventsNone,
                    ]}
                  >
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
                  </View>
                  {!viewing && (
                    <View style={[styles.typeChevron, styles.pointerEventsNone]}>
                      <Icon name="chevron-forward" size={19} color={theme.slate} />
                    </View>
                  )}
                </Pressable>
                {(!viewing || draft.note) && (
                  <>
                    <View style={styles.divider} />
                    <TextInput
                      accessibilityLabel="Routine note"
                      value={draft.note || ''}
                      onChangeText={(note) => change((current) => ({ ...current, note }))}
                      editable={!viewing}
                      style={[styles.noteInput, { height: noteHeight }]}
                      placeholder="Add a note"
                      placeholderTextColor={theme.muted}
                      multiline
                    />
                  </>
                )}
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
                      <Icon name={draft.attributeIcons?.[label] ?? 'note'} size={19} color={theme.textPrimary} />
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
              <Text style={styles.sectionTitle}>Exercises</Text>
            </View>
          }
          ListFooterComponent={addExercisesButton}
          ListFooterComponentStyle={styles.exerciseFooter}
          onDragBegin={() => {
            // Grabbed synchronously from the handle; only flag reorder state and
            // close any revealed row here — never resize rows mid-drag.
            setRevealedExerciseId(null);
            setReorderingExercises(true);
          }}
          onDragEnd={({ data }) => {
            change((current) => ({ ...current, exercises: data }));
            setReorderingExercises(false);
          }}
          onRelease={() => setReorderingExercises(false)}
          renderItem={({ item: exercise, getIndex, drag, isActive }) => {
            const index = getIndex() ?? draft.exercises.indexOf(exercise);
            return index < 0 ? null : renderRoutineExercise(exercise, index, drag, isActive);
          }}
        />
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
          <AddExerciseSheet visible workoutType={draft.type} onClose={() => setAddingExercises(false)} onSubmit={addExercises} />
        )}
        {replacingExerciseIndex !== null && (
          <AddExerciseSheet visible workoutType={draft.type} selectionLimit={1} onClose={() => setReplacingExerciseIndex(null)} onSubmit={replaceExercise} />
        )}
        <RoutineTypePicker
          visible={pickerOpen}
          types={preferences.workoutTypes.filter((type) => !type.hidden || type.name === draft.type)}
          selectedType={draft.type}
          onClose={() => setPickerOpen(false)}
          onSelect={(type) => {
            change((current) => ({ ...current, type }));
            setPickerOpen(false);
          }}
        />
        {attributeSheet ? (
          <ForgeBottomSheet visible onClose={() => setAttributeSheet(null)} accessibilityLabel="Close attribute editor" surfaceTestID="routine-attribute-sheet" style={styles.attributeSheet}>
            {() => <ForgeAttributeEditorSheet value={attributeSheet} onClose={() => setAttributeSheet(null)} onSave={saveAttribute} onDelete={attributeSheet.original ? removeAttribute : undefined} />}
          </ForgeBottomSheet>
        ) : null}
        {confirmation ? (
          <ForgeConfirmationDialog
            visible
            title={confirmation.title}
            message={confirmation.message}
            cancelLabel="Keep editing"
            confirmLabel={confirmation.confirmLabel}
            testID="routine-confirmation-sheet"
            onCancel={() => setConfirmation(null)}
            onConfirm={() => {
              const action = confirmation.onConfirm;
              setConfirmation(null);
              action();
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function RoutineTypePicker({
  visible,
  types,
  selectedType,
  onClose,
  onSelect,
}: {
  visible: boolean;
  types: WorkoutTypePreference[];
  selectedType: string;
  onClose: () => void;
  onSelect: (type: string) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Close workout type selection"
      surfaceTestID="routine-type-selection-sheet"
    >
      {(close) => (
        <View style={styles.typePicker}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title="Workout type" onClose={close} />
          <ScrollView
            testID="routine-type-selection-scroll"
            style={styles.typePickerScroll}
            contentContainerStyle={styles.typePickerContent}
            showsVerticalScrollIndicator={false}
          >
            <View accessibilityRole="radiogroup" style={styles.typePickerList}>
              {types.map((type, index) => {
                const selected = type.name === selectedType;
                return (
                  <Pressable
                    key={type.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Use ${type.name} workout type`}
                    accessibilityState={{ selected, checked: selected }}
                    onPress={() => {
                      selectionHaptic();
                      onSelect(type.name);
                    }}
                    style={({ pressed }) => [
                      styles.typeChoice,
                      index > 0 && styles.typeChoiceDivider,
                      selected && styles.typeChoiceSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.choiceDot, { backgroundColor: type.color }]} />
                    <Text style={styles.typeChoiceText}>{type.name}</Text>
                    {selected && <Icon name="check" size={17} color={theme.success} weight="bold" />}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </ForgeBottomSheet>
  );
}

function RoutineExerciseDragHandle({
  name,
  onDrag,
  disabled,
}: {
  name: string;
  onDrag: () => void;
  disabled: boolean;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Drag to reorder ${name}`}
      accessibilityHint="Hold, then drag to change exercise order"
      disabled={disabled}
      // Web mouse can't long-press to drag, so start the reorder on press-down
      // there; touch keeps long-press so a list scroll is not hijacked.
      {...(Platform.OS === 'web'
        ? { onPressIn: () => { lightHaptic(); onDrag(); } }
        : { delayLongPress: 180, onLongPress: () => { lightHaptic(); onDrag(); } })}
      style={({ pressed }) => [styles.routineDragHandle, pressed && styles.pressed]}
    >
      <Icon name="drag" size={19} color={theme.muted} />
    </Pressable>
  );
}

function asWorkoutExercise(
  exercise: WorkoutRoutine['exercises'][number],
  completedSetIds: string[],
): WorkoutExercise {
  const exerciseId = exercise.id ?? makeWorkoutId('routine-exercise');
  return {
    id: exerciseId,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    note: exercise.note,
    trackingType: exercise.trackingType,
    exerciseSnapshot: exercise.exerciseSnapshot,
    sets: (exercise.sets ?? []).map((set, index) => {
      const id = set.id ?? `${exerciseId}-set-${index}`;
      return {
        id,
        weight: set.weight ?? '',
        reps: set.reps ?? '',
        previous: set.previous,
        tag: set.tag,
        comment: set.comment,
        // Duration and distance do not have legacy string fields. Preserve
        // their structured measurements while rendering the routine draft so
        // input remains visible after the parent updates.
        measurements: set.measurements,
        plannedTargets: routineTargets(set),
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
              { id: makeWorkoutId('routine-set'), weight: '', reps: '' },
            ],
          }
        : exercise,
    ),
  }));
}

/**
 * The original Forge routine model used target-rep fields for its interval.
 * Keep that user data as a routine-only guide while removing the accidental
 * semantic link to a user-authored next-session target.
 */
function normalizeRoutineSet(set: import('../types').WorkoutSetInput): import('../types').WorkoutSetInput {
  const plannedTargets = routineTargets(set);
  const { targetWeight: _targetWeight, targetReps: _targetReps, targets: _targets, ...routineSet } = set;
  return { ...routineSet, ...(plannedTargets.length ? { plannedTargets } : {}) };
}

function routineTargets(set: import('../types').WorkoutSetInput): import('../types').SetTarget[] {
  const permitted = new Set<import('../types').SetMeasurementKind>(['reps', 'duration', 'distance']);
  // An explicit empty planned-target list means the user cleared a range. It
  // must not fall back to the legacy targetReps value and resurrect it.
  const configuredTargets = set.plannedTargets ?? set.targets;
  if (configuredTargets !== undefined) return configuredTargets.filter((target) => permitted.has(target.kind));
  if (!set.targetReps?.trim()) return [];
  const values = set.targetReps.split(/[-–—]/).map((value) => Number(value.trim())).filter(Number.isFinite);
  return values.length ? [{
    id: `${set.id ?? 'routine-set'}-planned-reps`,
    kind: 'reps',
    unit: 'count',
    minValue: values[0],
    maxValue: values[1] ?? values[0],
  }] : [];
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

function routineNoteHeight(note?: string): number {
  const visualLines = (note || '').split('\n').reduce(
    (count, line) => count + Math.max(1, Math.ceil(line.length / 42)),
    0,
  );
  return Math.max(52, Math.min(144, visualLines * 22 + 22));
}

function normalizeAttributes(
  attributes?: Record<string, string>,
  attributeIcons?: Record<string, import('../types').IconName>,
): Pick<WorkoutRoutine, 'attributes' | 'attributeIcons'> {
  const entries = Object.entries(attributes ?? {})
    .map(([label, value]) => [label.trim(), value.trim()] as const)
    .filter(([label]) => Boolean(label));
  const normalizedAttributes = entries.length ? Object.fromEntries(entries) : undefined;
  const normalizedIcons = Object.fromEntries(
    entries
      .map(([label]) => [label, attributeIcons?.[label]] as const)
      .filter((entry): entry is [string, import('../types').IconName] => Boolean(entry[1])),
  );
  return {
    attributes: normalizedAttributes,
    attributeIcons: Object.keys(normalizedIcons).length ? normalizedIcons : undefined,
  };
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
    pointerEventsNone: { pointerEvents: 'none' },
    headerTitle: { ...typeScale.headerTitle, color: theme.ink },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    listViewport: { flex: 1, minHeight: 0 },
    content: { padding: 16, paddingBottom: 50 },
    listHeader: { gap: 12, paddingBottom: 8 },
    sessionCard: {
      overflow: 'hidden',
      borderRadius: theme.cardRadius,
      backgroundColor: theme.surface,
    },
    nameInput: {
      ...typeScale.body,
      color: theme.ink,
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 0,
    },
    typeLabel: {
      ...typeScale.label,
      color: theme.slate,
    },
    noteInput: {
      ...typeScale.body,
      color: theme.ink,
      minHeight: 52,
      maxHeight: 144,
      paddingHorizontal: 16,
      paddingVertical: 15,
      textAlignVertical: 'center',
      textAlign: 'left',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
    typeRow: {
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 7,
      justifyContent: 'center',
      gap: 2,
    },
    viewTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    typeDot: { width: 12, height: 12, borderRadius: 6 },
    typeSelection: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
    viewTypeSelection: { flex: 1, justifyContent: 'flex-end' },
    typeValue: { ...typeScale.body, color: theme.ink, flexShrink: 1 },
    typeChevron: {
      position: 'absolute',
      right: 8,
      top: 6,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typePicker: { maxHeight: '84%', paddingBottom: 24 },
    typePickerScroll: { flexShrink: 1, minHeight: 0 },
    typePickerContent: { paddingBottom: 4 },
    typePickerList: {
      marginHorizontal: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderRadius: 16,
      borderColor: theme.border,
    },
    typeChoice: {
      minHeight: 56,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    typeChoiceDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    typeChoiceSelected: { backgroundColor: theme.surfaceElevated },
    choiceDot: { width: 11, height: 11, borderRadius: 6 },
    typeChoiceText: { ...typeScale.controlLabel, color: theme.ink, flex: 1 },
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
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    exerciseRow: { paddingBottom: 12 },
    exerciseFooter: { marginTop: 0 },
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
