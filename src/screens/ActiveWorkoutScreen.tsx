import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import {
  AppScreen,
  Button,
  ForgeText as Text,
  HeaderAction,
  HeaderEdge,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeFloatingCta,
  ForgeSheetHeader,
  ForgeTextInput,
  ForgeAttributeEditorSheet,
  ForgeSwipeableAttributeRow,
  ForgeWorkoutTypePicker,
  Icon,
  pressedFeedback,
} from '../components/ui';
import { usePrimaryDock } from '../navigation/PrimaryDockContext';
import { useForgeDockScrollInset } from '../components/DockChrome';
import { useForgeFloatingCtaClearance } from '../components/ui/ForgeFloatingCta';
import { useWorkouts } from '../state/WorkoutContext';
import { useRestTimer } from '../state/RestTimerContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootTabScreenProps, Workout, WorkoutExercise, WorkoutSetChanges } from '../types';
import { lightHaptic, successHaptic } from './activeWorkout/activeWorkoutFeedback';
import {
  formatElapsed,
  formatRest,
  formatRestDisplay,
} from './activeWorkout/activeWorkoutFormatters';
import { ExerciseSection as ExtractedExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet as ExtractedAddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { RestTimerIndicator, RestTimerSheet } from './activeWorkout/RestTimer';
import { WorkoutDurationSheet } from './activeWorkout/WorkoutDurationSheet';
import { createActiveWorkoutStyles } from './activeWorkout/activeWorkoutStyles';
import { useFocusedSetKeyboardLift } from './activeWorkout/useFocusedSetKeyboardLift';
import { typeScale } from '../theme/tokens';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import { createExerciseSnapshot } from '../domain/exercises/exerciseSnapshot';
import { workoutTypeIcon } from './settings/workoutTypeIcon';

type ActiveWorkoutScreenProps = RootTabScreenProps<'ActiveWorkout'>;
export function ActiveWorkoutScreen({ navigation }: ActiveWorkoutScreenProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const dockScrollInset = useForgeDockScrollInset();
  const floatingCtaClearance = useForgeFloatingCtaClearance();
  const {
    activeWorkout,
    ready,
    addExercises,
    addSet,
    removeSet,
    removeExercise,
    updateExercise,
    addWarmupSets,
    updateSet,
    toggleSet,
    updateActiveWorkout,
    cancelWorkout,
    finishWorkout,
  } = useWorkouts();
  const [now, setNow] = useState(() => Date.now());
  const [restSelection, setRestSelection] = useState(90);
  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [durationSheetOpen, setDurationSheetOpen] = useState(false);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [emptyFinishConfirmationOpen, setEmptyFinishConfirmationOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [workoutNameDraft, setWorkoutNameDraft] = useState('');
  const [workoutNoteDraft, setWorkoutNoteDraft] = useState('');
  const [workoutNoteHeight, setWorkoutNoteHeight] = useState(52);
  const [workoutTypeDraft, setWorkoutTypeDraft] = useState('');
  const [attributesDraft, setAttributesDraft] = useState<Record<string, string>>({});
  const [attributeIconsDraft, setAttributeIconsDraft] = useState<Record<string, import('../types').IconName>>({});
  const [editorView, setEditorView] = useState<'form' | 'type-picker'>('form');
  const [attributeDraft, setAttributeDraft] = useState<{ original?: string; label: string; value: string; icon: import('../types').IconName } | null>(null);
  const timerLongPressRef = useRef(false);
  const { preferences } = useSettings();
  const restTimer = useRestTimer();

  useEffect(() => {
    if (!activeWorkout || activeWorkout.automaticTimeTracking === false) return undefined;
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeWorkout]);

  const elapsed = activeWorkout
    ? activeWorkout.automaticTimeTracking === false
      ? activeWorkout.durationSeconds ?? 0
      : Math.max(0, Math.floor((now - activeWorkout.startedAt) / 1000))
    : 0;
  const restRemaining = restTimer.remaining;
  const restRunning = restTimer.running;
  const restDuration = restTimer.duration || preferences.defaultRestSeconds;

  const startRestTimer = useCallback((duration = 60): void => {
    lightHaptic();
    restTimer.start(duration);
  }, [restTimer]);
  const openRestTimer = () => {
    lightHaptic();
    if (restRunning) setRestSelection(restDuration);
    setRestSheetOpen(true);
  };
  const adjustRestTimer = (amount: number): void => {
    lightHaptic();
    restTimer.adjust(amount);
  };
  const stopRestTimer = () => {
    lightHaptic();
    restTimer.stop();
  };
  const setAutomaticTimeTracking = (enabled: boolean): void => {
    lightHaptic();
    const changedAt = Date.now();
    updateActiveWorkout((current) => {
      const frozenSeconds = current.automaticTimeTracking === false
        ? current.durationSeconds ?? 0
        : Math.max(0, Math.floor((changedAt - current.startedAt) / 1000));
      return enabled
        ? { ...current, automaticTimeTracking: true, startedAt: changedAt - frozenSeconds * 1000, durationSeconds: undefined }
        : { ...current, automaticTimeTracking: false, durationSeconds: frozenSeconds };
    });
    setNow(changedAt);
  };
  const resetWorkoutStartTime = (): void => {
    const resetAt = Date.now();
    updateActiveWorkout((current) => ({
      ...current,
      startedAt: resetAt,
      durationSeconds: current.automaticTimeTracking === false ? 0 : undefined,
    }));
    setNow(resetAt);
  };
  const setWorkoutStartTime = (startedAt: number): void => {
    updateActiveWorkout((current) => ({ ...current, startedAt }));
    setNow(Date.now());
  };
  const handleAddExerciseClose = useCallback(() => setSheetOpen(false), []);
  const openAddExercise = useCallback(() => setSheetOpen(true), []);
  const handleWorkoutScrollOffset = useCallback((offset: number) => {
    setHeaderElevated(offset > 1);
  }, []);
  const handleAddExercises = useCallback(
    (exercises: import('../data/exerciseCatalog').ExerciseCatalogItem[]) => {
      lightHaptic();
      addExercises(exercises.map((exercise) => ({ exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: createExerciseSnapshot(exercise) })));
      setSheetOpen(false);
    },
    [addExercises],
  );
  const returnToDashboard = (finished: Workout | null): void =>
    navigation.navigate(
      'Dashboard',
      finished?.completedAt ? { selectedDate: calendarDateKey(finished.completedAt) } : undefined,
    );

  if (!ready)
    return (
      <AppScreen backgroundColor={theme.background}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading workout…</Text>
        </View>
      </AppScreen>
    );
  if (!activeWorkout)
    return (
      <AppScreen backgroundColor={theme.background}>
        <View style={styles.center}>
          <Text style={styles.title}>No active workout</Text>
          <Button
            label="Back to Dashboard"
            onPress={() => navigation.navigate('Dashboard')}
            theme={theme}
          />
        </View>
      </AppScreen>
    );

  const handleFinish = () => {
    if (!activeWorkout.exercises.length) {
      setEmptyFinishConfirmationOpen(true);
      return;
    }
    successHaptic();
    const finished = finishWorkout();
    returnToDashboard(finished);
  };

  const discardWorkout = (): void => {
    cancelWorkout();
    returnToDashboard(null);
  };
  const handleCancel = (): void => setDiscardConfirmationOpen(true);
  const openWorkoutEditor = (): void => {
    setWorkoutNameDraft(activeWorkout.name);
    setWorkoutNoteDraft(activeWorkout.note);
    setWorkoutNoteHeight(commentHeight(activeWorkout.note));
    setWorkoutTypeDraft(activeWorkout.type);
    setAttributesDraft({ ...(activeWorkout.attributes ?? {}) });
    setAttributeIconsDraft({ ...(activeWorkout.attributeIcons ?? {}) });
    setEditorView('form');
    setEditingWorkout(true);
  };
  const saveWorkoutEditor = (): void => {
    const name = workoutNameDraft.trim();
    if (!name) return;
    const attributes = Object.fromEntries(
      Object.entries(attributesDraft)
        .map(([label, value]) => [label.trim(), value.trim()] as const)
        .filter(([label]) => Boolean(label)),
    );
    const attributeIcons = Object.fromEntries(
      Object.keys(attributes)
        .map((label) => [label, attributeIconsDraft[label]] as const)
        .filter((entry): entry is [string, import('../types').IconName] => Boolean(entry[1])),
    );
    updateActiveWorkout((current) => ({ ...current, name, type: workoutTypeDraft, note: workoutNoteDraft.trim(), attributes: Object.keys(attributes).length ? attributes : undefined, attributeIcons: Object.keys(attributeIcons).length ? attributeIcons : undefined }));
    setEditingWorkout(false);
  };
  return (
    <AppScreen
      backgroundColor={theme.background}
      edges={['top']}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeadingActions}>
            <HeaderAction
              accessibilityLabel="Cancel workout"
              icon="close"
              label="Cancel"
              iconOnly
              onPress={handleCancel}
            />
            <HeaderAction
              accessibilityLabel="Edit live workout"
              icon="note"
              iconOnly
              onPress={openWorkoutEditor}
            />
          </View>
          <View style={styles.titleBlock}>
            <View
              style={styles.titleWrap}
              accessibilityLabel={`Workout type: ${activeWorkout.type}`}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeWorkout.name}
              </Text>
            </View>
          </View>
          <HeaderAction
            accessibilityLabel="Finish workout"
            icon="check"
            label="Finish"
            onPress={handleFinish}
            variant="primary"
            haptic="none"
          />
        </View>
        <View style={styles.elapsedPanel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open workout duration"
          onPress={() => {
            lightHaptic();
            setDurationSheetOpen(true);
          }}
          style={({ pressed }) => [styles.elapsedInfo, pressed && pressedFeedback]}
        >
            <Icon name="time-outline" size={22} color={theme.slate} />
            <Text style={styles.elapsedValue}>{formatElapsed(elapsed)}</Text>
            <Text style={styles.timerLabel}>Elapsed</Text>
          </Pressable>
          <View style={styles.timerDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              restRunning
                ? `Rest timer, ${Math.abs(restRemaining)} seconds remaining`
                : 'Start rest timer'
            }
            onPress={() => {
              if (timerLongPressRef.current) {
                timerLongPressRef.current = false;
                return;
              }
              openRestTimer();
            }}
            onLongPress={() => {
              timerLongPressRef.current = true;
              startRestTimer(restDuration);
            }}
            delayLongPress={450}
            accessibilityHint="Tap to open the rest timer or hold to restart it"
            style={({ pressed }) => [styles.timerReset, pressed && pressedFeedback]}
          >
            <RestTimerIndicator
              remaining={restRemaining}
              duration={restDuration}
              running={restRunning}
            />
            <Text style={styles.timerLabel}>Rest</Text>
          </Pressable>
        </View>
        {headerElevated ? <HeaderEdge /> : null}
      </View>
      <LiveWorkoutExerciseList
        workout={activeWorkout}
        addSet={addSet}
        removeSet={removeSet}
        removeExercise={removeExercise}
        updateExercise={updateExercise}
        addWarmupSets={addWarmupSets}
        updateSet={updateSet}
        toggleSet={toggleSet}
        updateActiveWorkout={updateActiveWorkout}
        onSetCompleted={startRestTimer}
        onOpenAddExercise={openAddExercise}
        onScrollOffsetChange={handleWorkoutScrollOffset}
        dockScrollInset={dockScrollInset}
      />
      <ExtractedAddExerciseSheet
        visible={sheetOpen}
        onClose={handleAddExerciseClose}
        onSubmit={handleAddExercises}
      />
      <WorkoutDurationSheet
        visible={durationSheetOpen}
        startedAt={activeWorkout.startedAt}
        automaticTracking={activeWorkout.automaticTimeTracking !== false}
        weekStartsOn={preferences.weekStartsOn}
        onClose={() => setDurationSheetOpen(false)}
        onAutomaticTrackingChange={setAutomaticTimeTracking}
        onStartedAtChange={setWorkoutStartTime}
        onResetStartTime={resetWorkoutStartTime}
      />
      <ForgeConfirmationDialog
        visible={discardConfirmationOpen}
        title="Discard workout?"
        message="Your active workout and its progress will be discarded."
        cancelLabel="Keep working out"
        confirmLabel="Discard workout"
        onCancel={() => setDiscardConfirmationOpen(false)}
        onConfirm={() => {
          setDiscardConfirmationOpen(false);
          discardWorkout();
        }}
        testID="discard-live-workout-confirmation"
      />
      <ForgeConfirmationDialog
        visible={emptyFinishConfirmationOpen}
        title="Finish empty workout?"
        message="No workout will be saved."
        cancelLabel="Keep working out"
        confirmLabel="Leave workout"
        onCancel={() => setEmptyFinishConfirmationOpen(false)}
        onConfirm={() => {
          setEmptyFinishConfirmationOpen(false);
          finishWorkout();
          successHaptic();
          returnToDashboard(null);
        }}
        testID="finish-empty-workout-confirmation"
      />
      <ForgeBottomSheet
        visible={editingWorkout}
        onClose={() => setEditingWorkout(false)}
        accessibilityLabel="Close edit live workout"
        initialOffset={360}
        closeDistance={360}
        style={editorStyles.sheet}
      >
        {attributeDraft ? <ForgeAttributeEditorSheet value={attributeDraft} onClose={() => setAttributeDraft(null)} onSave={(next) => { const label = next.label.trim(); if (!label || (label !== next.original && attributesDraft[label] !== undefined)) return; setAttributesDraft((current) => { const copy = { ...current }; if (next.original) delete copy[next.original]; copy[label] = next.value.trim(); return copy; }); setAttributeIconsDraft((current) => { const copy = { ...current }; if (next.original) delete copy[next.original]; copy[label] = next.icon; return copy; }); setAttributeDraft(null); }} onDelete={attributeDraft.original ? () => { setAttributesDraft((current) => { const copy = { ...current }; delete copy[attributeDraft.original!]; return copy; }); setAttributeIconsDraft((current) => { const copy = { ...current }; delete copy[attributeDraft.original!]; return copy; }); setAttributeDraft(null); } : undefined} /> : editorView === 'type-picker' ? <ForgeWorkoutTypePicker
          selectedType={workoutTypeDraft}
          workoutTypes={preferences.workoutTypes.filter((type) => !type.hidden)}
          onBack={() => setEditorView('form')}
          onClose={() => setEditingWorkout(false)}
          onSelect={(type) => { setWorkoutTypeDraft(type); setEditorView('form'); }}
          iconForType={workoutTypeIcon}
        /> : <>
        <ForgeBottomSheetHandle />
        <ForgeSheetHeader title="Edit workout" onClose={() => setEditingWorkout(false)} />
        <ScrollView style={editorStyles.editorScroll} contentContainerStyle={[editorStyles.editorContent, { paddingBottom: floatingCtaClearance }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Name</Text>
          <ForgeCard variant="inset" style={editorStyles.fieldCard}>
            <ForgeTextInput value={workoutNameDraft} onChangeText={setWorkoutNameDraft} accessibilityLabel="Workout name" style={[editorStyles.input, { color: theme.textPrimary }]} />
          </ForgeCard>
        </View>
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Workout type</Text>
          <ForgeCard variant="inset">
            <Pressable accessibilityRole="button" accessibilityLabel="Choose workout type" onPress={() => { lightHaptic(); setEditorView('type-picker'); }} style={editorStyles.row}>
              <Icon name={workoutTypeIcon(preferences.workoutTypes.find((type) => type.name === workoutTypeDraft) ?? preferences.workoutTypes[0])} size={22} color={theme.textPrimary} />
              <Text style={[editorStyles.rowLabel, { color: theme.textPrimary }]}>{workoutTypeDraft}</Text><Icon name="chevron-forward" size={20} color={theme.slate} />
            </Pressable>
          </ForgeCard>
        </View>
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Training comment</Text>
          <ForgeCard variant="inset" style={editorStyles.fieldCard}>
            <ForgeTextInput
              value={workoutNoteDraft}
              onChangeText={(note) => {
                setWorkoutNoteDraft(note);
                setWorkoutNoteHeight(commentHeight(note));
              }}
              accessibilityLabel="Workout note"
              multiline
              style={[editorStyles.input, editorStyles.note, { height: workoutNoteHeight, color: theme.textPrimary }]}
            />
          </ForgeCard>
        </View>
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Custom attributes</Text>
          <ForgeCard variant="inset">
            {Object.entries(attributesDraft).map(([label, value], index) => (
              <ForgeSwipeableAttributeRow
                key={label}
                label={label}
                value={value}
                icon={attributeIconsDraft[label] ?? 'note'}
                divider={index > 0}
                onEdit={() => setAttributeDraft({ original: label, label, value, icon: attributeIconsDraft[label] ?? 'note' })}
                onDelete={() => {
                  setAttributesDraft((current) => {
                    const copy = { ...current };
                    delete copy[label];
                    return copy;
                  });
                  setAttributeIconsDraft((current) => {
                    const copy = { ...current };
                    delete copy[label];
                    return copy;
                  });
                }}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add attribute"
              onPress={() => { lightHaptic(); setAttributeDraft({ label: '', value: '', icon: 'note' }); }}
              style={[
                editorStyles.addAttributeRow,
                Object.keys(attributesDraft).length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
              ]}
            >
              <Icon name="add" size={22} color={theme.textPrimary} />
              <Text style={[editorStyles.rowLabel, { color: theme.textPrimary }]}>Add attribute</Text>
            </Pressable>
          </ForgeCard>
        </View>
        </ScrollView>
        <ForgeFloatingCta label="Save changes" accessibilityLabel="Save live workout changes" onPress={saveWorkoutEditor} disabled={!workoutNameDraft.trim()} tone="success" />
        </>}
      </ForgeBottomSheet>
      {restSheetOpen && (
        <RestTimerSheet
          visible
          selectedDuration={restSelection}
          remaining={restRemaining}
          duration={restDuration}
          running={restRunning}
          onClose={() => setRestSheetOpen(false)}
          onSelect={setRestSelection}
          onStart={() => startRestTimer(restSelection)}
          onAdjust={adjustRestTimer}
          onStop={stopRestTimer}
        />
      )}
    </AppScreen>
  );
}

const LiveWorkoutExerciseList = React.memo(function LiveWorkoutExerciseList({
  workout,
  addSet,
  removeSet,
  removeExercise,
  updateExercise,
  addWarmupSets,
  updateSet,
  toggleSet,
  updateActiveWorkout,
  onSetCompleted,
  onOpenAddExercise,
  onScrollOffsetChange,
  dockScrollInset,
}: {
  workout: Workout;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise: (exerciseId: string, changes: import('../types').WorkoutExerciseChanges) => void;
  addWarmupSets: (exerciseId: string, sets: readonly { weight: string; reps: string }[]) => void;
  updateSet: (exerciseId: string, setId: string, changes: WorkoutSetChanges) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  updateActiveWorkout: (update: (workout: Workout) => Workout) => void;
  onSetCompleted: (duration?: number) => void;
  onOpenAddExercise: () => void;
  onScrollOffsetChange: (offset: number) => void;
  dockScrollInset: number;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  const workoutListRef = useRef<FlatList<WorkoutExercise>>(null);
  const dockCompactOnUi = useSharedValue(false);
  const { setCompact: setDockCompact } = usePrimaryDock();
  const { onSetInputFocus, onScrollOffsetChange: recordScrollOffset } = useFocusedSetKeyboardLift(workoutListRef);
  const handleDockCompactChange = useCallback((nextCompact: boolean): void => setDockCompact(nextCompact), [setDockCompact]);
  const handleWorkoutScrollOffset = useCallback((offset: number): void => {
    recordScrollOffset(offset);
    onScrollOffsetChange(offset);
  }, [onScrollOffsetChange, recordScrollOffset]);
  useEffect(() => () => setDockCompact(false), [setDockCompact]);
  const workoutScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      runOnJS(handleWorkoutScrollOffset)(event.contentOffset.y);
      const nextCompact = event.contentOffset.y > 12;
      if (nextCompact !== dockCompactOnUi.value) {
        dockCompactOnUi.value = nextCompact;
        runOnJS(handleDockCompactChange)(nextCompact);
      }
    },
  });
  const handleExerciseDeleteReveal = useCallback((exerciseId: string, revealed: boolean): void => {
    setOpenExerciseId(revealed ? exerciseId : null);
  }, []);
  const updateLiveAttribute = useCallback((label: string, value: string): void => {
    updateActiveWorkout((current) => ({
      ...current,
      attributes: { ...(current.attributes ?? {}), [label]: value },
    }));
  }, [updateActiveWorkout]);
  const renderExercise = useCallback(
    ({ item, index }: { item: WorkoutExercise; index: number }) => (
      <ExtractedExerciseSection
        exercise={item}
        index={index}
        addSet={addSet}
        removeSet={removeSet}
        removeExercise={removeExercise}
        updateExercise={updateExercise}
        addWarmupSets={addWarmupSets}
        updateSet={updateSet}
        toggleSet={toggleSet}
        onSetCompleted={onSetCompleted}
        showCatalogMetadata
        showWarmupSets
        onSetInputFocus={onSetInputFocus}
        deleteRevealed={openExerciseId === item.id}
        onDeleteRevealChange={handleExerciseDeleteReveal}
      />
    ),
    [addSet, addWarmupSets, handleExerciseDeleteReveal, onSetCompleted, onSetInputFocus, openExerciseId, removeExercise, removeSet, toggleSet, updateExercise, updateSet],
  );
  const liveAttributeEntries = Object.entries(workout.attributes ?? {});

  return (
    <KeyboardAvoidingView
      style={styles.keyboardArea}
      enabled={Platform.OS !== 'ios'}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <Animated.FlatList
        ref={workoutListRef}
        testID="active-workout-list"
        data={workout.exercises}
        renderItem={renderExercise}
        keyExtractor={(exercise) => exercise.id}
        contentContainerStyle={[styles.content, { paddingBottom: dockScrollInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        scrollsChildToFocus
        nestedScrollEnabled
        onScroll={workoutScrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={
          liveAttributeEntries.length || workout.exercises.length ? (
            <View style={styles.listSectionHeader}>
              {liveAttributeEntries.length ? (
                <View style={styles.liveAttributesSection}>
                  <Text style={styles.listSectionTitle}>Attributes</Text>
                  <ForgeCard variant="outlined" size="compact">
                    {liveAttributeEntries.map(([label, value], index) => (
                      <View key={label} style={[styles.liveAttributeRow, index > 0 && styles.joinedAttributeRow]}>
                        <Icon
                          testID={`live-attribute-icon-${label}`}
                          name={workout.attributeIcons?.[label] ?? 'note'}
                          size={20}
                          color={theme.textPrimary}
                        />
                        <Text style={styles.liveAttributeLabel} numberOfLines={1}>{label}</Text>
                        <ForgeTextInput
                          accessibilityLabel={`${label} value`}
                          value={value}
                          onChangeText={(nextValue) => updateLiveAttribute(label, nextValue)}
                          placeholder="Add value"
                          placeholderTextColor={theme.textDisabled}
                          style={styles.liveAttributeInput}
                        />
                      </View>
                    ))}
                  </ForgeCard>
                </View>
              ) : null}
              {workout.exercises.length ? <Text style={styles.listSectionTitle}>Exercises</Text> : null}
            </View>
          ) : null
        }
        ListFooterComponent={
          <Button
            accessibilityLabel="Add exercise"
            label="Add exercise"
            icon="add"
            iconSize={17}
            variant="outline"
            onPress={onOpenAddExercise}
            style={styles.addExercise}
          />
        }
      />
    </KeyboardAvoidingView>
  );
});

function commentHeight(value: string): number {
  const lines = value.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 38)), 0);
  // Keep the form stable while the comment fits on one line. Once it wraps,
  // offer precisely one additional line; longer notes scroll within the field.
  return lines > 1 ? 104 : 52;
}

const editorStyles = StyleSheet.create({
  sheet: { maxHeight: '84%', paddingHorizontal: 20, paddingBottom: 12 },
  editorScroll: { flexGrow: 0, flexShrink: 1 },
  editorContent: { paddingTop: 14, gap: 18 },
  // Type selection commits immediately, so it has no docked confirmation action.
  // Keep only comfortable breathing room: this lets the sheet stop at its useful height.
  typePickerContent: { paddingTop: 22, paddingBottom: 20 },
  formSection: { gap: 8 },
  card: { padding: 14, gap: 10, marginTop: 10 },
  fieldCard: { paddingHorizontal: 14 },
  label: { ...typeScale.label },
  input: { minHeight: 52, paddingVertical: 0, textAlignVertical: 'center', ...typeScale.body },
  note: { minHeight: 52, paddingTop: 14, paddingBottom: 12, textAlignVertical: 'top' },
  row: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addAttributeRow: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  typeChoice: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1, ...typeScale.label },
  rowValue: { maxWidth: '48%', ...typeScale.supporting, textAlign: 'right' },
  swipeAttributeRow: { position: 'relative', overflow: 'hidden' },
  swipeAttributeContent: { zIndex: 1 },
  attributeDeleteAction: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 56 },
  attributeDeleteButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconChoices: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconChoice: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, position: 'relative' },
});
