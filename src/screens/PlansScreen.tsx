import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DraggableFlatList, {
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import {
  DraxHandle,
  DraxProvider,
  DraxScrollView,
  SortableBoardContainer,
  SortableContainer,
  SortableItem,
  useSortableBoard,
  useSortableList,
} from 'react-native-drax';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  AnchoredActionPopover,
  AppScreen,
  ForgeActionSheet,
  ForgeText as Text,
  HeaderAction,
  HeaderEdge,
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
import { forgeDockScrollInset } from '../components/DockChrome';

type Props = RootTabScreenProps<'Plans'>;
type PlanActionTarget =
  { kind: 'routine'; item: WorkoutRoutine } | { kind: 'plan'; item: WorkoutPlan };
const swipeSpring = { damping: 22, stiffness: 280, mass: 0.65, overshootClamping: true };
const standaloneRoutineColumnId = 'standalone-routines';
const planRoutineColumnId = (planId: string): string => `plan-routines:${planId}`;

function planIdFromRoutineColumn(columnId: string): string | undefined {
  return columnId === standaloneRoutineColumnId
    ? undefined
    : columnId.startsWith('plan-routines:')
      ? columnId.slice('plan-routines:'.length)
      : undefined;
}

export function PlansScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const {
    plans,
    standaloneRoutines,
    createPlan,
    reorderPlans,
    reorderRoutines,
    moveRoutine,
    deletePlan,
    deleteRoutine,
  } = usePlans();
  const { startWorkout } = useWorkouts();
  const [creationOpen, setCreationOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<PlanActionTarget | null>(null);
  const [headerElevated, setHeaderElevated] = useState(false);
  const routineDragActive = useSharedValue(false);
  const board = useSortableBoard<WorkoutRoutine>({
    keyExtractor: (routine) => routine.id,
    onTransfer: ({ item, toContainerId, toIndex }) => {
      moveRoutine(item.id, planIdFromRoutineColumn(toContainerId), toIndex);
    },
  });
  const handlePlansScrollOffset = useCallback((offset: number): void => {
    setHeaderElevated(offset > 1);
  }, []);
  const hasPlanRoutines = plans.some((plan) => plan.routines.length > 0);

  useEffect(() => {
    if (!route.params?.openCreation) return;
    setCreationOpen(true);
    navigation.setParams({ openCreation: undefined });
  }, [navigation, route.params?.openCreation]);

  const startRoutine = (routine: WorkoutRoutine, withHaptic = true): void => {
    if (withHaptic) selectionHaptic();
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
    setActionTarget({ kind: 'routine', item: routine });
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
    navigation.navigate('RoutineEditor', { mode: 'create', planId });
  };

  return (
    <AppScreen backgroundColor={theme.background} edges={['top']}>
      <DraxProvider
        style={styles.screen}
        onDragStart={() => {
          routineDragActive.value = true;
        }}
        onDragEnd={() => {
          routineDragActive.value = false;
        }}
      >
        <SortableBoardContainer board={board} style={styles.screen}>
          <View style={styles.header}>
            <ScreenTitle color={theme.textPrimary}>Plans</ScreenTitle>
            <HeaderAction
              accessibilityLabel="Create workout, routine, or plan"
              icon="add"
              iconOnly
              onPress={() => setCreationOpen(true)}
            />
            {headerElevated ? <HeaderEdge /> : null}
          </View>
          <DraggableFlatList
            data={plans}
            keyExtractor={(plan) => plan.id}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            activationDistance={12}
            onScrollOffsetChange={handlePlansScrollOffset}
            renderScrollComponent={(scrollProps) => <DraxScrollView {...scrollProps} />}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {(standaloneRoutines.length > 0 || hasPlanRoutines) && (
                  <Section title="Routines">
                    <View style={styles.card}>
                      <RoutineSortableColumn
                        columnId={standaloneRoutineColumnId}
                        routines={standaloneRoutines}
                        workoutTypes={preferences.workoutTypes}
                        routineDragActive={routineDragActive}
                        onReorder={(routines) => reorderRoutines(routines)}
                        onOpenRoutine={routineActions}
                        onStartRoutine={startRoutine}
                        onDeleteRoutine={(routine) => deleteRoutine(routine.id)}
                        footer={
                          standaloneRoutines.length === 0 ? (
                            <View style={styles.emptyRoutineDropZone}>
                              <Text style={styles.emptyRoutineDropText}>Drop routine here</Text>
                            </View>
                          ) : undefined
                        }
                      />
                    </View>
                  </Section>
                )}
                {plans.length > 0 ? <Text style={styles.sectionTitle}>Plans</Text> : null}
              </View>
            }
            ListEmptyComponent={!standaloneRoutines.length ? <EmptyPlans /> : null}
            onDragEnd={({ data }) => reorderPlans(data)}
            renderItem={({ item: plan, drag, isActive }) => (
              <PlanDragCell active={isActive}>
                <View style={styles.planDragRow}>
                  <PlanCard
                    plan={plan}
                    workoutTypes={preferences.workoutTypes}
                    routineDragActive={routineDragActive}
                    onAddRoutine={() => addRoutine(plan.id)}
                    onOpenRoutine={routineActions}
                    onStartRoutine={startRoutine}
                    onDeleteRoutine={(routine) => deleteRoutine(routine.id)}
                    onOptions={(item) => {
                      lightHaptic();
                      setActionTarget({ kind: 'plan', item });
                    }}
                    onDelete={() => deletePlan(plan.id)}
                    onDrag={drag}
                    dragging={isActive}
                    onReorderRoutines={(routines) => reorderRoutines(routines, plan.id)}
                  />
                </View>
              </PlanDragCell>
            )}
          />
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
          <ForgeActionSheet
            visible={actionTarget !== null}
            onClose={() => setActionTarget(null)}
            accessibilityLabel={
              actionTarget?.kind === 'routine' ? 'Dismiss routine options' : 'Dismiss plan options'
            }
            title={actionTarget?.kind === 'routine' ? 'Routine options' : 'Plan options'}
            testID="plans-options-sheet"
            actions={
              actionTarget?.kind === 'routine'
                ? [
                    {
                      label: 'Start',
                      icon: 'play',
                      onPress: () => startRoutine(actionTarget.item, false),
                    },
                    {
                      label: 'Edit',
                      icon: 'note',
                      onPress: () => openRoutine(actionTarget.item, false),
                    },
                    {
                      label: 'Visualize',
                      icon: 'info',
                      onPress: () => viewRoutine(actionTarget.item, false),
                    },
                  ]
                : actionTarget
                  ? [
                      {
                        label: 'Add routine',
                        icon: 'add',
                        onPress: () => addRoutine(actionTarget.item.id),
                      },
                      {
                        label: 'Delete plan',
                        icon: 'trash',
                        tone: 'destructive' as const,
                        onPress: () => deletePlan(actionTarget.item.id),
                      },
                    ]
                  : []
            }
          />
        </SortableBoardContainer>
      </DraxProvider>
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
  routineDragActive,
  onAddRoutine,
  onOpenRoutine,
  onStartRoutine,
  onDeleteRoutine,
  onOptions,
  onDelete,
  onDrag,
  dragging,
  onReorderRoutines,
}: {
  plan: WorkoutPlan;
  workoutTypes: WorkoutTypePreference[];
  routineDragActive: SharedValue<boolean>;
  onAddRoutine: () => void;
  onOpenRoutine: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
  onOptions: (plan: WorkoutPlan) => void;
  onDelete: () => void;
  onDrag: () => void;
  dragging: boolean;
  onReorderRoutines: (routines: WorkoutRoutine[]) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <SwipeDelete
      accessibilityLabel={`Delete ${plan.name}`}
      testID={`plan-swipe-${plan.id}`}
      onDelete={onDelete}
      rounded
      dragActive={routineDragActive}
    >
      {() => (
        <View style={styles.card}>
          <View testID={`plan-header-${plan.id}`} style={styles.planHeader}>
            <PlanDragHandle
              name={plan.name}
              onDrag={onDrag}
              disabled={dragging}
              routineDragActive={routineDragActive}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open options for ${plan.name}`}
              onPress={() => onOptions(plan)}
              style={({ pressed }) => [styles.planOptions, pressed && styles.pressed]}
            >
              <Text style={styles.planName}>{plan.name}</Text>
              <Icon name="chevron-forward" size={20} color={theme.slate} />
            </Pressable>
          </View>
          {plan.routines.length > 0 && <View style={styles.planRoutineSeparation} />}
          <RoutineSortableColumn
            columnId={planRoutineColumnId(plan.id)}
            routines={plan.routines}
            workoutTypes={workoutTypes}
            routineDragActive={routineDragActive}
            onReorder={onReorderRoutines}
            onOpenRoutine={onOpenRoutine}
            onStartRoutine={onStartRoutine}
            onDeleteRoutine={onDeleteRoutine}
            footer={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add routine to ${plan.name}`}
                onPress={onAddRoutine}
                style={({ pressed }) => [styles.addToPlan, pressed && styles.pressed]}
              >
                <Icon name="add" size={16} color={theme.textPrimary} />
                <Text style={styles.addToPlanText}>Add routine</Text>
              </Pressable>
            }
          />
        </View>
      )}
    </SwipeDelete>
  );
}

function PlanDragHandle({
  name,
  onDrag,
  disabled,
  routineDragActive,
}: {
  name: string;
  onDrag: () => void;
  disabled: boolean;
  routineDragActive: SharedValue<boolean>;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Drag to reorder ${name}`}
      accessibilityHint="Hold, then drag to change plan order"
      disabled={disabled}
      delayLongPress={180}
      onLongPress={() => {
        if (routineDragActive.value) return;
        lightHaptic();
        onDrag();
      }}
      style={({ pressed }) => [styles.planDragHandle, pressed && styles.pressed]}
    >
      <Icon name="drag" size={19} color={theme.muted} />
    </Pressable>
  );
}

function PlanDragCell({ active, children }: { active: boolean; children: React.ReactNode }) {
  const theme = useForgeTheme();
  return active ? (
    <ShadowDecorator elevation={10} radius={18} color={theme.shadow} opacity={0.24}>
      <ScaleDecorator activeScale={1.015}>{children}</ScaleDecorator>
    </ShadowDecorator>
  ) : (
    <View>{children}</View>
  );
}

function RoutineSortableColumn({
  columnId,
  routines,
  workoutTypes,
  routineDragActive,
  onReorder,
  onOpenRoutine,
  onStartRoutine,
  onDeleteRoutine,
  footer,
}: {
  columnId: string;
  routines: WorkoutRoutine[];
  workoutTypes: WorkoutTypePreference[];
  routineDragActive: SharedValue<boolean>;
  onReorder: (routines: WorkoutRoutine[]) => void;
  onOpenRoutine: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
  footer?: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const routineListRef = useRef<FlatList<WorkoutRoutine>>(null);
  const sortable = useSortableList({
    id: columnId,
    data: routines,
    keyExtractor: (routine) => routine.id,
    longPressDelay: 180,
    lockToMainAxis: true,
    animationConfig: 'gentle',
    onReorder: ({ data }) => onReorder(data),
  });

  return (
    <SortableContainer
      sortable={sortable}
      scrollRef={routineListRef}
      style={styles.routineSortableColumn}
      draxViewProps={{ testID: `routine-column-${columnId}` }}
      renderDropIndicator={() => (
        <View testID={`routine-drop-indicator-${columnId}`} style={styles.routineDropIndicator} />
      )}
    >
      <Animated.FlatList
        ref={routineListRef}
        data={sortable.data}
        keyExtractor={sortable.stableKeyExtractor}
        style={styles.routineSortableList}
        contentContainerStyle={styles.routineSortableListContent}
        scrollEnabled={false}
        removeClippedSubviews={false}
        initialNumToRender={Math.max(1, routines.length)}
        maxToRenderPerBatch={Math.max(1, routines.length)}
        windowSize={Math.max(2, routines.length)}
        onScroll={sortable.onScroll}
        onContentSizeChange={sortable.onContentSizeChange}
        renderItem={({ item: routine, index }) => (
          <SortableItem
            sortable={sortable}
            index={index}
            testID={`routine-sortable-${routine.id}`}
            dragHandle
            dragActivationFailOffset={12}
            hoverStyle={styles.routineDragHoverBase}
            hoverDraggingStyle={styles.routineDragHover}
            hoverDragReleasedStyle={styles.routineDragRelease}
            snapDelay={0}
            snapDuration={200}
            renderHoverContent={() => (
              <RoutineDragPreview
                routine={routine}
                workoutTypes={workoutTypes}
                last={index === sortable.data.length - 1}
              />
            )}
          >
            <SwipeDelete
              accessibilityLabel={`Delete ${routine.name}`}
              testID={`routine-swipe-${routine.id}`}
              onOpen={() => onOpenRoutine(routine)}
              onDelete={() => onDeleteRoutine(routine)}
              dragActive={routineDragActive}
            >
              {(handleOpen) => (
                <RoutineRow
                  routine={routine}
                  workoutTypes={workoutTypes}
                  last={index === sortable.data.length - 1}
                  onStart={() => onStartRoutine(routine)}
                  onPress={handleOpen}
                  dragHandle={<RoutineDraxHandle name={routine.name} />}
                />
              )}
            </SwipeDelete>
          </SortableItem>
        )}
        ListFooterComponent={footer ? <>{footer}</> : null}
      />
    </SortableContainer>
  );
}

function RoutineDragPreview({
  routine,
  workoutTypes,
  last,
}: {
  routine: WorkoutRoutine;
  workoutTypes: WorkoutTypePreference[];
  last: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View testID={`routine-drag-preview-${routine.id}`} style={styles.routineDragPreview}>
      <RoutineCardBody routine={routine} workoutTypes={workoutTypes} last={last} />
    </View>
  );
}

function RoutineRow({
  routine,
  workoutTypes,
  last,
  onStart,
  onPress,
  dragHandle,
}: {
  routine: WorkoutRoutine;
  workoutTypes: WorkoutTypePreference[];
  last: boolean;
  onStart: () => void;
  onPress: () => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <RoutineCardBody
      routine={routine}
      workoutTypes={workoutTypes}
      last={last}
      onStart={onStart}
      onPress={onPress}
      dragHandle={dragHandle}
    />
  );
}

function RoutineCardBody({
  routine,
  workoutTypes,
  last,
  onStart,
  onPress,
  dragHandle,
}: {
  routine: WorkoutRoutine;
  workoutTypes: WorkoutTypePreference[];
  last: boolean;
  onStart?: () => void;
  onPress?: () => void;
  dragHandle?: React.ReactNode;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const typeIcon = <Icon name={getRoutineTypeIcon(routine.type, workoutTypes)} size={21} color={theme.ink} />;
  const copy = (
    <>
      <View style={styles.routineText}>
        <Text style={styles.routineName} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text
          style={styles.routineSummary}
          numberOfLines={1}
        >{`${routine.type} · ${routine.exercises.length} ${routine.exercises.length === 1 ? 'exercise' : 'exercises'}`}</Text>
      </View>
      <Icon name="chevron-forward" size={19} color={theme.slate} />
    </>
  );
  return (
    <View style={[styles.routineRow, !last && styles.divider]}>
      {dragHandle ?? (
        <View style={styles.routineDragHandle}>
          <Icon name="drag" size={18} color={theme.muted} />
        </View>
      )}
      {onStart ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name}`}
          onPress={onStart}
          style={({ pressed }) => [styles.typeMarker, pressed && styles.pressed]}
        >
          {typeIcon}
        </Pressable>
      ) : (
        <View style={styles.typeMarker}>{typeIcon}</View>
      )}
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Routine actions for ${routine.name}`}
          onPress={onPress}
          style={({ pressed }) => [styles.routineCopy, pressed && styles.pressed]}
        >
          {copy}
        </Pressable>
      ) : (
        <View style={styles.routineCopy}>{copy}</View>
      )}
    </View>
  );
}

function RoutineDraxHandle({ name }: { name: string }) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
    <DraxHandle style={styles.routineDragHandle}>
      <View
        accessibilityRole="button"
        accessibilityLabel={`Drag to reorder ${name}`}
        accessibilityHint="Hold, then drag to change routine order"
        style={styles.routineDragHandleContent}
      >
        <Icon name="drag" size={18} color={theme.muted} />
      </View>
    </DraxHandle>
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
  rounded = false,
  dragActive,
  children,
}: {
  accessibilityLabel: string;
  testID: string;
  onOpen?: () => void;
  onDelete: () => void;
  rounded?: boolean;
  dragActive?: SharedValue<boolean>;
  children: (onOpen: () => void) => React.ReactNode;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const actionWidth = 76;
  const [revealed, setRevealed] = useState(false);
  const offset = useSharedValue(0);
  const open = useSharedValue(false);
  const suppressNextPress = useRef(false);
  const suppressDeletePress = useRef(false);

  useEffect(() => {
    open.value = revealed;
    offset.value = withSpring(revealed ? -actionWidth : 0, swipeSpring);
  }, [offset, open, revealed]);

  const close = useCallback(() => setRevealed(false), []);
  const swipeBlocked = useSharedValue(false);

  useAnimatedReaction(
    () => dragActive?.value ?? false,
    (active, previous) => {
      if (!active || active === previous) return;
      swipeBlocked.value = true;
      open.value = false;
      offset.value = withSpring(0, swipeSpring);
      runOnJS(close)();
    },
    [close, dragActive, offset, open, swipeBlocked],
  );

  const settle = (next: boolean, dragged: boolean): void => {
    if (dragged) suppressNextPress.current = true;
    if (next !== revealed) {
      mediumHaptic();
      setRevealed(next);
    } else {
      offset.value = withSpring(next ? -actionWidth : 0, swipeSpring);
    }
    requestAnimationFrame(() => {
      suppressDeletePress.current = false;
    });
  };
  const beginSwipe = (): void => {
    suppressDeletePress.current = true;
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onStart(() => {
      swipeBlocked.value = dragActive?.value ?? false;
      if (swipeBlocked.value) return;
      runOnJS(beginSwipe)();
    })
    .onUpdate((event) => {
      if (swipeBlocked.value) return;
      if (!open.value && event.translationX >= 0) return;
      const initial = open.value ? -actionWidth : 0;
      offset.value = Math.max(-actionWidth, Math.min(0, initial + event.translationX));
    })
    .onEnd((event) => {
      if (swipeBlocked.value) return;
      const initial = open.value ? -actionWidth : 0;
      const next = initial + event.translationX < -actionWidth * 0.55;
      runOnJS(settle)(next, Math.abs(event.translationX) > 6);
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const handleOpen = (): void => {
    if (dragActive?.value) return;
    if (suppressNextPress.current) {
      suppressNextPress.current = false;
      return;
    }
    lightHaptic();
    onOpen?.();
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testID}
        style={[styles.swipeContainer, rounded && styles.roundedSwipeContainer]}
      >
        <View
          style={[
            styles.deleteLayer,
            {
              backgroundColor: theme.destructiveSurface,
              pointerEvents: revealed ? 'auto' : 'none',
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={() => {
              if (dragActive?.value || suppressDeletePress.current) return;
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
          style={[
            styles.swipeSurface,
            revealed && styles.swipeSurfaceRounded,
            { backgroundColor: theme.surface },
            animatedStyle,
          ]}
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
      position: 'relative',
      zIndex: 2,
      height: 70,
      paddingHorizontal: spacing.screen,
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: 'row',
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: spacing.screen,
      paddingTop: 16,
      paddingBottom: forgeDockScrollInset,
    },
    listHeader: { gap: 28, paddingBottom: 11 },
    section: { gap: 11 },
    sectionTitle: { ...typeScale.sectionTitle, color: theme.slate },
    planDragRow: { paddingBottom: 14 },
    planHeader: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
    },
    planDragHandle: {
      width: 44,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planOptions: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      paddingRight: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planRoutineSeparation: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: 12,
      backgroundColor: theme.divider,
    },
    planName: { ...typeScale.cardTitle, color: theme.ink },
    routineRow: {
      minHeight: 76,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    routineDragHandle: {
      width: 32,
      height: 52,
      marginRight: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routineDragHandleContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // FlatList defaults to flexing to the available vertical space. In a plan
    // cell that makes an empty Drax destination consume the rest of the
    // screen while it is measuring its incoming phantom. Keep every routine
    // list content-sized; the column itself remains a valid 44 pt target.
    routineSortableColumn: { minHeight: 44 },
    routineSortableList: { flexGrow: 0, flexShrink: 0 },
    routineSortableListContent: { flexGrow: 0 },
    emptyRoutineDropZone: {
      minHeight: 60,
      margin: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyRoutineDropText: { ...typeScale.label, color: theme.slate },
    routineDropIndicator: {
      width: 28,
      height: 3,
      marginLeft: 20,
      borderRadius: 2,
      backgroundColor: theme.success,
    },
    routineDragPreview: {
      alignSelf: 'stretch',
    },
    routineDragHoverBase: {
      borderRadius: 14,
    },
    routineDragHover: {
      shadowColor: theme.shadow,
      shadowOpacity: 0.26,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 7 },
      elevation: 10,
      transform: [{ scale: 1.02 }],
    },
    routineDragRelease: {
      shadowColor: theme.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      transform: [{ scale: 1.01 }],
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
    roundedSwipeContainer: { borderRadius: theme.cardRadius },
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
    swipeSurfaceRounded: {
      overflow: 'hidden',
      borderTopRightRadius: theme.cardRadius,
      borderBottomRightRadius: theme.cardRadius,
    },
    pressed: { opacity: 0.58 },
  });
