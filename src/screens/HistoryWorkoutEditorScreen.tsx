import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import { ScrollView as GestureScrollView, type FlatList as GestureHandlerFlatList } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist';

import {
  AppScreen,
  ForgeActionSheet,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeDateTimePicker,
  ForgeAttributeEditorSheet,
  ForgeBackButton,
  ForgeSwipeableAttributeRow,
  ForgeSwitch,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  ForgeWorkoutTypeSheet,
  HeaderAction,
  HeaderEdge,
  Icon,
  lightHaptic,
  pressedFeedback,
  pressedFeedbackSubtle,
  selectionHaptic,
  successHaptic,
} from '../components/ui';
import { ExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { useFocusedSetKeyboardLift } from './activeWorkout/useFocusedSetKeyboardLift';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useForgeReducedMotion } from '../theme/motion';
import { animateLayout } from './activeWorkout/activeWorkoutFeedback';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { useActiveWorkout, useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { usePlans } from '../state/PlansContext';
import { parseCalendarDate } from '../domain/workouts/calendarDate';
import {
  addExerciseToWorkout,
  addSetToWorkout,
  removeExerciseFromWorkout,
  removeSetFromWorkout,
  toggleWorkoutSet,
  updateWorkoutSet,
  updateWorkoutExercise,
  createWorkout,
  addWarmupSetsToWorkout,
} from '../state/workoutMutations';
import type { RootStackParamList, Workout, WorkoutExercise } from '../types';
import { workoutTypeIcon } from './settings/workoutTypeIcon';
import { createExerciseSnapshot } from '../domain/exercises/exerciseSnapshot';

type Props = NativeStackScreenProps<RootStackParamList, 'HistoryWorkoutEditor'>;

export function HistoryWorkoutEditorScreen({ navigation, route }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const activeWorkout = useActiveWorkout();
  const {
    completedWorkouts,
    createCompletedWorkout,
    updateCompletedWorkout,
    updateActiveWorkout,
  } = useWorkouts();
  const { preferences } = useSettings();
  const { plans, standaloneRoutines } = usePlans();
  const params = route.params;
  const isCreating = params.mode === 'create';
  const isActive = params.mode === 'active';
  const selectedCalendarDate = parseCalendarDate(
    params.mode === 'create' ? params.selectedDate : undefined,
    new Date(),
  );
  const source = params.mode === 'active'
    ? activeWorkout
    : params.mode === 'edit'
      ? completedWorkouts.find((workout) => workout.id === params.workoutId)
      : undefined;
  const initialDraftRef = useRef<Workout | null>(null);
  // Keep action handlers current even when a TextInput event and a header
  // action happen in the same native batch. React state remains the render
  // source; this ref prevents an immediate Cancel or Save using stale text.
  const draftRef = useRef<Workout | null>(null);
  const [draft, setDraft] = useState<Workout | null>(() => {
    const initial = isCreating ? createHistoricalDraft(selectedCalendarDate) : source ? cloneWorkout(source) : null;
    initialDraftRef.current = initial ? cloneWorkout(initial) : null;
    draftRef.current = initial;
    return initial;
  });
  const [startTimeChosen, setStartTimeChosen] = useState(!isCreating);
  const [endTimeChosen, setEndTimeChosen] = useState(!isCreating);
  const [picker, setPicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [pickerDraft, setPickerDraft] = useState<number | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [attributeDraft, setAttributeDraft] = useState<import('../components/ui').ForgeAttributeDraft | null>(null);
  const [reorderingExercises, setReorderingExercises] = useState(false);
  const [sourceStep, setSourceStep] = useState<'source' | 'routine-list' | { planId: string } | null>(
    isCreating ? 'source' : null,
  );
  const sourceActionTakenRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const pendingNavigationActionRef = useRef<(() => void) | null>(null);
  const exerciseListRef = useRef<GestureHandlerFlatList<WorkoutExercise>>(null);
  const { onSetInputFocus, onScrollOffsetChange } = useFocusedSetKeyboardLift(exerciseListRef);

  const leaveEditor = (completedAt?: number): void => {
    // Every mode is now guarded (see usePreventRemove below), so a deliberate
    // leave (Save, or a confirmed discard) must flag itself as allowed or the
    // guard would re-prompt on the way out.
    allowNavigationRef.current = true;
    if (isActive) {
      navigation.goBack();
      return;
    }
    navigation.popTo('MainTabs', { screen: 'History' });
  };

  const dirty = useMemo(
    () => isCreating
      ? Boolean(draft && (startTimeChosen || endTimeChosen || JSON.stringify(initialDraftRef.current) !== JSON.stringify(draft)))
      // Derive edit dirtiness from the draft rather than an event flag. Native
      // TextInput updates and a fast Cancel press can otherwise observe the
      // old flag for one render and discard a real change without confirmation.
      : Boolean(draft && JSON.stringify(initialDraftRef.current) !== JSON.stringify(draft)),
    [draft, endTimeChosen, isCreating, startTimeChosen],
  );
  const updateDraft = (update: (current: Workout) => Workout): void => {
    const current = draftRef.current;
    const next = current ? update(current) : null;
    draftRef.current = next;
    setDraft(next);
    setError(null);
  };
  const hasUnsavedChanges = (): boolean => {
    const current = draftRef.current;
    if (!current) return false;
    return isCreating
      ? startTimeChosen || endTimeChosen || JSON.stringify(initialDraftRef.current) !== JSON.stringify(current)
      : JSON.stringify(initialDraftRef.current) !== JSON.stringify(current);
  };
  const discard = (): void => {
    if (!hasUnsavedChanges()) return leaveEditor(draftRef.current?.completedAt ?? draftRef.current?.startedAt);
    setDiscardConfirmationOpen(true);
  };
  // Read the allow-navigation ref inside the callback rather than folding it into
  // the prevent flag: a ref change does not re-render, so a stale `true` flag was
  // showing the discard prompt on the first Save after an edit (e.g. reordering).
  usePreventRemove(dirty, ({ data }) => {
    if (allowNavigationRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    pendingNavigationActionRef.current = () => navigation.dispatch(data.action);
    setDiscardConfirmationOpen(true);
  });
  const save = async (): Promise<void> => {
    const currentDraft = draftRef.current;
    if (!currentDraft) return;
    if (!currentDraft.name.trim() || !currentDraft.type.trim())
      return setError('Name and workout type are required.');
    if (isCreating && (!startTimeChosen || !endTimeChosen))
      return setError('Choose a start and end time.');
    const completedAt = currentDraft.completedAt ?? currentDraft.startedAt;
    if (!isActive && (
      Number.isNaN(new Date(currentDraft.startedAt).getTime()) ||
      Number.isNaN(new Date(completedAt).getTime())
    )) return setError('Choose a valid date and time.');
    const durationSeconds = isActive
      ? currentDraft.durationSeconds
      : Math.round((completedAt - currentDraft.startedAt) / 1000);
    if (!isActive && (durationSeconds ?? 0) < 1) return setError('End time must be after the start time.');
    const { location: _location, mood: _mood, ...withoutLegacyMetadata } = currentDraft as Workout & { location?: string; mood?: string };
    const { attributes, attributeIcons } = normalizeAttributes(currentDraft.attributes, currentDraft.attributeIcons);
    const saved: Workout = {
      ...withoutLegacyMetadata,
      name: currentDraft.name.trim(),
      type: currentDraft.type.trim(),
      note: currentDraft.note.trim(),
      attributes,
      attributeIcons,
      averageRestSeconds: currentDraft.averageRestSeconds,
      durationSeconds,
    };
    if (isCreating) await createCompletedWorkout(saved);
    else if (isActive) updateActiveWorkout(() => saved);
    else await updateCompletedWorkout(saved.id, () => saved);
    successHaptic();
    leaveEditor(completedAt);
  };

  if (!draft || (!isCreating && !source)) return null;
  const startedAt = new Date(draft.startedAt);
  const completedAt = new Date(draft.completedAt ?? draft.startedAt);
  const setDate = (next: Date): void =>
    updateDraft((current) => ({
      ...current,
      startedAt: setDatePart(new Date(current.startedAt), next).getTime(),
      completedAt: setDatePart(new Date(current.completedAt ?? current.startedAt), next).getTime(),
    }));
  const setTime = (kind: 'start' | 'end', next: Date): void =>
    updateDraft((current) => {
      const currentValue =
        kind === 'start' ? current.startedAt : (current.completedAt ?? current.startedAt);
      const updated = setTimePart(new Date(currentValue), next).getTime();
      return kind === 'start'
        ? { ...current, startedAt: updated }
        : { ...current, completedAt: updated };
    });
  const openPicker = (kind: 'date' | 'start' | 'end'): void => {
    lightHaptic();
    const value = kind === 'end' ? completedAt : startedAt;
    setPickerDraft(value.getTime());
    setPicker(kind);
  };
  const closePicker = (): void => {
    setPicker(null);
    setPickerDraft(null);
  };
  const savePicker = (): void => {
    if (!picker || pickerDraft === null) return;
    const next = new Date(pickerDraft);
    if (picker === 'date') setDate(next);
    else {
      setTime(picker, next);
      if (picker === 'start') setStartTimeChosen(true);
      else setEndTimeChosen(true);
    }
  };
  const timingInvalid = !isActive && startTimeChosen && endTimeChosen && completedAt.getTime() <= startedAt.getTime();
  const saveDisabled = !draft.name.trim() || !draft.type.trim() || (isCreating && (!startTimeChosen || !endTimeChosen || timingInvalid));
  const validationMessage = error || (timingInvalid ? 'End time must be after the start time.' : null);
  const availableWorkoutTypes = preferences.workoutTypes.filter(
    (type) => !type.hidden || type.name === draft.type,
  );
  const selectedWorkoutType = availableWorkoutTypes.find((type) => type.name === draft.type)
    ?? { id: 'retained-history-type', name: draft.type, color: theme.ink, source: 'custom' as const, hidden: true };
  const selectRoutine = (routine: import('../types').WorkoutRoutine, plan?: import('../types').WorkoutPlan): void => {
    selectionHaptic();
    const next = createHistoricalDraft(selectedCalendarDate, routine, plan);
    initialDraftRef.current = cloneWorkout(next);
    draftRef.current = next;
    setDraft(next);
    setStartTimeChosen(false);
    setEndTimeChosen(false);
    setSourceStep(null);
  };
  const renderExercise = (
    exercise: WorkoutExercise,
    index: number,
    drag?: () => void,
    isDragging = false,
  ) => {
    const section = (
      <ExerciseSection
        key={exercise.id}
        exercise={exercise}
        index={index}
        addSet={(exerciseId) =>
          updateDraft((current) => addSetToWorkout(current, exerciseId) as Workout)
        }
        removeSet={(exerciseId, setId) =>
          updateDraft(
            (current) => removeSetFromWorkout(current, exerciseId, setId) as Workout,
          )
        }
        removeExercise={(exerciseId) =>
          updateDraft(
            (current) => removeExerciseFromWorkout(current, exerciseId) as Workout,
          )
        }
        updateExercise={(exerciseId, changes) =>
          updateDraft(
            (current) => updateWorkoutExercise(current, exerciseId, changes) as Workout,
          )
        }
        addWarmupSets={isActive ? (exerciseId, sets) =>
          updateDraft(
            (current) => addWarmupSetsToWorkout(current, exerciseId, sets) as Workout,
          ) : undefined}
        updateSet={(exerciseId, setId, changes) =>
          updateDraft(
            (current) => updateWorkoutSet(current, exerciseId, setId, changes) as Workout,
          )
        }
        toggleSet={(exerciseId, setId) =>
          updateDraft((current) => toggleWorkoutSet(current, exerciseId, setId) as Workout)
        }
        // The active editor is a local draft: only the normal Live Workout list
        // can start or adjust the rest timer when a set is completed.
        onSetCompleted={() => undefined}
        // Keep the active-workout draft structurally and visually identical
        // to the routine editor. It deliberately excludes live-only metadata,
        // completion state and next-session targets until the workout is
        // logged from the actual Live Workout screen.
        collapsible={isActive}
        forceCollapsed={false}
        showMoreOptions
        showSetCompletion={!isActive}
        onSetInputFocus={isActive ? onSetInputFocus : undefined}
        deleteRevealed={openExerciseId === exercise.id}
        onDeleteRevealChange={(exerciseId, revealed) =>
          setOpenExerciseId(revealed ? exerciseId : null)
        }
        dragHandle={isActive && drag ? (
          <WorkoutExerciseDragHandle
            name={exercise.name}
            disabled={isDragging}
            onDrag={drag}
          />
        ) : undefined}
      />
    );
    // The reorder decorators wrap each row in reanimated views that swallow the
    // drag gesture on web, so the list would not reorder there. Render the row
    // directly; the drag still tracks and reorders on every platform.
    return isActive && drag ? (
      <View style={styles.draggableExerciseRow}>{section}</View>
    ) : section;
  };
  const addExerciseButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add exercise"
      onPress={() => {
        lightHaptic();
        setAddExerciseOpen(true);
      }}
      style={({ pressed }) => [styles.addExercise, pressed && pressedFeedback]}
    >
      <Icon name="add" size={17} color={theme.ink} />
      <Text style={styles.addExerciseText}>Add exercise</Text>
    </Pressable>
  );
  const editorForm = (
    <ForgeCard style={styles.formCard}>
      <View style={styles.identityGroup}>
        <View style={styles.identityField}>
          <Text style={styles.fieldLabel}>Workout name</Text>
          <TextInput
            accessibilityLabel="Workout name"
            value={draft.name}
            onChangeText={(name) => updateDraft((current) => ({ ...current, name }))}
            // Keep the DOM event path as a Web fallback. React Native Web
            // forwards both handlers from the same input event; native uses
            // onChangeText as normal.
            onChange={(event) => updateDraft((current) => ({
              ...current,
              name: textInputChangeText(event),
            }))}
            onEndEditing={(event) => updateDraft((current) => ({ ...current, name: textInputChangeText(event) }))}
            numberOfLines={1}
            style={styles.nameInput}
          />
        </View>
        <View style={styles.identityDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose workout type"
          onPress={() => {
            lightHaptic();
            setTypeSheetOpen(true);
          }}
          style={({ pressed }) => [styles.identityField, styles.typePicker, pressed && pressedFeedbackSubtle]}
        >
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typePickerValue}>
            <Icon name={workoutTypeIcon(selectedWorkoutType)} size={20} color={theme.ink} />
            <Text numberOfLines={1} style={styles.typeText}>{draft.type}</Text>
            <Icon name="chevron-forward" size={18} color={theme.slate} />
          </View>
        </Pressable>
      </View>
      <View style={styles.cardDivider} />
      <Field
        label="Notes"
        value={draft.note}
        multiline
        onChangeText={(note) => updateDraft((current) => ({ ...current, note }))}
      />
      <View style={styles.cardDivider} />
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: Boolean(draft.excludeFromTargets) }}
        accessibilityLabel="Don't count this workout toward next-session targets"
        onPress={() => {
          lightHaptic();
          updateDraft((current) => ({ ...current, excludeFromTargets: !current.excludeFromTargets }));
        }}
        style={({ pressed }) => [styles.targetToggleRow, pressed && pressedFeedbackSubtle]}
      >
        <View style={styles.targetToggleCopy}>
          <Text style={styles.fieldLabel}>Off-plan session</Text>
          <Text style={styles.targetToggleHint}>Won't affect future targets.</Text>
        </View>
        <ForgeSwitch value={Boolean(draft.excludeFromTargets)} />
      </Pressable>
      <View style={styles.cardDivider} />
      <View style={styles.attributesSection}>
        <Text style={styles.attributesTitle}>Attributes</Text>
        <ForgeCard variant="nested" size="compact">
          {Object.entries(draft.attributes ?? {}).map(([label, value], index) => (
            <ForgeSwipeableAttributeRow
              key={label}
              label={label}
              value={value}
              icon={draft.attributeIcons?.[label] ?? 'note'}
              divider={index > 0}
              onEdit={() => setAttributeDraft({ original: label, label, value, icon: draft.attributeIcons?.[label] ?? 'note' })}
              onDelete={() => updateDraft((current) => {
                const attributes = { ...(current.attributes ?? {}) };
                const attributeIcons = { ...(current.attributeIcons ?? {}) };
                delete attributes[label];
                delete attributeIcons[label];
                return { ...current, attributes: Object.keys(attributes).length ? attributes : undefined, attributeIcons: Object.keys(attributeIcons).length ? attributeIcons : undefined };
              })}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add attribute"
            onPress={() => {
              lightHaptic();
              setAttributeDraft({ label: '', value: '', icon: 'note' });
            }}
            style={({ pressed }) => [styles.addAttribute, { backgroundColor: theme.surface }, Object.keys(draft.attributes ?? {}).length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }, pressed && pressedFeedbackSubtle]}
          >
            <Icon name="add" size={20} color={theme.ink} />
            <Text style={styles.addAttributeText}>Add attribute</Text>
          </Pressable>
        </ForgeCard>
      </View>
      {!isActive && <>
        <View style={styles.cardDivider} />
        <PickerButton label="Date" value={dateInput(startedAt)} onPress={() => openPicker('date')} />
        <View style={styles.formRow}>
          <PickerButton label="Start time" value={startTimeChosen ? timeInput(startedAt) : 'Choose time'} onPress={() => openPicker('start')} />
          <PickerButton label="End time" value={endTimeChosen ? timeInput(completedAt) : 'Choose time'} onPress={() => openPicker('end')} />
        </View>
      </>}
      {validationMessage && (
        <Text accessibilityRole="alert" style={styles.error}>{validationMessage}</Text>
      )}
    </ForgeCard>
  );
  return (
    <AppScreen
      edges={['top']}
      backgroundColor={theme.background}
      testID={isActive ? 'active-workout-editor' : 'history-workout-editor'}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <HeaderAction
            accessibilityLabel="Cancel editing workout"
            icon="close"
            iconOnly
            onPress={discard}
          />
          <View style={styles.headerSpacer} />
          <HeaderAction
            accessibilityLabel="Save workout"
            icon="check"
            iconOnly
            variant="outline"
            tone="success"
            onPress={save}
            haptic="none"
            disabled={saveDisabled}
          />
        </View>
        {headerElevated ? <HeaderEdge /> : null}
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isActive ? (
          <DraggableFlatList
            ref={exerciseListRef}
            style={styles.listViewport}
            containerStyle={styles.listViewport}
            data={draft.exercises}
            keyExtractor={(exercise) => exercise.id}
            contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            scrollsChildToFocus
            activationDistance={12}
            autoscrollThreshold={70}
            autoscrollSpeed={120}
            dragItemOverflow
            extraData={reorderingExercises}
            animationConfig={{ damping: 28, stiffness: 340, mass: 0.65, overshootClamping: true }}
            onScrollOffsetChange={(offset) => {
              onScrollOffsetChange(offset);
              setHeaderElevated(offset > 1);
            }}
            ListHeaderComponent={<View style={styles.listHeader}>{editorForm}<Text style={styles.sectionTitle}>Exercises</Text></View>}
            ListFooterComponent={<View style={styles.exerciseFooter}>{addExerciseButton}</View>}
            onDragBegin={() => {
              // Drag is grabbed synchronously from the handle's long-press; only
              // flag reorder state and close any revealed delete here — never
              // change row heights mid-drag, which would make the item snap.
              setOpenExerciseId(null);
              setReorderingExercises(true);
            }}
            onDragEnd={({ data }) => {
              updateDraft((current) => ({ ...current, exercises: data }));
              setReorderingExercises(false);
            }}
            renderItem={({ item: exercise, getIndex, drag, isActive: itemIsActive }) => {
              const index = getIndex() ?? draft.exercises.indexOf(exercise);
              return index < 0 ? null : renderExercise(exercise, index, drag, itemIsActive);
            }}
          />
        ) : (
          <GestureScrollView
            // A gesture-handler ScrollView so it arbitrates the vertical pan with
            // the exercise cards' and set rows' horizontal swipe recognizers; a
            // plain RN ScrollView loses that arbitration and cannot scroll over
            // the cards.
            contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
            scrollEventThrottle={16}
          >
            {editorForm}
            <Text style={styles.sectionTitle}>Exercises</Text>
            <View style={styles.exerciseList}>
              {draft.exercises.map((exercise, index) => renderExercise(exercise, index))}
              {addExerciseButton}
            </View>
          </GestureScrollView>
        )}
      </KeyboardAvoidingView>
      <AddExerciseSheet
        visible={addExerciseOpen}
        workoutType={draft.type}
        onClose={() => setAddExerciseOpen(false)}
        onSubmit={(exercises) => {
          animateLayout(reducedMotion);
          exercises.forEach((exercise) =>
            updateDraft((current) => addExerciseToWorkout(current, { exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: createExerciseSnapshot(exercise) }) as Workout),
          );
          setAddExerciseOpen(false);
        }}
      />
      <ForgeBottomSheet
        visible={picker !== null && pickerDraft !== null}
        onClose={closePicker}
        accessibilityLabel="Close date and time picker"
        initialOffset={360}
        closeDistance={420}
        surfaceTestID="history-date-time-picker-surface"
        style={styles.pickerSheet}
      >
        {(close) => picker && pickerDraft !== null ? (
          <>
            <ForgeBottomSheetHandle />
            <ForgeSheetHeader
              title={picker === 'date' ? 'Date' : picker === 'start' ? 'Start time' : 'End time'}
              onClose={close}
              closePosition="left"
              closeAccessibilityLabel="Close date and time picker"
              // The sheet surface already insets 20; keep the header's own inset at 0
              // so Close and the commit action sit on that same gutter, aligned with
              // the calendar below (see pickerBody).
              horizontalInset={0}
              trailing={
                // Match the Close affordance exactly — the shared tonal circle Forge
                // uses for sheet Close and the dashboard "Done" — so the two read as a
                // balanced pair instead of a heavy primary pill.
                <HeaderAction
                  accessibilityLabel="Save selected date and time"
                  icon="check"
                  iconOnly
                  haptic="light"
                  onPress={() => {
                    savePicker();
                    close();
                  }}
                  style={{
                    backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated,
                    borderColor: theme.border,
                  }}
                />
              }
            />
            <View style={styles.pickerBody}>
              <ForgeDateTimePicker
                mode={picker === 'date' ? 'date' : 'time'}
                value={new Date(pickerDraft)}
                onChange={(next) => setPickerDraft(next.getTime())}
                weekStartsOn={preferences.weekStartsOn}
                testID={`history-${picker}-picker`}
              />
            </View>
          </>
        ) : null}
      </ForgeBottomSheet>
      <ForgeWorkoutTypeSheet
        visible={typeSheetOpen}
        onClose={() => setTypeSheetOpen(false)}
        types={availableWorkoutTypes}
        selectedType={draft.type}
        onSelect={(type) => updateDraft((current) => ({ ...current, type }))}
        testID="history-type-sheet"
      />
      <ForgeBottomSheet
        visible={attributeDraft !== null}
        onClose={() => setAttributeDraft(null)}
        accessibilityLabel="Close attribute editor"
        initialOffset={420}
        closeDistance={460}
        style={styles.editorSheet}
        animateContentLayout={false}
      >
        {() => attributeDraft ? (
          <ForgeAttributeEditorSheet
            value={attributeDraft}
            onClose={() => setAttributeDraft(null)}
            onSave={(next) => {
              const label = next.label.trim();
              const existing = draft.attributes ?? {};
              if (!label || (label !== next.original && existing[label] !== undefined)) return;
              updateDraft((current) => {
                const attributes = { ...(current.attributes ?? {}) };
                const attributeIcons = { ...(current.attributeIcons ?? {}) };
                if (next.original) {
                  delete attributes[next.original];
                  delete attributeIcons[next.original];
                }
                attributes[label] = next.value.trim();
                attributeIcons[label] = next.icon;
                return { ...current, attributes, attributeIcons };
              });
              setAttributeDraft(null);
            }}
            onDelete={attributeDraft.original ? () => {
              const label = attributeDraft.original!;
              updateDraft((current) => {
                const attributes = { ...(current.attributes ?? {}) };
                const attributeIcons = { ...(current.attributeIcons ?? {}) };
                delete attributes[label];
                delete attributeIcons[label];
                return { ...current, attributes: Object.keys(attributes).length ? attributes : undefined, attributeIcons: Object.keys(attributeIcons).length ? attributeIcons : undefined };
              });
              setAttributeDraft(null);
            } : undefined}
          />
        ) : null}
      </ForgeBottomSheet>
      <ForgeActionSheet
        visible={sourceStep !== null}
        onClose={() => {
          if (sourceActionTakenRef.current) {
            sourceActionTakenRef.current = false;
            return;
          }
          discard();
        }}
        accessibilityLabel="Close historical workout source chooser"
        title="Add historical workout"
        titleNumberOfLines={2}
        emphasis="prominent"
        backdropIntensity="strong"
        waitForContentLayoutBeforeEnter
        actions={[
          {
            label: 'Blank workout',
            description: 'Start a fresh historical entry.',
            icon: 'add',
            onPress: () => { sourceActionTakenRef.current = true; setSourceStep(null); },
          },
          {
            label: 'From routine or plan',
            description: 'Copy a routine’s exercises and setup.',
            accessibilityLabel: 'From routine',
            icon: 'layers',
            // Keep this sheet mounted and swap its content to the routine
            // chooser, so it continues from this card rather than dismissing
            // and re-presenting a second sheet.
            dismiss: false,
            onPress: () => setSourceStep('routine-list'),
          },
        ]}
        testID="historical-workout-source-chooser"
        replacement={sourceStep !== null && sourceStep !== 'source' ? (closeSheet) => (
          <HistoryRoutineSourceContent
            step={sourceStep}
            plans={plans}
            standaloneRoutines={standaloneRoutines}
            closeSheet={closeSheet}
            onBack={() =>
              setSourceStep((current) =>
                current && typeof current === 'object' ? 'routine-list' : 'source',
              )
            }
            onChoosePlan={(planId) => setSourceStep({ planId })}
            onSelectRoutine={selectRoutine}
          />
        ) : null}
      />
      <ForgeConfirmationDialog
        visible={discardConfirmationOpen}
        title="Discard changes?"
        message="Your edits to this workout will not be saved."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => setDiscardConfirmationOpen(false)}
        onConfirm={() => {
          setDiscardConfirmationOpen(false);
          const pendingNavigation = pendingNavigationActionRef.current;
          pendingNavigationActionRef.current = null;
          if (pendingNavigation) {
            allowNavigationRef.current = true;
            pendingNavigation();
          } else {
            leaveEditor(draft.completedAt ?? draft.startedAt);
          }
        }}
        testID={isActive ? 'discard-active-workout-editor-confirmation' : 'discard-history-workout-confirmation'}
      />
    </AppScreen>
  );
}

function HistoryPickerBackButton({ onPress }: { onPress: () => void }) {
  return <ForgeBackButton accessibilityLabel="Back to edit workout" onPress={onPress} />;
}

function HistoryRoutineSourceContent({
  step,
  plans,
  standaloneRoutines,
  closeSheet,
  onBack,
  onChoosePlan,
  onSelectRoutine,
}: {
  step: 'routine-list' | { planId: string };
  plans: import('../types').WorkoutPlan[];
  standaloneRoutines: import('../types').WorkoutRoutine[];
  closeSheet: () => void;
  onBack: () => void;
  onChoosePlan: (planId: string) => void;
  onSelectRoutine: (routine: import('../types').WorkoutRoutine, plan?: import('../types').WorkoutPlan) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const selectedPlan = typeof step === 'object' ? plans.find((plan) => plan.id === step.planId) : undefined;
  return (
    <View>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title={selectedPlan ? selectedPlan.name : 'Choose routine'}
        onClose={closeSheet}
        closeAccessibilityLabel="Close routine chooser"
        leading={<HistoryPickerBackButton onPress={onBack} />}
      />
      <ScrollView style={styles.sourceScroll} contentContainerStyle={styles.sourceContent} showsVerticalScrollIndicator={false}>
            {selectedPlan ? (
              selectedPlan.routines.length ? (
                <RoutineChoiceCard routines={selectedPlan.routines} onPress={(routine) => onSelectRoutine(routine, selectedPlan)} />
              ) : <Text style={styles.emptySourceText}>This plan has no routines yet.</Text>
            ) : (
              <>
                {standaloneRoutines.length ? <View style={styles.sourceGroup}>
                  <Text style={styles.sourceLabel}>Standalone routines</Text>
                  <RoutineChoiceCard routines={standaloneRoutines} onPress={(routine) => onSelectRoutine(routine)} />
                </View> : null}
                {plans.length ? <View style={styles.sourceGroup}>
                  <Text style={styles.sourceLabel}>Plans</Text>
                  <ForgeCard variant="nested" size="compact">
                    {plans.map((plan, index) => (
                      <Pressable
                        key={plan.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Choose routine from ${plan.name}`}
                        onPress={() => {
                          lightHaptic();
                          // A plan is only a container; the next view requires a concrete routine.
                          onChoosePlan(plan.id);
                        }}
                        style={({ pressed }) => [styles.sourceRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }, pressed && pressedFeedbackSubtle]}
                      >
                        <Icon name="layers" size={21} color={theme.ink} />
                        <View style={styles.sourceRowText}>
                          <Text style={styles.sourceRowLabel}>{plan.name}</Text>
                          <Text style={styles.sourceRowDetail}>{plan.routines.length === 1 ? '1 routine' : `${plan.routines.length} routines`}</Text>
                        </View>
                        <Icon name="chevron-forward" size={20} color={theme.slate} />
                      </Pressable>
                    ))}
                  </ForgeCard>
                </View> : null}
                {!standaloneRoutines.length && !plans.length ? <Text style={styles.emptySourceText}>Create a routine first, then use it as an editable historical-workout starting point.</Text> : null}
              </>
            )}
      </ScrollView>
    </View>
  );
}

function RoutineChoiceCard({
  routines,
  onPress,
}: {
  routines: import('../types').WorkoutRoutine[];
  onPress: (routine: import('../types').WorkoutRoutine) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  return (
    <ForgeCard variant="nested" size="compact">
      {routines.map((routine, index) => {
        const type = preferences.workoutTypes.find((item) => item.name === routine.type)
          ?? { id: 'retained-routine-type', name: routine.type, color: theme.ink, source: 'custom' as const, hidden: true };
        return <Pressable key={routine.id} accessibilityRole="button" accessibilityLabel={`Use ${routine.name} routine`} onPress={() => onPress(routine)} style={({ pressed }) => [styles.sourceRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }, pressed && pressedFeedbackSubtle]}>
          <Icon name={workoutTypeIcon(type)} size={21} color={theme.ink} />
          <View style={styles.sourceRowText}>
            <Text style={styles.sourceRowLabel}>{routine.name}</Text>
            <Text style={styles.sourceRowDetail}>{routine.type}</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={theme.slate} />
        </Pressable>;
      })}
    </ForgeCard>
  );
}

function WorkoutExerciseDragHandle({
  name,
  disabled,
  onDrag,
}: {
  name: string;
  disabled: boolean;
  onDrag: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Drag to reorder ${name}`}
      accessibilityHint="Hold, then drag to change exercise order"
      disabled={disabled}
      delayLongPress={180}
      onLongPress={() => {
        lightHaptic();
        onDrag();
      }}
      style={({ pressed }) => [styles.dragHandle, pressed && pressedFeedback]}
    >
      <Icon name="drag" size={19} color={theme.muted} />
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  multiline?: boolean;
  style?: object;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onChange={(event) => onChangeText(textInputChangeText(event))}
        onEndEditing={(event) => onChangeText(textInputChangeText(event))}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.notesInput]}
      />
    </View>
  );
}

/** React Native uses nativeEvent.text; React Native Web exposes DOM value. */
function textInputChangeText(event: { nativeEvent: { text: string }; target: unknown }): string {
  const target = event.target as { value?: unknown } | null;
  return typeof target?.value === 'string' ? target.value : event.nativeEvent.text;
}

function PickerButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.field, styles.halfField, pressed && pressedFeedbackSubtle]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.pickerValue}>{value}</Text>
    </Pressable>
  );
}
function cloneWorkout(workout: Workout): Workout {
  return JSON.parse(JSON.stringify(workout)) as Workout;
}
function createHistoricalDraft(
  date: Date,
  routine?: import('../types').WorkoutRoutine,
  plan?: import('../types').WorkoutPlan,
): Workout {
  const start = new Date(date);
  start.setHours(12, 0, 0, 0);
  const end = new Date(date);
  end.setHours(13, 0, 0, 0);
  const attributes = routine?.attributes
    ? Object.fromEntries(Object.keys(routine.attributes).map((label) => [label, '']))
    : undefined;
  return {
    ...createWorkout({
      name: routine ? (plan ? `${plan.name} - ${routine.name}` : routine.name) : undefined,
      type: routine?.type,
      note: routine?.note,
      attributes,
      attributeIcons: routine?.attributeIcons ? { ...routine.attributeIcons } : undefined,
      exercises: routine?.exercises,
      routineId: routine?.id,
      planId: plan?.id,
    }),
    startedAt: start.getTime(),
    completedAt: end.getTime(),
  };
}
function normalizeAttributes(
  attributes?: Record<string, string>,
  attributeIcons?: Record<string, import('../types').IconName>,
): Pick<Workout, 'attributes' | 'attributeIcons'> {
  const normalized = Object.fromEntries(
    Object.entries(attributes ?? {})
      .map(([label, value]) => [label.trim(), value.trim()] as const)
      .filter(([label]) => Boolean(label)),
  );
  const normalizedIcons = Object.fromEntries(
    Object.keys(normalized)
      .map((label) => [label, attributeIcons?.[label]] as const)
      .filter((entry): entry is [string, import('../types').IconName] => Boolean(entry[1])),
  );
  return {
    attributes: Object.keys(normalized).length ? normalized : undefined,
    attributeIcons: Object.keys(normalizedIcons).length ? normalizedIcons : undefined,
  };
}
function dateInput(date: Date): string {
  return date.toLocaleDateString('en-CA');
}
function timeInput(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function setDatePart(current: Date, date: Date): Date {
  const next = new Date(current);
  next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return next;
}
function setTimePart(current: Date, time: Date): Date {
  const next = new Date(current);
  next.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return next;
}

const createStyles = (theme: import('../types').ForgeTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: {
    position: 'relative',
    zIndex: 2,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: theme.background,
  },
  headerTop: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: { width: 44, height: 44 },
  keyboardArea: { flex: 1 },
  listViewport: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  listHeader: { gap: 14 },
  // Card separation comes from the list gap alone; a second row margin stacked
  // on top of it made the spacing read as too much (or, once tiny, merged).
  draggableExerciseRow: {},
  exerciseFooter: { paddingTop: 10 },
  formCard: {
    padding: 14,
    gap: 10,
  },
  identityGroup: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  identityField: { flex: 1, gap: 5 },
  identityDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.divider, marginVertical: 2 },
  nameInput: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 12,
    backgroundColor: theme.surfaceMuted,
    color: theme.ink,
    ...typeScale.body,
  },
  typePicker: { justifyContent: 'flex-start' },
  typePickerValue: { minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.divider, borderRadius: 12, backgroundColor: theme.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: 7 },
  typeText: { flex: 1, color: theme.ink, ...typeScale.body },
  cardDivider: { height: 1, marginVertical: 2, backgroundColor: theme.divider },
  formRow: { flexDirection: 'row', gap: 10 },
  field: { gap: 4 },
  halfField: { flex: 1 },
  targetToggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetToggleCopy: { flex: 1, gap: 3 },
  targetToggleHint: { color: theme.slate, ...typeScale.caption },
  fieldLabel: { color: theme.slate, ...typeScale.label },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 10,
    paddingHorizontal: 10,
    color: theme.ink,
    backgroundColor: theme.surfaceMuted,
    ...typeScale.supporting,
  },
  notesInput: { minHeight: 72, paddingTop: 9, textAlignVertical: 'top' },
  attributesSection: { gap: 7 },
  attributesTitle: { color: theme.slate, ...typeScale.label },
  addAttribute: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addAttributeText: { color: theme.ink, ...typeScale.label },
  pickerValue: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 10,
    backgroundColor: theme.surfaceMuted,
    color: theme.ink,
    ...typeScale.supporting,
    lineHeight: 40,
  },
  error: { color: theme.textDestructive, ...typeScale.label },
  sectionTitle: { color: theme.ink, ...typeScale.sectionTitle },
  addExercise: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 12,
    backgroundColor: theme.surface,
  },
  addExerciseText: { color: theme.ink, ...typeScale.label },
  exerciseList: { gap: 10 },
  // A wide, tall hold zone down the card's left edge so a reorder grab does not
  // require landing exactly on the grip icon.
  dragHandle: {
    width: 56,
    height: 60,
    marginLeft: -8,
    marginRight: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSheet: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  editorSheet: { maxHeight: '84%', paddingHorizontal: 20, paddingBottom: 12 },
  // Hug the content when short, shrink to scroll within the sheet cap when tall.
  sourceScroll: { flexShrink: 1 },
  sourceContent: { paddingTop: 14, paddingBottom: 24, paddingHorizontal: 20, gap: 18 },
  sourceGroup: { gap: 8 },
  sourceLabel: { color: theme.slate, ...typeScale.label },
  sourceRow: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sourceRowText: { flex: 1, gap: 2 },
  sourceRowLabel: { color: theme.ink, ...typeScale.label },
  sourceRowDetail: { color: theme.slate, ...typeScale.caption },
  emptySourceText: { paddingHorizontal: 4, color: theme.slate, ...typeScale.supporting },
  // The picker carries its own internal spacing; just give it a little headroom under
  // the header. The -4 counteracts ForgeDateTimePicker's own 4px gutter so the calendar's
  // Sep/Nov pills and grid line up exactly with the header's Close/commit controls (20dp).
  pickerBody: { marginTop: 8, marginHorizontal: -4 },
});
