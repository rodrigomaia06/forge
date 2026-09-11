import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  ForgeFloatingCta,
  ForgeSheetHeader,
  ForgeTextInput,
  Icon,
  pressedFeedback,
} from '../components/ui';
import { usePrimaryDock } from '../navigation/PrimaryDockContext';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootTabScreenProps, Workout, WorkoutExercise } from '../types';
import { lightHaptic, successHaptic } from './activeWorkout/activeWorkoutFeedback';
import {
  formatElapsed,
  formatRest,
  formatRestDisplay,
} from './activeWorkout/activeWorkoutFormatters';
import { ExerciseSection as ExtractedExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet as ExtractedAddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { RestTimerIndicator, RestTimerSheet } from './activeWorkout/RestTimer';
import { createActiveWorkoutStyles } from './activeWorkout/activeWorkoutStyles';
import { useFocusedSetKeyboardLift } from './activeWorkout/useFocusedSetKeyboardLift';
import { typeScale } from '../theme/tokens';
import { workoutTypeIcon } from './settings/workoutTypeIcon';

type ActiveWorkoutScreenProps = RootTabScreenProps<'ActiveWorkout'>;
export function ActiveWorkoutScreen({ navigation }: ActiveWorkoutScreenProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createActiveWorkoutStyles);
  const {
    activeWorkout,
    ready,
    addExercise,
    addSet,
    removeSet,
    removeExercise,
    updateSet,
    toggleSet,
    updateActiveWorkout,
    cancelWorkout,
    finishWorkout,
  } = useWorkouts();
  const [now, setNow] = useState(() => Date.now());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restDuration, setRestDuration] = useState(60);
  const [restSelection, setRestSelection] = useState(90);
  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
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
  const workoutListRef = useRef<FlatList<WorkoutExercise>>(null);
  const dockCompactOnUi = useSharedValue(false);
  const { setCompact: setDockCompact } = usePrimaryDock();
  const { preferences } = useSettings();
  const { onSetInputFocus, onScrollOffsetChange } = useFocusedSetKeyboardLift(workoutListRef);

  const restCompletionNotified = useRef(false);

  useEffect(() => {
    if (!activeWorkout) return undefined;
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeWorkout]);

  useEffect(() => {
    if (!restEndsAt || now < restEndsAt) return;
    if (!restCompletionNotified.current) {
      restCompletionNotified.current = true;
      successHaptic();
    }
    setRestEndsAt(null);
  }, [now, restEndsAt]);

  const elapsed = activeWorkout
    ? Math.max(0, Math.floor((now - activeWorkout.startedAt) / 1000))
    : 0;
  const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const restRunning = restEndsAt !== null && restRemaining > 0;

  const startRestTimer = useCallback((duration = 60): void => {
    lightHaptic();
    setRestDuration(duration);
    restCompletionNotified.current = false;
    const startedAt = Date.now();
    setNow(startedAt);
    setRestEndsAt(startedAt + duration * 1000);
  }, []);
  const openRestTimer = () => {
    lightHaptic();
    if (restRunning) setRestSelection(restDuration);
    setRestSheetOpen(true);
  };
  const adjustRestTimer = (amount: number): void => {
    lightHaptic();
    const adjustedAt = Date.now();
    setNow(adjustedAt);
    setRestEndsAt((current) => Math.max(adjustedAt, (current ?? adjustedAt) + amount * 1000));
  };
  const skipRestTimer = () => {
    lightHaptic();
    setRestEndsAt(null);
  };
  const handleDockCompactChange = useCallback(
    (nextCompact: boolean): void => setDockCompact(nextCompact),
    [setDockCompact],
  );
  const handleWorkoutScrollOffset = useCallback((offset: number) => {
    onScrollOffsetChange(offset);
    setHeaderElevated((current) => {
      const next = offset > 1;
      return current === next ? current : next;
    });
  }, [onScrollOffsetChange]);
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
  const handleAddExerciseClose = useCallback(() => setSheetOpen(false), []);
  const handleAddExercises = useCallback(
    (exercises: import('../data/exerciseCatalog').ExerciseCatalogItem[]) => {
      lightHaptic();
      exercises.forEach((exercise) => addExercise({ exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: { id: exercise.id, name: exercise.name, catalogueVersion: 3, trackingType: exercise.trackingType ?? 'weight-reps', familyId: exercise.familyId, equipment: exercise.equipmentIds, workoutTypeIds: exercise.workoutTypeIds, category: exercise.category, bodyRegion: exercise.bodyRegion, primaryMuscle: exercise.primaryMuscle, secondaryMuscles: exercise.secondaryMuscles, aliases: exercise.aliases, searchTerms: exercise.searchTerms, movementPattern: exercise.movementPattern } }));
      setSheetOpen(false);
    },
    [addExercise],
  );
  const renderExercise = useCallback(
    ({ item, index }: { item: WorkoutExercise; index: number }) => (
      <ExtractedExerciseSection
        exercise={item}
        index={index}
        addSet={addSet}
        removeSet={removeSet}
        removeExercise={removeExercise}
        updateSet={updateSet}
        toggleSet={toggleSet}
        onSetCompleted={startRestTimer}
        onSetInputFocus={onSetInputFocus}
        deleteRevealed={openExerciseId === item.id}
        onDeleteRevealChange={handleExerciseDeleteReveal}
      />
    ),
    [
      addSet,
      handleExerciseDeleteReveal,
      openExerciseId,
      removeExercise,
      removeSet,
      startRestTimer,
      toggleSet,
      onSetInputFocus,
      updateSet,
    ],
  );
  const returnToDashboard = (finished: Workout | null): void =>
    navigation.navigate(
      'Dashboard',
      finished?.completedAt ? { selectedDay: new Date(finished.completedAt).getDate() } : undefined,
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
      Alert.alert('Finish empty workout?', 'No workout will be saved.', [
        { text: 'Keep working out', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            finishWorkout();
            successHaptic();
            returnToDashboard(null);
          },
        },
      ]);
      return;
    }
    successHaptic();
    const finished = finishWorkout();
    returnToDashboard(finished);
  };

  const handleCancel = (): void => {
    cancelWorkout();
    returnToDashboard(null);
  };
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
  const updateLiveAttribute = (label: string, value: string): void => {
    updateActiveWorkout((current) => ({
      ...current,
      attributes: { ...(current.attributes ?? {}), [label]: value },
    }));
  };
  const liveAttributeEntries = Object.entries(activeWorkout.attributes ?? {});

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
          <View style={styles.elapsedInfo}>
            <Icon name="time-outline" size={22} color={theme.slate} />
            <Text style={styles.elapsedValue}>{formatElapsed(elapsed)}</Text>
            <Text style={styles.timerLabel}>Elapsed</Text>
          </View>
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
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        enabled={Platform.OS !== 'ios'}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
      >
        <Animated.FlatList
          ref={workoutListRef}
          testID="active-workout-list"
          data={activeWorkout.exercises}
          renderItem={renderExercise}
          keyExtractor={(exercise) => exercise.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          scrollsChildToFocus
          nestedScrollEnabled
          onScroll={workoutScrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={liveAttributeEntries.length ? (
            <View style={editorStyles.liveAttributesSection}>
              <View style={editorStyles.attributeCards}>
                {liveAttributeEntries.map(([label, value]) => (
                  <ForgeCard key={label} variant="outlined">
                    <View style={editorStyles.row}>
                      <Icon name={activeWorkout.attributeIcons?.[label] ?? 'note'} size={21} color={theme.textPrimary} />
                      <Text style={[editorStyles.rowLabel, { color: theme.textPrimary }]} numberOfLines={1}>{label}</Text>
                      <ForgeTextInput
                        accessibilityLabel={`${label} value`}
                        value={value}
                        onChangeText={(nextValue) => updateLiveAttribute(label, nextValue)}
                        placeholder="Add value"
                        placeholderTextColor={theme.textDisabled}
                        style={[editorStyles.liveAttributeInput, { color: theme.textPrimary }]}
                      />
                    </View>
                  </ForgeCard>
                ))}
              </View>
            </View>
          ) : null}
          ListFooterComponent={
            <Button
              accessibilityLabel="Add exercise"
              label="Add exercise"
              icon="add"
              iconSize={17}
              variant="outline"
              onPress={() => {
                setSheetOpen(true);
              }}
              style={styles.addExercise}
            />
          }
        />
      </KeyboardAvoidingView>
      <ExtractedAddExerciseSheet
        visible={sheetOpen}
        onClose={handleAddExerciseClose}
        onSubmit={handleAddExercises}
      />
      <ForgeBottomSheet
        visible={editingWorkout}
        onClose={() => setEditingWorkout(false)}
        accessibilityLabel="Close edit live workout"
        initialOffset={360}
        closeDistance={360}
        style={editorStyles.sheet}
      >
        {attributeDraft ? <LiveWorkoutAttributeSheet value={attributeDraft} onClose={() => setAttributeDraft(null)} onDismiss={() => setEditingWorkout(false)} onSave={(next) => { const label = next.label.trim(); if (!label || (label !== next.original && attributesDraft[label] !== undefined)) return; setAttributesDraft((current) => { const copy = { ...current }; if (next.original) delete copy[next.original]; copy[label] = next.value.trim(); return copy; }); setAttributeIconsDraft((current) => { const copy = { ...current }; if (next.original) delete copy[next.original]; copy[label] = next.icon; return copy; }); setAttributeDraft(null); }} onDelete={attributeDraft.original ? () => { setAttributesDraft((current) => { const copy = { ...current }; delete copy[attributeDraft.original!]; return copy; }); setAttributeIconsDraft((current) => { const copy = { ...current }; delete copy[attributeDraft.original!]; return copy; }); setAttributeDraft(null); } : undefined} /> : editorView === 'type-picker' ? <LiveWorkoutTypePicker
          selectedType={workoutTypeDraft}
          workoutTypes={preferences.workoutTypes.filter((type) => !type.hidden)}
          onBack={() => setEditorView('form')}
          onClose={() => setEditingWorkout(false)}
          onSelect={(type) => { setWorkoutTypeDraft(type); setEditorView('form'); }}
        /> : <>
        <ForgeBottomSheetHandle />
        <ForgeSheetHeader title="Edit workout" onClose={() => setEditingWorkout(false)} />
        <ScrollView style={editorStyles.editorScroll} contentContainerStyle={editorStyles.editorContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Name</Text>
          <ForgeCard variant="inset" style={editorStyles.fieldCard}>
            <ForgeTextInput value={workoutNameDraft} onChangeText={setWorkoutNameDraft} accessibilityLabel="Workout name" style={[editorStyles.input, { color: theme.textPrimary }]} />
          </ForgeCard>
        </View>
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Workout type</Text>
          <ForgeCard variant="inset">
            <Pressable accessibilityRole="button" accessibilityLabel="Choose workout type" onPress={() => setEditorView('type-picker')} style={editorStyles.row}>
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
          <View style={editorStyles.attributeCards}>
            {Object.entries(attributesDraft).map(([label, value]) => <ForgeCard key={label} variant="inset"><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label} attribute`} onPress={() => setAttributeDraft({ original: label, label, value, icon: attributeIconsDraft[label] ?? 'note' })} style={editorStyles.row}><Icon name={attributeIconsDraft[label] ?? 'note'} size={22} color={theme.textPrimary} /><Text style={[editorStyles.rowLabel, { color: theme.textPrimary }]}>{label}</Text><Text style={[editorStyles.rowValue, { color: theme.slate }]}>{value || 'Add value'}</Text><Icon name="chevron-forward" size={20} color={theme.slate} /></Pressable></ForgeCard>)}
            <ForgeCard variant="inset"><Pressable accessibilityRole="button" accessibilityLabel="Add attribute" onPress={() => setAttributeDraft({ label: '', value: '', icon: 'note' })} style={editorStyles.row}><Icon name="add" size={22} color={theme.textPrimary} /><Text style={[editorStyles.rowLabel, { color: theme.textPrimary }]}>Add attribute</Text></Pressable></ForgeCard>
          </View>
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
          onSkip={skipRestTimer}
        />
      )}
    </AppScreen>
  );
}

function LiveWorkoutAttributeSheet({
  value,
  onClose,
  onDismiss,
  onSave,
  onDelete,
}: {
  value: { original?: string; label: string; value: string; icon: import('../types').IconName };
  onClose: () => void;
  onDismiss: () => void;
  onSave: (value: { original?: string; label: string; value: string; icon: import('../types').IconName }) => void;
  onDelete?: () => void;
}) {
  const theme = useForgeTheme();
  const [draft, setDraft] = useState(value);
  const [selectingIcon, setSelectingIcon] = useState(false);
  const icons: import('../types').IconName[] = [
    'note', 'activity', 'fitness', 'time', 'calendar', 'home', 'info', 'verified',
    'measure', 'weight', 'running', 'stretching', 'warm-up', 'history', 'book',
    'clipboard', 'task-list', 'settings', 'basketball', 'tennis-ball',
  ];
  return (
    <>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title={value.original ? 'Edit attribute' : 'Add attribute'}
        onClose={onDismiss}
        leading={<SheetBackButton onPress={onClose} />}
      />
      <ScrollView style={editorStyles.editorScroll} contentContainerStyle={editorStyles.editorContent} keyboardShouldPersistTaps="handled">
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Attribute name</Text>
          <ForgeCard variant="inset" style={editorStyles.fieldCard}>
            <ForgeTextInput accessibilityLabel="Attribute label" value={draft.label} onChangeText={(label) => setDraft((current) => ({ ...current, label }))} placeholder="Name" placeholderTextColor={theme.textDisabled} style={[editorStyles.input, { color: theme.textPrimary }]} />
          </ForgeCard>
        </View>
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Value</Text>
          <ForgeCard variant="inset" style={editorStyles.fieldCard}>
            <ForgeTextInput accessibilityLabel="Attribute value" value={draft.value} onChangeText={(nextValue) => setDraft((current) => ({ ...current, value: nextValue }))} placeholder="Value (optional)" placeholderTextColor={theme.textDisabled} style={[editorStyles.input, { color: theme.textPrimary }]} />
          </ForgeCard>
        </View>
        <View style={editorStyles.formSection}>
          <Text style={[editorStyles.label, { color: theme.slate }]}>Icon</Text>
          <ForgeCard variant="inset">
            <Pressable accessibilityRole="button" accessibilityLabel="Choose attribute icon" onPress={() => setSelectingIcon((current) => !current)} style={editorStyles.row}>
              <Icon name={draft.icon} size={22} color={theme.textPrimary} />
              <Text style={[editorStyles.rowLabel, { color: theme.textPrimary }]}>Choose icon</Text>
              <Icon name={selectingIcon ? 'chevron-down' : 'chevron-forward'} size={20} color={theme.slate} />
            </Pressable>
            {selectingIcon ? <View style={[editorStyles.iconChoices, { borderTopColor: theme.divider }]} accessibilityRole="radiogroup">
              {icons.map((icon) => <Pressable key={icon} accessibilityRole="radio" accessibilityLabel={`Use ${icon} icon`} accessibilityState={{ checked: icon === draft.icon }} onPress={() => { setDraft((current) => ({ ...current, icon })); setSelectingIcon(false); }} style={({ pressed }) => [editorStyles.iconChoice, pressed && pressedFeedback]}><Icon name={icon} size={22} color={theme.textPrimary} />{icon === draft.icon ? <Icon name="check" size={16} color={theme.selectionIndicator} weight="bold" /> : null}</Pressable>)}
            </View> : null}
          </ForgeCard>
        </View>
        {onDelete ? <Pressable accessibilityRole="button" accessibilityLabel="Remove attribute" onPress={onDelete} style={editorStyles.deleteRow}><Icon name="trash" size={18} color={theme.textDestructive} /><Text style={[editorStyles.rowLabel, { color: theme.textDestructive }]}>Remove attribute</Text></Pressable> : null}
      </ScrollView>
      <ForgeFloatingCta label="Save attribute" accessibilityLabel="Save attribute" onPress={() => onSave(draft)} disabled={!draft.label.trim()} tone="success" />
    </>
  );
}

function LiveWorkoutTypePicker({
  selectedType,
  workoutTypes,
  onBack,
  onClose,
  onSelect,
}: {
  selectedType: string;
  workoutTypes: import('../types').WorkoutTypePreference[];
  onBack: () => void;
  onClose: () => void;
  onSelect: (type: string) => void;
}) {
  const theme = useForgeTheme();
  return (
    <>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title="Workout type"
        onClose={onClose}
        closeAccessibilityLabel="Close edit live workout"
        leading={<SheetBackButton onPress={onBack} />}
      />
      <ScrollView style={editorStyles.editorScroll} contentContainerStyle={editorStyles.typePickerContent} showsVerticalScrollIndicator={false}>
        <View accessibilityRole="radiogroup">
        <ForgeCard variant="inset">
          {workoutTypes.map((type) => {
            const selected = type.name === selectedType;
            return (
              <Pressable
                key={type.id}
                accessibilityRole="radio"
                accessibilityLabel={type.name}
                accessibilityState={{ checked: selected }}
                onPress={() => onSelect(type.name)}
                style={[
                  editorStyles.typeChoice,
                  selected && { backgroundColor: theme.successSurface },
                  workoutTypes.indexOf(type) > 0
                    ? { borderTopColor: theme.divider }
                    : { borderTopWidth: 0 },
                ]}
              >
                <Icon name={workoutTypeIcon(type)} size={20} color={theme.textPrimary} />
                <Text style={[editorStyles.rowLabel, { color: theme.textPrimary }]}>{type.name}</Text>
                {selected ? <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" /> : null}
              </Pressable>
            );
          })}
        </ForgeCard>
        </View>
      </ScrollView>
    </>
  );
}

function SheetBackButton({ onPress }: { onPress: () => void }) {
  const theme = useForgeTheme();
  return (
    <HeaderAction
      accessibilityLabel="Back to edit workout"
      icon="chevron-back"
      iconOnly
      onPress={onPress}
      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
    />
  );
}

function commentHeight(value: string): number {
  const lines = value.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 38)), 0);
  return Math.min(156, Math.max(52, lines * 21 + 20));
}

const editorStyles = StyleSheet.create({
  sheet: { maxHeight: '84%', paddingHorizontal: 20, paddingBottom: 12 },
  editorScroll: { flexGrow: 0, flexShrink: 1 },
  editorContent: { paddingTop: 14, paddingBottom: 94, gap: 18 },
  // Type selection commits immediately, so it has no docked confirmation action.
  // Keep only comfortable breathing room: this lets the sheet stop at its useful height.
  typePickerContent: { paddingTop: 22, paddingBottom: 20 },
  formSection: { gap: 8 },
  attributeCards: { gap: 10 },
  card: { padding: 14, gap: 10, marginTop: 10 },
  fieldCard: { paddingHorizontal: 14 },
  label: { ...typeScale.label },
  input: { minHeight: 52, paddingVertical: 0, textAlignVertical: 'center', ...typeScale.body },
  note: { minHeight: 52, paddingTop: 14, paddingBottom: 12, textAlignVertical: 'top' },
  row: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeChoice: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1, ...typeScale.label },
  rowValue: { maxWidth: '48%', ...typeScale.supporting, textAlign: 'right' },
  deleteRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconChoices: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconChoice: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, position: 'relative' },
  liveAttributesSection: { paddingBottom: 10, gap: 8 },
  liveAttributeInput: { minWidth: 82, maxWidth: 148, minHeight: 44, ...typeScale.supporting, textAlign: 'right' },
});
