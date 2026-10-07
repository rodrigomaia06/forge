import { ForgePressable as Pressable } from '../components/ui/ForgePressable';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, LayoutAnimation, Platform, StyleSheet, UIManager, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import Animated, { scrollTo, useAnimatedRef, useAnimatedScrollHandler, useFrameCallback, useSharedValue, type SharedValue, type FrameInfo } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ForgeActionSheetAction } from '../components/ui';
import {
  AppScreen,
  ForgeActionSheet,
  ForgeBackButton,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput,
  HeaderAction,
  HeaderEditActions,
  HeaderEdge,
  Icon,
  lightHaptic,
  ScreenTitle,
  SwipeToDeleteRow,
  pressedFeedback,
  pressedFeedbackSubtle,
  selectionHaptic,
  successHaptic,
  useAfterSheetClose,
} from '../components/ui';
import { useForgeTheme } from '../theme/ThemeProvider';
import { scaleUI } from '../theme/scale';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing, typography, typeScale } from '../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../theme/motion';
import { usePlans } from '../state/PlansContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkouts } from '../state/WorkoutContext';
import { routineExercisesWithNextSessionTargets } from '../domain/workouts/nextSessionTargets';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import type {
  IconName,
  RootTabScreenProps,
  WorkoutPlan,
  WorkoutRoutine,
  WorkoutTypePreference,
} from '../types';
import { resolveWorkoutTypeIcon } from './settings/workoutTypeIcon';
import { useForgeDockScrollInset } from '../components/DockChrome';
import { EmptyState, PlansArt } from '../components/EmptyState';
import { RoutineDragHandle, RoutineReorderGroup } from './plans/RoutineReorderGroup';
import { useStartWorkoutGuard } from './useStartWorkoutGuard';
import { shareItem } from '../utils/shareItem';

type Props = RootTabScreenProps<'Plans'>;
const ROUTINE_ROW_HEIGHT = 76;
const AUTOSCROLL_EDGE = 72;
const AUTOSCROLL_MAX_STEP = 12;

/** Coordination a routine group needs from the Plans root list. */
type RoutineReorderCoordination = {
  outerScrollOffset: SharedValue<number>;
  reducedMotion: boolean;
  dragging: boolean;
  onDragStateChange: (active: boolean) => void;
  dragPointerY: SharedValue<number | null>;
  onDragBoundsChange: (canMoveUp: boolean, canMoveDown: boolean) => void;
};

export function PlansScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const dockScrollInset = useForgeDockScrollInset();
  const { preferences } = useSettings();
  const { plans, standaloneRoutines, createPlan, deletePlan, deleteRoutine, duplicateRoutine, moveRoutine, updatePlan, reorderPlans, reorderRoutines } = usePlans();
  const { startWorkout, completedWorkouts } = useWorkouts();
  const { guardStart, notice: resumeNotice } = useStartWorkoutGuard();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [routineTarget, setRoutineTarget] = useState<WorkoutRoutine | null>(null);
  const [planTarget, setPlanTarget] = useState<WorkoutPlan | null>(null);
  // Present delete/edit follow-ups only after the options sheet has fully closed,
  // so iOS never drops the second Modal.
  const { runAfterClose, onClosed: onOptionsClosed } = useAfterSheetClose();
  const [planEditTarget, setPlanEditTarget] = useState<WorkoutPlan | null>(null);
  const [routinePendingDelete, setRoutinePendingDelete] = useState<WorkoutRoutine | null>(null);
  const [planPendingDelete, setPlanPendingDelete] = useState<WorkoutPlan | null>(null);
  // Bumped to slide an open swipe row closed when its delete confirmation is
  // cancelled; the row stays open behind the confirmation until then.
  const [swipeCloseSignal, setSwipeCloseSignal] = useState(0);
  const [moveMode, setMoveMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [routineDragging, setRoutineDragging] = useState(false);
  const plansListRef = useAnimatedRef<FlatList<WorkoutPlan>>();
  const plansViewportRef = useRef<View>(null);
  const plansContentHeight = useSharedValue(0);
  const plansViewportTop = useSharedValue(0);
  const plansViewportHeight = useSharedValue(0);
  const dragPointerY = useSharedValue<number | null>(null);
  const dragCanMoveUp = useRef(false);
  const dragCanMoveDown = useRef(false);
  const dragActive = useRef(false);
  const animatedScrollOffset = useSharedValue(0);
  const headerElevatedOnUi = useSharedValue(false);
  const hasContent = plans.length > 0 || standaloneRoutines.length > 0;
  const reducedMotion = useForgeReducedMotion();
  // Animate the list reflow when a plan/routine row is created or deleted.
  const reflowRows = (): void => {
    if (reducedMotion || Platform.OS === 'web') return;
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
      UIManager.setLayoutAnimationEnabledExperimental(true);
    LayoutAnimation.configureNext(
      LayoutAnimation.create(forgeMotion.transition, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
  };
  const plansScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offset = event.contentOffset.y;
      const wasElevated = headerElevatedOnUi.get();
      animatedScrollOffset.set(offset);
      if ((offset > 1) !== wasElevated) {
        headerElevatedOnUi.set(offset > 1);
        scheduleOnRN(setHeaderElevated, offset > 1);
      }
    },
  });

  const measurePlansViewport = useCallback((): void => {
    requestAnimationFrame(() => {
      plansViewportRef.current?.measureInWindow((_x, y, _width, height) => {
        plansViewportTop.set(y);
        plansViewportHeight.set(height);
      });
    });
  }, []);

  // Pointer, edge scrolling and held-row compensation stay on the UI runtime.
  // Normalize the step to elapsed time so 120 Hz devices do not scroll twice as fast.
  const autoscrollFrame = useCallback(
    (frame: FrameInfo) => {
      'worklet';
      const pointer = dragPointerY.get();
      if (pointer == null) return;
      const height = plansViewportHeight.get();
      const top = plansViewportTop.get();
      const maxOffset = Math.max(0, plansContentHeight.get() - height);
      if (height <= 0 || maxOffset <= 0) return;
      let intensity = 0;
      if (pointer < top + AUTOSCROLL_EDGE)
        intensity = -Math.min(1, (top + AUTOSCROLL_EDGE - pointer) / AUTOSCROLL_EDGE);
      else if (pointer > top + height - AUTOSCROLL_EDGE)
        intensity = Math.min(1, (pointer - top - height + AUTOSCROLL_EDGE) / AUTOSCROLL_EDGE);
      if (intensity === 0) return;
      const delta =
        (AUTOSCROLL_MAX_STEP * intensity * Math.min(frame.timeSincePreviousFrame ?? 16.67, 32)) /
        16.67;
      const current = animatedScrollOffset.get();
      const next = Math.max(0, Math.min(maxOffset, current + delta));
      if (next === current) return;
      animatedScrollOffset.set(next);
      scrollTo(plansListRef, 0, next, false);
    },
    [
      dragPointerY,
      plansViewportHeight,
      plansViewportTop,
      plansContentHeight,
      animatedScrollOffset,
      plansListRef,
    ],
  );
  const autoscroll = useFrameCallback(autoscrollFrame, false);

  useEffect(() => {
    autoscroll.setActive(routineDragging);
    return () => autoscroll.setActive(false);
  }, [autoscroll, routineDragging]);

  const handleRoutineDragState = useCallback((active: boolean): void => {
    dragActive.current = active;
    setRoutineDragging(active);
    if (active) {
      measurePlansViewport();
    } else {
      dragPointerY.set(null);
      dragCanMoveUp.current = false;
      dragCanMoveDown.current = false;
    }
  }, [measurePlansViewport, dragPointerY]);
  const handleRoutineDragBounds = useCallback((canMoveUp: boolean, canMoveDown: boolean): void => {
    dragCanMoveUp.current = canMoveUp;
    dragCanMoveDown.current = canMoveDown;
  }, []);

  // Always restore parent scrolling: on edit exit, navigation away, and unmount.
  useEffect(() => {
    if (editing) return;
    dragActive.current = false;
    setRoutineDragging(false);
    dragPointerY.set(null);
  }, [editing, dragPointerY]);
  useEffect(() => navigation.addListener('blur', () => {
    dragActive.current = false;
    setRoutineDragging(false);
    dragPointerY.set(null);
  }), [navigation, dragPointerY]);
  useEffect(() => () => dragPointerY.set(null), [dragPointerY]);

  useEffect(() => {
    if (!route.params?.openCreation) return;
    setCreateSheetOpen(true);
    navigation.setParams({ openCreation: undefined });
  }, [navigation, route.params?.openCreation]);

  const coordination: RoutineReorderCoordination = {
    outerScrollOffset: animatedScrollOffset,
    reducedMotion,
    dragging: routineDragging,
    onDragStateChange: handleRoutineDragState,
    dragPointerY,
    onDragBoundsChange: handleRoutineDragBounds,
  };

  const startRoutine = (routine: WorkoutRoutine, withHaptic = true): void => {
    if (withHaptic) selectionHaptic();
    const planName = routine.planId
      ? plans.find((plan) => plan.id === routine.planId)?.name
      : undefined;
    guardStart(() => {
      startWorkout({
        name: planName ? `${planName} - ${routine.name}` : routine.name,
        type: routine.type,
        note: routine.note,
        // A routine owns the reusable field names. Each workout starts its own blank values.
        attributes: routine.attributes
          ? Object.fromEntries(Object.keys(routine.attributes).map((label) => [label, '']))
          : undefined,
        attributeIcons: routine.attributeIcons,
        routineId: routine.id,
        routineTemplate: routine,
        planId: routine.planId,
        exercises: routineExercisesWithNextSessionTargets(routine, completedWorkouts),
      });
      navigation.navigate('ActiveWorkout');
    });
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
    setRoutineTarget(routine);
  };
  const duplicate = (routine: WorkoutRoutine): void => {
    reflowRows();
    duplicateRoutine(routine.id);
  };
  const move = (routine: WorkoutRoutine, planId?: string): void => {
    reflowRows();
    moveRoutine(routine.id, planId);
  };
  // Destinations a routine can move to: out to standalone (when it's in a plan)
  // plus every other plan. Kept behind a single "Move to…" step so the option
  // list stays short no matter how many plans exist.
  const moveDestinations = (routine: WorkoutRoutine): { key: string; label: string; icon: IconName; planId?: string }[] => [
    ...(routine.planId ? [{ key: 'standalone', label: 'Routines', icon: 'book' as IconName, planId: undefined }] : []),
    ...plans
      .filter((plan) => plan.id !== routine.planId)
      .map((plan) => ({ key: plan.id, label: plan.name, icon: 'layers' as IconName, planId: plan.id })),
  ];
  // Tapping a routine opens this popup in both modes. Outside edit mode it is
  // the quick-use set (Start, Visualize, Edit); in edit mode it is the modify
  // set (Move to, Edit, Duplicate, Delete). Delete routes through the shared
  // confirmation; the swipe Delete remains available too.
  const routineOptionActions = (routine: WorkoutRoutine): ForgeActionSheetAction[] => {
    if (editing) {
      const canMove = moveDestinations(routine).length > 0;
      return [
        ...(canMove
          ? [{ label: 'Move to…', icon: 'arrow-forward' as IconName, dismiss: false, onPress: () => setMoveMode(true) }]
          : []),
        { label: 'Edit', icon: 'note', onPress: () => openRoutine(routine, false) },
        { label: 'Duplicate', icon: 'duplicate', onPress: () => duplicate(routine) },
        { label: 'Share', icon: 'share', onPress: () => runAfterClose(() => shareItem({ kind: 'routine', id: routine.id })) },
        {
          label: 'Delete',
          icon: 'trash',
          tone: 'destructive' as const,
          // Confirm only after the options sheet has dismissed; iOS drops a Modal
          // presented while another is mid-dismiss.
          onPress: () => { const target = routine; runAfterClose(() => requestDeleteRoutine(target)); },
        },
      ];
    }
    return [
      { label: 'Start', icon: 'play', onPress: () => startRoutine(routine, false) },
      { label: 'Visualize', icon: 'info', onPress: () => viewRoutine(routine, false) },
      { label: 'Edit', icon: 'note', onPress: () => openRoutine(routine, false) },
      { label: 'Share', icon: 'share', onPress: () => runAfterClose(() => shareItem({ kind: 'routine', id: routine.id })) },
    ];
  };
  const addPlan = (): void => {
    reflowRows();
    createPlan();
  };
  // Deletion is destructive, so both the swipe reveal and the options-sheet
  // Delete route through a confirmation card rather than removing immediately.
  const requestDeleteRoutine = (routine: WorkoutRoutine): void => {
    setRoutinePendingDelete(routine);
  };
  const confirmDeleteRoutine = (): void => {
    const routine = routinePendingDelete;
    setRoutinePendingDelete(null);
    if (!routine) return;
    reflowRows();
    deleteRoutine(routine.id);
  };
  const requestDeletePlan = (plan: WorkoutPlan): void => {
    setPlanPendingDelete(plan);
  };
  const confirmDeletePlan = (): void => {
    const plan = planPendingDelete;
    setPlanPendingDelete(null);
    if (!plan) return;
    reflowRows();
    deletePlan(plan.id);
  };
  // Plans can't drag-reorder (that would re-nest the routine lists and break
  // routine drag), so edit mode moves a plan one slot with up/down controls.
  const movePlan = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= plans.length) return;
    const next = [...plans];
    [next[index], next[target]] = [next[target], next[index]];
    selectionHaptic();
    reflowRows();
    reorderPlans(next);
  };
  const startBlankWorkout = (): void => {
    selectionHaptic();
    guardStart(() => {
      startWorkout();
      navigation.navigate('ActiveWorkout');
    });
  };
  const addRoutine = (planId?: string): void => {
    setCreateSheetOpen(false);
    navigation.navigate('RoutineEditor', { mode: 'create', planId });
  };
  const toggleEditing = (): void => {
    lightHaptic();
    setEditing((value) => !value);
  };

  return (
    <AppScreen backgroundColor={theme.background} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ScreenTitle color={theme.textPrimary}>Plans</ScreenTitle>
          <View style={styles.headerActions}>
            {hasContent ? (
              <HeaderEditActions
                editing={editing}
                onToggleEdit={toggleEditing}
                onAdd={() => setCreateSheetOpen(true)}
                editLabel="Edit plans"
                doneLabel="Done editing plans"
                addLabel="Create workout, routine, or plan"
                testID="plans-header-actions"
              />
            ) : (
              <HeaderAction
                accessibilityLabel="Create workout, routine, or plan"
                icon="add"
                iconOnly
                onPress={() => setCreateSheetOpen(true)}
                variant="ghost"
                style={{ backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated }}
              />
            )}
          </View>
          {headerElevated ? <HeaderEdge /> : null}
        </View>
        <View ref={plansViewportRef} collapsable={false} style={styles.scrollView} onLayout={measurePlansViewport}>
          <Animated.FlatList
            ref={plansListRef}
            testID="plans-scroll"
            style={styles.scrollView}
            data={plans}
            keyExtractor={(plan) => plan.id}
            extraData={{ editing, routineDragging, standaloneRoutines, workoutTypes: preferences.workoutTypes }}
            contentContainerStyle={[styles.content, { paddingBottom: dockScrollInset }]}
            showsVerticalScrollIndicator={false}
            directionalLockEnabled
            // A handle drag owns the vertical axis; disable direct list scrolling
            // so the finger reorders instead of scrolling. Edge autoscroll drives
            // the offset while the drag is held, and scrolling is restored on drop.
            scrollEnabled={!routineDragging}
            keyboardShouldPersistTaps="handled"
            onScroll={plansScrollHandler}
            onContentSizeChange={(_width, height) => { plansContentHeight.set(height); }}
            scrollEventThrottle={16}
            ListHeaderComponent={(
              <View style={styles.listHeader}>
                {standaloneRoutines.length > 0 ? (
                  <Section title="Routines">
                    <ForgeCard testID="standalone-routines-card" variant="base" style={styles.groupedCard}>
                      <RoutineReorderGroup
                        data={standaloneRoutines}
                        enabled={editing}
                        rowHeight={ROUTINE_ROW_HEIGHT}
                        reducedMotion={reducedMotion}
                        keyExtractor={(routine) => routine.id}
                        outerScrollOffset={coordination.outerScrollOffset}
                        onReorder={(routines) => reorderRoutines(routines, undefined)}
                        onDragStateChange={coordination.onDragStateChange}
                        dragPointerY={coordination.dragPointerY}
                        onDragBoundsChange={coordination.onDragBoundsChange}
                        renderItem={({ item, last, dragGesture }) => (
                          <RoutineRow
                            routine={item}
                            workoutTypes={preferences.workoutTypes}
                            last={last}
                            editing={editing}
                            dragging={routineDragging}
                            dragGesture={dragGesture}
                            closeSignal={swipeCloseSignal}
                            onStart={() => startRoutine(item)}
                            onOpenOptions={() => routineActions(item)}
                            onDelete={() => requestDeleteRoutine(item)}
                          />
                        )}
                      />
                    </ForgeCard>
                  </Section>
                ) : null}
                {plans.length > 0 ? <Text style={styles.sectionTitle}>Plans</Text> : null}
              </View>
            )}
            ListEmptyComponent={standaloneRoutines.length === 0 ? <EmptyPlans /> : null}
            renderItem={({ item: plan, index }) => (
              <View style={styles.planRow}>
                <PlanCard
                  plan={plan}
                  workoutTypes={preferences.workoutTypes}
                  editing={editing}
                  coordination={coordination}
                  swipeCloseSignal={swipeCloseSignal}
                  canMoveUp={index > 0}
                  canMoveDown={index < plans.length - 1}
                  onMoveUp={() => movePlan(index, -1)}
                  onMoveDown={() => movePlan(index, 1)}
                  onReorderRoutines={(routines) => reorderRoutines(routines, plan.id)}
                  onAddRoutine={() => addRoutine(plan.id)}
                  onOpenRoutineOptions={routineActions}
                  onStartRoutine={startRoutine}
                  onDeleteRoutine={(routine) => requestDeleteRoutine(routine)}
                  onOpenOptions={() => { lightHaptic(); setPlanTarget(plan); }}
                  onDelete={() => requestDeletePlan(plan)}
                />
              </View>
            )}
          />
        </View>
        <ForgeActionSheet
          visible={createSheetOpen}
          onClose={() => setCreateSheetOpen(false)}
          accessibilityLabel="Close create menu"
          title="Create"
          testID="plans-creation-popover"
          actions={[
            { label: 'New workout', icon: 'fitness', onPress: startBlankWorkout },
            { label: 'New routine', icon: 'book', onPress: () => addRoutine() },
            { label: 'New workout plan', icon: 'layers', onPress: addPlan },
          ]}
        />
        <ForgeActionSheet
          visible={routineTarget !== null}
          onClose={() => { setRoutineTarget(null); setMoveMode(false); }}
          onClosed={onOptionsClosed}
          accessibilityLabel="Dismiss routine options"
          title={routineTarget?.name ?? 'Routine options'}
          titleNumberOfLines={1}
          testID="plans-options-sheet"
          actions={routineTarget ? routineOptionActions(routineTarget) : []}
          replacement={
            routineTarget && moveMode
              ? (close) => (
                  <MoveDestinations
                    routine={routineTarget}
                    destinations={moveDestinations(routineTarget)}
                    onBack={() => setMoveMode(false)}
                    onClose={close}
                    onMove={(planId) => { move(routineTarget, planId); close(); }}
                  />
                )
              : null
          }
        />
        <ForgeActionSheet
          visible={planTarget !== null}
          onClose={() => setPlanTarget(null)}
          onClosed={onOptionsClosed}
          accessibilityLabel="Dismiss plan options"
          title={planTarget?.name ?? 'Plan options'}
          titleNumberOfLines={1}
          testID="plans-plan-options-sheet"
          actions={planTarget ? [
            {
              label: 'Edit plan',
              icon: 'note',
              onPress: () => {
                // Open the edit sheet only after the options sheet has dismissed,
                // so the two modals never overlap on iOS.
                const target = planTarget;
                runAfterClose(() => setPlanEditTarget(target));
              },
            },
            { label: 'Share', icon: 'share', onPress: () => runAfterClose(() => shareItem({ kind: 'plan', id: planTarget.id })) },
            {
              label: 'Delete',
              icon: 'trash',
              tone: 'destructive' as const,
              // Confirm only after the options sheet has dismissed; iOS drops a
              // Modal presented while another is mid-dismiss.
              onPress: () => { const target = planTarget; runAfterClose(() => requestDeletePlan(target)); },
            },
          ] : []}
        />
        <ForgeBottomSheet
          visible={planEditTarget !== null}
          onClose={() => setPlanEditTarget(null)}
          accessibilityLabel="Close edit plan"
          keyboardAvoiding
        >
          {(close) =>
            planEditTarget ? (
              <PlanEditSheet
                key={planEditTarget.id}
                plan={planEditTarget}
                onClose={close}
                onSave={(changes) => updatePlan(planEditTarget.id, (current) => ({ ...current, ...changes }))}
              />
            ) : null
          }
        </ForgeBottomSheet>
        <ForgeConfirmationDialog
          visible={routinePendingDelete !== null}
          title="Delete routine?"
          message={`"${routinePendingDelete?.name ?? ''}" will be removed. This can't be undone.`}
          cancelLabel="Cancel"
          confirmLabel="Delete"
          confirmTone="destructive"
          onCancel={() => { setRoutinePendingDelete(null); setSwipeCloseSignal((n) => n + 1); }}
          onConfirm={confirmDeleteRoutine}
          testID="plans-delete-routine-confirm"
        />
        <ForgeConfirmationDialog
          visible={planPendingDelete !== null}
          title="Delete plan?"
          message={`"${planPendingDelete?.name ?? ''}" will be removed. Its routines are kept and moved to Routines.`}
          cancelLabel="Cancel"
          confirmLabel="Delete"
          confirmTone="destructive"
          onCancel={() => { setPlanPendingDelete(null); setSwipeCloseSignal((n) => n + 1); }}
          onConfirm={confirmDeletePlan}
          testID="plans-delete-plan-confirm"
        />
        {resumeNotice}
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

function MoveDestinations({
  routine,
  destinations,
  onBack,
  onClose,
  onMove,
}: {
  routine: WorkoutRoutine;
  destinations: { key: string; label: string; icon: IconName; planId?: string }[];
  onBack: () => void;
  onClose: () => void;
  onMove: (planId?: string) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title="Move to"
        onClose={onClose}
        leading={<ForgeBackButton accessibilityLabel="Back to routine options" onPress={onBack} />}
      />
      <View style={styles.moveList}>
        {destinations.map((destination, index) => (
          <Pressable
            key={destination.key}
            accessibilityRole="button"
            accessibilityLabel={`Move ${routine.name} to ${destination.label}`}
            onPress={() => onMove(destination.planId)}
            style={({ pressed }) => [styles.moveRow, index > 0 && styles.divider, pressed && pressedFeedbackSubtle]}
          >
            <View style={styles.moveIcon}><Icon name={destination.icon} size={20} color={theme.slate} /></View>
            <Text style={styles.moveLabel} numberOfLines={1}>{destination.label}</Text>
            <Icon name="chevron-forward" size={18} color={theme.slate} />
          </Pressable>
        ))}
      </View>
    </>
  );
}


/** Lightweight sheet for editing a plan's name and description from the "…" menu. */
function PlanEditSheet({
  plan,
  onClose,
  onSave,
}: {
  plan: WorkoutPlan;
  onClose: () => void;
  onSave: (changes: { name: string; description?: string }) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const canSave = name.trim().length > 0;
  const save = (): void => {
    if (!canSave) return;
    onSave({ name: name.trim(), description: description.trim() || undefined });
    successHaptic();
    onClose();
  };
  return (
    <View style={styles.editSheet}>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title="Edit plan"
        onClose={onClose}
        closeAccessibilityLabel="Close edit plan"
        // Close on the left, Save (the success check) on the right — matching
        // the app's other edit forms instead of a full-width bottom button.
        closePosition="left"
        trailing={
          <HeaderAction
            accessibilityLabel="Save plan"
            icon="check"
            iconOnly
            variant="outline"
            tone="success"
            disabled={!canSave}
            haptic="none"
            onPress={save}
          />
        }
      />
      <View style={styles.editSheetBody}>
        <ForgeCard variant="nested" style={styles.editFieldCard}>
          <ForgeTextInput
            accessibilityLabel="Plan name"
            value={name}
            onChangeText={setName}
            placeholder="Plan name"
            placeholderTextColor={theme.muted}
            style={styles.editNameInput}
          />
        </ForgeCard>
        <ForgeCard variant="nested" style={styles.editFieldCard}>
          <ForgeTextInput
            accessibilityLabel="Plan description"
            value={description}
            onChangeText={setDescription}
            placeholder="Add a short description (optional)"
            placeholderTextColor={theme.muted}
            multiline
            style={styles.editDescriptionInput}
          />
        </ForgeCard>
      </View>
    </View>
  );
}

function PlanCard({
  plan,
  workoutTypes,
  editing,
  coordination,
  swipeCloseSignal,
  onReorderRoutines,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onAddRoutine,
  onOpenRoutineOptions,
  onStartRoutine,
  onDeleteRoutine,
  onOpenOptions,
  onDelete,
}: {
  plan: WorkoutPlan;
  workoutTypes: WorkoutTypePreference[];
  editing: boolean;
  coordination: RoutineReorderCoordination;
  swipeCloseSignal: number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onReorderRoutines: (routines: WorkoutRoutine[]) => void;
  onAddRoutine: () => void;
  onOpenRoutineOptions: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
  onOpenOptions: () => void;
  onDelete: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const count = `${plan.routines.length} ${plan.routines.length === 1 ? 'routine' : 'routines'}`;
  const description = plan.description?.trim();
  const header = editing ? (
    <View style={[styles.planHeader, styles.planOptions]}>
      {/* Plans reorder one slot at a time (inline drag would re-nest the routine
          lists). Up/down sit where a drag handle would, keeping routine drag. */}
      <View style={styles.planMove}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${plan.name} up`}
          disabled={!canMoveUp}
          onPress={onMoveUp}
          hitSlop={{ top: 8, bottom: 4, left: 12, right: 12 }}
          style={({ pressed }) => [styles.planMoveButton, pressed && pressedFeedbackSubtle]}
        >
          <View style={styles.flipUp}>
            <Icon name="chevron-down" size={24} color={canMoveUp ? theme.slate : theme.textDisabled} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${plan.name} down`}
          disabled={!canMoveDown}
          onPress={onMoveDown}
          hitSlop={{ top: 4, bottom: 8, left: 12, right: 12 }}
          style={({ pressed }) => [styles.planMoveButton, pressed && pressedFeedbackSubtle]}
        >
          <Icon name="chevron-down" size={24} color={canMoveDown ? theme.slate : theme.textDisabled} />
        </Pressable>
      </View>
      <View style={styles.planHeadText}>
        <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
        <Text style={styles.planCount}>{count}</Text>
      </View>
      {/* Edit mode opens the same options popup as the resting card, so plan
          editing (name + description) always runs through 'Edit plan'. */}
      <Pressable
        testID={`plan-options-${plan.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${plan.name}`}
        hitSlop={8}
        onPress={onOpenOptions}
        style={({ pressed }) => [styles.planEditTitle, pressed && pressedFeedbackSubtle]}
      >
        <Icon name="ellipsis-horizontal" size={20} color={theme.slate} />
      </Pressable>
    </View>
  ) : (
    <View style={[styles.planHeader, styles.planOptions]}>
      <View style={styles.planHeadRow}>
        <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
        {description ? (
          <Text style={styles.planDescription} numberOfLines={1}>{description}</Text>
        ) : null}
      </View>
      <Pressable
        testID={`plan-options-${plan.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${plan.name}`}
        hitSlop={8}
        onPress={onOpenOptions}
        style={({ pressed }) => [styles.planEditTitle, pressed && pressedFeedbackSubtle]}
      >
        <Icon name="ellipsis-horizontal" size={20} color={theme.slate} />
      </Pressable>
    </View>
  );
  return (
    <ForgeCard testID={`plan-card-${plan.id}`} variant="base" style={styles.planCard}>
      {/* The whole plan card is one swipe target, so the delete reveal spans the
          entire card rather than just the header strip. Routine rows nest their
          own swipe inside; the inner gesture wins when a row is swiped. */}
      <SwipeToDeleteRow
        enabled={editing}
        gestureEnabled={!coordination.dragging}
        deferCloseOnDelete
        closeSignal={swipeCloseSignal}
        onDelete={onDelete}
        deleteAccessibilityLabel={`Delete ${plan.name}`}
        contentBackgroundColor={theme.surface}
        borderRadius={24}
        deleteWidth={64}
        deleteIconSize={20}
      >
        <View style={styles.planCardSurface}>
          {header}
          {plan.routines.length > 0 ? <View style={styles.planHeaderDivider} /> : null}
          <RoutineReorderGroup
            data={plan.routines}
            enabled={editing}
            rowHeight={ROUTINE_ROW_HEIGHT}
            reducedMotion={coordination.reducedMotion}
            keyExtractor={(routine) => routine.id}
            outerScrollOffset={coordination.outerScrollOffset}
            onReorder={onReorderRoutines}
            onDragStateChange={coordination.onDragStateChange}
            dragPointerY={coordination.dragPointerY}
            onDragBoundsChange={coordination.onDragBoundsChange}
            renderItem={({ item, last, dragGesture }) => (
              <RoutineRow
                routine={item}
                workoutTypes={workoutTypes}
                last={last}
                editing={editing}
                dragging={coordination.dragging}
                dragGesture={dragGesture}
                closeSignal={swipeCloseSignal}
                onStart={() => onStartRoutine(item)}
                onOpenOptions={() => onOpenRoutineOptions(item)}
                onDelete={() => onDeleteRoutine(item)}
              />
            )}
          />
          {editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add routine to ${plan.name}`}
              unstable_pressDelay={80}
              onPress={onAddRoutine}
              style={({ pressed }) => [styles.addToPlan, pressed && pressedFeedbackSubtle]}
            >
              <Icon name="add" size={16} color={theme.textPrimary} />
              <Text style={styles.addToPlanText}>Add routine</Text>
            </Pressable>
          ) : null}
        </View>
      </SwipeToDeleteRow>
    </ForgeCard>
  );
}

function routineSummary(routine: WorkoutRoutine): string {
  return routine.exercises.length
    ? `${routine.type} · ${routine.exercises.length} ${routine.exercises.length === 1 ? 'exercise' : 'exercises'}`
    : routine.type;
}

function RoutineRow({
  routine,
  workoutTypes,
  last,
  editing,
  dragging,
  dragGesture,
  closeSignal,
  onStart,
  onOpenOptions,
  onDelete,
}: {
  routine: WorkoutRoutine;
  workoutTypes: WorkoutTypePreference[];
  last: boolean;
  editing: boolean;
  dragging: boolean;
  dragGesture?: PanGesture;
  closeSignal: number;
  onStart: () => void;
  onOpenOptions: () => void;
  onDelete: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const presentation = getWorkoutTypePresentation(
    routine.type,
    workoutTypes,
    theme,
    theme.colorScheme === 'dark' ? 0.24 : 0.14,
  );
  const typeIcon = (
    <Icon name={getRoutineTypeIcon(routine.type, workoutTypes)} size={26} color={presentation.color} />
  );
  return (
    <SwipeToDeleteRow
      enabled={editing}
      gestureEnabled={!dragging}
      deferCloseOnDelete
      closeSignal={closeSignal}
      onDelete={onDelete}
      deleteAccessibilityLabel={`Delete ${routine.name}`}
      contentBackgroundColor={theme.surface}
      insetDeleteButton
      deleteWidth={64}
      deleteIconSize={22}
    >
      <View style={styles.routineRow}>
        {!last ? <View pointerEvents="none" style={styles.rowSeparator} /> : null}
        {/* The handle is the only drag activator; a deliberate 140 ms long press
            keeps a horizontal swipe from ever starting a reorder. */}
        {editing && dragGesture ? (
          <RoutineDragHandle gesture={dragGesture}>
            <View
              accessibilityRole="button"
              accessibilityLabel={`Reorder ${routine.name}`}
              hitSlop={8}
              style={styles.dragRail}
            >
              <Icon name="drag" size={18} color={theme.muted} />
            </View>
          </RoutineDragHandle>
        ) : null}
        {editing ? (
          <View style={[styles.typeMarker, { backgroundColor: presentation.background }]}>{typeIcon}</View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start ${routine.name}`}
            unstable_pressDelay={80}
            onPress={onStart}
            style={({ pressed }) => [styles.typeMarker, { backgroundColor: presentation.background }, pressed && pressedFeedbackSubtle]}
          >
            {typeIcon}
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Routine actions for ${routine.name}`}
          unstable_pressDelay={80}
          onPress={onOpenOptions}
          style={({ pressed }) => [styles.routineCopy, pressed && pressedFeedback]}
        >
          <View style={styles.routineText}>
            <Text style={styles.routineName} numberOfLines={1}>{routine.name}</Text>
            <Text style={styles.routineSummary} numberOfLines={1}>{routineSummary(routine)}</Text>
          </View>
          <Icon name="chevron-forward" size={19} color={theme.slate} />
        </Pressable>
      </View>
    </SwipeToDeleteRow>
  );
}

function EmptyPlans() {
  const styles = useThemedStyles(createStyles);
  return (
    <EmptyState
      style={styles.empty}
      illustrationTestID="plans-empty-illustration"
      illustration={<PlansArt />}
      title="Build your first routine"
      subtitle="Use the add button above to create a routine or workout plan."
    />
  );
}

function getRoutineTypeIcon(type: string, workoutTypes: WorkoutTypePreference[]): IconName {
  return resolveWorkoutTypeIcon(type, workoutTypes);
}

const createStyles = (theme: import('../types').ForgeTheme) =>
  StyleSheet.create({
    // Root lists are a single opaque Forge surface; their row dividers provide
    // the structure, so an outer border would read as a stray white outline.
    groupedCard: { overflow: 'hidden', borderWidth: 0 },
    // ForgeCard owns the single opaque plan surface and radius. Its inner
    // swipe wrapper stays transparent so it cannot create a seam above the title.
    planCard: { overflow: 'hidden', borderWidth: 0 },
    planCardSurface: { overflow: 'hidden' },
    screen: { flex: 1 },
    scrollView: { flex: 1 },
    header: {
      position: 'relative',
      zIndex: 2,
      height: 70,
      paddingHorizontal: spacing.screen,
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: 'row',
      backgroundColor: theme.background,
    },
    darkHeaderAction: { backgroundColor: theme.surfaceMuted },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // Grab-rail for reordering — a generous, edit-only left zone like the dashboard tile handle.
    dragRail: { width: 34, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
    planEditTitle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    planMove: { width: 36, marginLeft: -2, marginRight: 6, alignItems: 'center', justifyContent: 'center' },
    planMoveButton: { height: 24, alignItems: 'center', justifyContent: 'center' },
    flipUp: { transform: [{ rotate: '180deg' }] },
    plansTitleEdit: { marginTop: 22, marginBottom: 12 },
    content: {
      paddingHorizontal: spacing.screen,
      paddingTop: 16,
    },
    listHeader: { gap: 28, paddingBottom: 11 },
    section: { gap: 11 },
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    planRow: { paddingBottom: 14 },
    planHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    planOptions: {
      // No fixed height: the header hugs a name-only plan and only grows taller
      // when a description is present, so a plain plan leaves no empty band above
      // its routine rows.
      minWidth: 0,
      paddingHorizontal: 16,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planHeadText: { flex: 1, minWidth: 0, gap: 2 },
    planHeadRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
    // The description sits just after the name as a secondary label — close to
    // the title, not pushed against the options button.
    planDescription: { flexShrink: 1, minWidth: 0, ...typeScale.supporting, color: theme.slate },
    // A full-width rule under the plan header, matched to the 1px separators
    // used between the rows of an expanded routine set table.
    planHeaderDivider: { height: 1, backgroundColor: theme.divider },
    editSheet: { paddingBottom: 28 },
    editSheetBody: { paddingHorizontal: 20, paddingTop: 6, gap: 12 },
    editFieldCard: { paddingHorizontal: 14, paddingVertical: 4 },
    editNameInput: { minHeight: 44, paddingVertical: 0, color: theme.ink, ...typeScale.cardTitle },
    editDescriptionInput: { minHeight: 60, paddingVertical: 8, color: theme.ink, ...typeScale.body },
    // A confident card header: bolder and a step larger than the routine rows it
    // owns and the section label above it, so the plan reads as their parent.
    planName: { flexShrink: 1, fontFamily: typography.bold, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3, color: theme.ink },
    planCount: { ...typeScale.caption, color: theme.muted },
    moveList: { marginHorizontal: 20, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surface },
    moveRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    moveIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    moveLabel: { flex: 1, minWidth: 0, ...typeScale.controlLabel, color: theme.ink },
    routineRow: {
      position: 'relative',
      height: ROUTINE_ROW_HEIGHT,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    // Inset 1px rule between routine rows, aligned under the routine name and
    // matched to the plan header rule and the add-routine separator.
    rowSeparator: {
      position: 'absolute',
      left: 70,
      right: 16,
      bottom: 0,
      height: 1,
      backgroundColor: theme.divider,
    },
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
      alignSelf: 'stretch',
      borderRadius: scaleUI(12),
      marginLeft: -scaleUI(8),
      paddingLeft: scaleUI(8),
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
      minHeight: 44,
      marginTop: 4,
      paddingHorizontal: 16,
      gap: 7,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      borderTopWidth: 1,
      borderTopColor: theme.divider,
    },
    addToPlanText: { ...typeScale.controlLabel, color: theme.slate },
    empty: { paddingTop: 79 },
  });
