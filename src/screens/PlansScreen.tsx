import React, { useCallback, useEffect, useState } from 'react';
import { Image, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { NestableDraggableFlatList, NestableScrollContainer, ScaleDecorator } from 'react-native-draggable-flatlist';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { ForgeActionSheetAction } from '../components/ui';
import {
  AnchoredMenuActions,
  AppScreen,
  ForgeActionSheet,
  ForgeAnchoredMenu,
  ForgeBackButton,
  ForgeBottomSheetHandle,
  ForgeCard,
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
  pressedFeedbackSubtle,
  selectionHaptic,
  useAnchoredMenu,
} from '../components/ui';
import { useForgeTheme } from '../theme/ThemeProvider';
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
import { workoutTypeIcon } from './settings/workoutTypeIcon';
import { useForgeDockScrollInset } from '../components/DockChrome';

type Props = RootTabScreenProps<'Plans'>;

export function PlansScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const dockScrollInset = useForgeDockScrollInset();
  const { preferences } = useSettings();
  const { plans, standaloneRoutines, createPlan, deletePlan, deleteRoutine, duplicateRoutine, moveRoutine, updatePlan, reorderPlans, reorderRoutines } = usePlans();
  const { startWorkout, completedWorkouts } = useWorkouts();
  const createMenu = useAnchoredMenu();
  const [routineTarget, setRoutineTarget] = useState<WorkoutRoutine | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
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
  const handlePlansScrollOffset = useCallback((offset: number): void => {
    setHeaderElevated(offset > 1);
  }, []);

  useEffect(() => {
    if (!route.params?.openCreation) return;
    createMenu.open();
    navigation.setParams({ openCreation: undefined });
  }, [navigation, route.params?.openCreation]);

  const startRoutine = (routine: WorkoutRoutine, withHaptic = true): void => {
    if (withHaptic) selectionHaptic();
    const planName = routine.planId
      ? plans.find((plan) => plan.id === routine.planId)?.name
      : undefined;
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
      planId: routine.planId,
      exercises: routineExercisesWithNextSessionTargets(routine, completedWorkouts),
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
    setRoutineTarget(routine);
  };
  const renamePlan = (planId: string, name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updatePlan(planId, (plan) => ({ ...plan, name: trimmed }));
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
  const routineOptionActions = (routine: WorkoutRoutine): ForgeActionSheetAction[] => {
    const canMove = moveDestinations(routine).length > 0;
    return [
      { label: 'Start', icon: 'play', onPress: () => startRoutine(routine, false) },
      { label: 'Edit', icon: 'note', onPress: () => openRoutine(routine, false) },
      { label: 'Duplicate', icon: 'duplicate', onPress: () => duplicate(routine) },
      { label: 'Visualize', icon: 'info', onPress: () => viewRoutine(routine, false) },
      ...(canMove
        ? [{ label: 'Move to…', icon: 'arrow-forward' as IconName, dismiss: false, onPress: () => setMoveMode(true) }]
        : []),
      { label: 'Delete', icon: 'trash', tone: 'destructive' as const, onPress: () => removeRoutine(routine.id) },
    ];
  };
  const addPlan = (): void => {
    reflowRows();
    createPlan();
  };
  const removePlan = (id: string): void => {
    reflowRows();
    deletePlan(id);
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
  const removeRoutine = (id: string): void => {
    reflowRows();
    deleteRoutine(id);
  };
  const startBlankWorkout = (): void => {
    selectionHaptic();
    startWorkout();
    navigation.navigate('ActiveWorkout');
  };
  const addRoutine = (planId?: string): void => {
    createMenu.close();
    navigation.navigate('RoutineEditor', { mode: 'create', planId });
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
                onToggleEdit={() => { lightHaptic(); setEditing((value) => !value); }}
                onAdd={createMenu.open}
                addRef={createMenu.ref}
                editLabel="Edit plans"
                doneLabel="Done editing plans"
                addLabel="Create workout, routine, or plan"
                testID="plans-header-actions"
              />
            ) : (
              <View ref={createMenu.ref} collapsable={false}>
                <HeaderAction
                  accessibilityLabel="Create workout, routine, or plan"
                  icon="add"
                  iconOnly
                  onPress={createMenu.open}
                  variant={theme.colorScheme === 'dark' ? 'ghost' : 'secondary'}
                  style={theme.colorScheme === 'dark' ? styles.darkHeaderAction : undefined}
                />
              </View>
            )}
          </View>
          {headerElevated ? <HeaderEdge /> : null}
        </View>
        <Animated.View
          key={editing ? 'edit' : 'view'}
          entering={reducedMotion ? undefined : FadeIn.duration(200)}
          style={styles.listArea}
        >
        {editing && Platform.OS !== 'web' ? (
          <NestableScrollContainer
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: dockScrollInset }]}
            showsVerticalScrollIndicator={false}
            onScroll={(event) => handlePlansScrollOffset(event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            {standaloneRoutines.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Routines</Text>
                <ForgeCard variant="base" style={styles.groupedCard}>
                  <NestableDraggableFlatList
                    data={standaloneRoutines}
                    keyExtractor={(routine) => routine.id}
                    activationDistance={12}
                    onDragEnd={({ data }) => reorderRoutines(data, undefined)}
                    renderItem={({ item, drag, isActive, getIndex }) => (
                      <ScaleDecorator activeScale={1.02}>
                        <RoutineRow
                          routine={item}
                          workoutTypes={preferences.workoutTypes}
                          last={(getIndex() ?? 0) === standaloneRoutines.length - 1}
                          editing
                          drag={drag}
                          isActive={isActive}
                          onStart={() => startRoutine(item)}
                          onOpenOptions={() => routineActions(item)}
                          onOpenEditor={() => openRoutine(item)}
                          onDelete={() => removeRoutine(item.id)}
                        />
                      </ScaleDecorator>
                    )}
                  />
                </ForgeCard>
              </View>
            ) : null}
            {plans.length > 0 ? <Text style={[styles.sectionTitle, styles.plansTitleEdit]}>Plans</Text> : null}
            {/* Plans render as a plain list (not draggable), so each plan's own
                routine list is only singly-nested under the scroll container —
                the pattern the standalone list uses and the one that measures
                correctly. Nesting a draggable list inside a draggable plan cell
                is what broke routine reordering (the measureLayout warnings). */}
            {plans.map((plan, index) => (
              <View key={plan.id} style={styles.planRow}>
                <PlanCard
                  plan={plan}
                  workoutTypes={preferences.workoutTypes}
                  editing
                  canMoveUp={index > 0}
                  canMoveDown={index < plans.length - 1}
                  onMoveUp={() => movePlan(index, -1)}
                  onMoveDown={() => movePlan(index, 1)}
                  onReorderRoutines={(routines) => reorderRoutines(routines, plan.id)}
                  onAddRoutine={() => addRoutine(plan.id)}
                  onOpenRoutineOptions={routineActions}
                  onOpenRoutineEditor={openRoutine}
                  onStartRoutine={startRoutine}
                  onDeleteRoutine={(routine) => removeRoutine(routine.id)}
                  onRename={(name) => renamePlan(plan.id, name)}
                  onDelete={() => removePlan(plan.id)}
                />
              </View>
            ))}
          </NestableScrollContainer>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: dockScrollInset }]}
            showsVerticalScrollIndicator={false}
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => handlePlansScrollOffset(event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            <View style={styles.listHeader}>
              {standaloneRoutines.length > 0 ? (
                <Section title="Routines">
                  <ForgeCard variant="base" style={styles.groupedCard}>
                    {standaloneRoutines.map((routine, index) => (
                      <RoutineRow
                        key={routine.id}
                        routine={routine}
                        workoutTypes={preferences.workoutTypes}
                        last={index === standaloneRoutines.length - 1}
                        editing={editing}
                        onStart={() => startRoutine(routine)}
                        onOpenOptions={() => routineActions(routine)}
                        onOpenEditor={() => openRoutine(routine)}
                        onDelete={() => removeRoutine(routine.id)}
                      />
                    ))}
                  </ForgeCard>
                </Section>
              ) : null}
              {plans.length > 0 ? <Text style={styles.sectionTitle}>Plans</Text> : null}
            </View>
            {plans.map((plan, index) => (
              <View key={plan.id} style={styles.planRow}>
                <PlanCard
                  plan={plan}
                  workoutTypes={preferences.workoutTypes}
                  editing={editing}
                  canMoveUp={index > 0}
                  canMoveDown={index < plans.length - 1}
                  onMoveUp={() => movePlan(index, -1)}
                  onMoveDown={() => movePlan(index, 1)}
                  onAddRoutine={() => addRoutine(plan.id)}
                  onOpenRoutineOptions={routineActions}
                  onOpenRoutineEditor={openRoutine}
                  onStartRoutine={startRoutine}
                  onDeleteRoutine={(routine) => removeRoutine(routine.id)}
                  onRename={(name) => renamePlan(plan.id, name)}
                  onDelete={() => removePlan(plan.id)}
                />
              </View>
            ))}
            {!standaloneRoutines.length && !plans.length ? <EmptyPlans /> : null}
          </ScrollView>
        )}
        </Animated.View>
        <ForgeAnchoredMenu
          visible={createMenu.visible}
          anchor={createMenu.anchor}
          onClose={createMenu.close}
          testID="plans-creation-popover"
        >
          <AnchoredMenuActions
            onClose={createMenu.close}
            actions={[
              { label: 'New workout', icon: 'fitness', onPress: startBlankWorkout },
              { label: 'New routine', icon: 'book', onPress: () => addRoutine() },
              { label: 'New workout plan', icon: 'layers', onPress: addPlan },
            ]}
          />
        </ForgeAnchoredMenu>
        <ForgeActionSheet
          visible={routineTarget !== null}
          onClose={() => { setRoutineTarget(null); setMoveMode(false); }}
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


function PlanCard({
  plan,
  workoutTypes,
  editing,
  drag,
  isActive,
  onReorderRoutines,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onAddRoutine,
  onOpenRoutineOptions,
  onOpenRoutineEditor,
  onStartRoutine,
  onDeleteRoutine,
  onRename,
  onDelete,
}: {
  plan: WorkoutPlan;
  workoutTypes: WorkoutTypePreference[];
  editing: boolean;
  drag?: () => void;
  isActive?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onReorderRoutines?: (routines: WorkoutRoutine[]) => void;
  onAddRoutine: () => void;
  onOpenRoutineOptions: (routine: WorkoutRoutine) => void;
  onOpenRoutineEditor: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(plan.name);
  const commitRename = (): void => {
    setRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== plan.name) onRename(trimmed);
    else setDraftName(plan.name);
  };
  const count = `${plan.routines.length} ${plan.routines.length === 1 ? 'routine' : 'routines'}`;
  const header = renaming ? (
    <View style={[styles.planHeader, styles.planOptions]}>
      <ForgeTextInput
        autoFocus
        value={draftName}
        onChangeText={setDraftName}
        onSubmitEditing={commitRename}
        onBlur={commitRename}
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel={`Rename ${plan.name}`}
        style={styles.planNameInput}
      />
    </View>
  ) : editing ? (
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
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planCount}>{count}</Text>
      </View>
      {/* Rename lives only in edit mode; the normal card header is a clean label. */}
      <Pressable
        testID={`plan-header-${plan.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Rename ${plan.name}`}
        hitSlop={8}
        onPress={() => { selectionHaptic(); setDraftName(plan.name); setRenaming(true); }}
        style={({ pressed }) => [styles.planEditTitle, pressed && pressedFeedbackSubtle]}
      >
        <Icon name="note" size={18} color={theme.slate} />
      </Pressable>
    </View>
  ) : (
    <View style={[styles.planHeader, styles.planOptions]}>
      <View style={styles.planHeadText}>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planCount}>{count}</Text>
      </View>
    </View>
  );
  return (
    <ForgeCard variant="base" style={[styles.planCard, isActive && styles.rowActive]}>
      {/* The whole plan card is one swipe target, so the delete reveal spans the
          entire card rather than just the header strip. Routine rows nest their
          own swipe inside; the inner gesture wins when a row is swiped. */}
      <SwipeToDeleteRow
        enabled={editing}
        onDelete={onDelete}
        deleteAccessibilityLabel={`Delete ${plan.name}`}
        contentBackgroundColor={theme.surface}
        borderRadius={24}
        deleteWidth={64}
        deleteIconSize={20}
      >
        <View style={styles.planCardSurface}>
          {header}
          {editing && onReorderRoutines ? (
          <NestableDraggableFlatList
            data={plan.routines}
            keyExtractor={(routine) => routine.id}
            activationDistance={12}
            onDragEnd={({ data }) => onReorderRoutines(data)}
            renderItem={({ item, drag: routineDrag, isActive: routineActive, getIndex }) => (
              <ScaleDecorator activeScale={1.02}>
                <RoutineRow
                  routine={item}
                  workoutTypes={workoutTypes}
                  last={(getIndex() ?? 0) === plan.routines.length - 1}
                  editing
                  drag={routineDrag}
                  isActive={routineActive}
                  onStart={() => onStartRoutine(item)}
                  onOpenOptions={() => onOpenRoutineOptions(item)}
                  onOpenEditor={() => onOpenRoutineEditor(item)}
                  onDelete={() => onDeleteRoutine(item)}
                />
              </ScaleDecorator>
            )}
          />
        ) : (
          plan.routines.map((routine, index) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              workoutTypes={workoutTypes}
              last={index === plan.routines.length - 1}
              editing={editing}
              onStart={() => onStartRoutine(routine)}
              onOpenOptions={() => onOpenRoutineOptions(routine)}
              onOpenEditor={() => onOpenRoutineEditor(routine)}
              onDelete={() => onDeleteRoutine(routine)}
            />
          ))
        )}
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

// A drag grab-rail, matching the dashboard tile handle. Rendered only in edit
// mode; a stationary press grabs the row without competing with the horizontal
// swipe-to-delete gesture that wraps the same row.
function DragRail({ label, onDrag, disabled }: { label: string; onDrag: () => void; disabled?: boolean }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={onDrag}
      disabled={disabled}
      hitSlop={8}
      style={styles.dragRail}
    >
      <Icon name="drag" size={18} color={theme.muted} />
    </Pressable>
  );
}

function RoutineRow({
  routine,
  workoutTypes,
  last,
  editing,
  drag,
  isActive,
  onStart,
  onOpenOptions,
  onOpenEditor,
  onDelete,
}: {
  routine: WorkoutRoutine;
  workoutTypes: WorkoutTypePreference[];
  last: boolean;
  editing: boolean;
  drag?: () => void;
  isActive?: boolean;
  onStart: () => void;
  onOpenOptions: () => void;
  onOpenEditor: () => void;
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
      onDelete={onDelete}
      deleteAccessibilityLabel={`Delete ${routine.name}`}
      contentBackgroundColor={theme.surface}
      insetDeleteButton
      deleteWidth={64}
      deleteIconSize={20}
    >
      <View style={[styles.routineRow, isActive && styles.rowActive]}>
        {!last ? <View pointerEvents="none" style={styles.rowSeparator} /> : null}
        {editing && drag ? (
          <DragRail label={`Reorder ${routine.name}`} onDrag={drag} disabled={isActive} />
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
          accessibilityLabel={editing ? `Edit ${routine.name}` : `Routine actions for ${routine.name}`}
          unstable_pressDelay={80}
          onPress={editing ? onOpenEditor : onOpenOptions}
          style={({ pressed }) => [styles.routineCopy, pressed && pressedFeedbackSubtle]}
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
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.empty}>
      <Image
        testID="plans-empty-illustration"
        source={require('../../assets/illustrations/empty-plans.png')}
        style={styles.emptyIllustration}
        tintColor={theme.muted}
        resizeMode="contain"
        accessible={false}
      />
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
    listArea: { flex: 1 },
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
    // A dragged card lifts via ScaleDecorator + a soft iOS shadow. No Android
    // `elevation` bump: with the card's overflow-hidden rounding, a raised
    // elevation renders square corners mid-drag.
    rowActive: { shadowColor: theme.shadow, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
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
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
    },
    planOptions: {
      minWidth: 0,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planHeadText: { flex: 1, minWidth: 0, gap: 2 },
    // A confident card header: bolder and a step larger than the routine rows it
    // owns and the section label above it, so the plan reads as their parent.
    planName: { fontFamily: typography.bold, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3, color: theme.ink },
    planNameInput: { flex: 1, fontFamily: typography.bold, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3, color: theme.ink, paddingVertical: 0, margin: 0 },
    planCount: { ...typeScale.caption, color: theme.muted },
    moveList: { marginHorizontal: 20, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surface },
    moveRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    moveIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    moveLabel: { flex: 1, minWidth: 0, ...typeScale.controlLabel, color: theme.ink },
    routineRow: {
      position: 'relative',
      minHeight: 76,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    // Inset hairline between routine rows, aligned under the routine name.
    rowSeparator: {
      position: 'absolute',
      left: 70,
      right: 16,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
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
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    addToPlanText: { ...typeScale.controlLabel, color: theme.slate },
    empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 79, gap: 8 },
    emptyIllustration: { width: 210, height: 150, marginBottom: -14, opacity: 0.78 },
    emptyTitle: { ...typeScale.sectionTitle, color: theme.ink },
    emptyText: {
      ...typeScale.body,
      color: theme.slate,
      textAlign: 'center',
      marginBottom: 8,
    },
  });
