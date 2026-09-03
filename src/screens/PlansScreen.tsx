import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DraggableFlatList, {
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import {
  DraxHandle,
  DraxProvider,
  SortableBoardContainer,
  SortableContainer,
  SortableItem,
  useSortableBoard,
  useSortableList,
} from 'react-native-drax';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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
  const plansListRef = useRef<any>(null);
  const routineScrollListeners = useRef(new Set<(offset: number) => void>());
  const registerRoutineScrollListener = useCallback((listener: (offset: number) => void) => {
    routineScrollListeners.current.add(listener);
    return () => routineScrollListeners.current.delete(listener);
  }, []);
  const board = useSortableBoard<WorkoutRoutine>({
    keyExtractor: (routine) => routine.id,
    onTransfer: ({ item, toContainerId, toIndex }) => {
      moveRoutine(item.id, planIdFromRoutineColumn(toContainerId), toIndex);
    },
  });
  const handlePlansScrollOffset = useCallback((offset: number): void => {
    setHeaderElevated(offset > 1);
    routineScrollListeners.current.forEach((listener) => listener(offset));
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
      <DraxProvider style={styles.screen}>
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
            ref={plansListRef}
            data={plans}
            keyExtractor={(plan) => plan.id}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            activationDistance={12}
            onScrollOffsetChange={handlePlansScrollOffset}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {(standaloneRoutines.length > 0 || hasPlanRoutines) && (
                  <Section title="Routines">
                    <View style={styles.card}>
                      <RoutineSortableColumn
                        columnId={standaloneRoutineColumnId}
                        routines={standaloneRoutines}
                        workoutTypes={preferences.workoutTypes}
                        scrollRef={plansListRef}
                        registerScrollListener={registerRoutineScrollListener}
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
                    scrollRef={plansListRef}
                    registerScrollListener={registerRoutineScrollListener}
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
  scrollRef,
  registerScrollListener,
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
  scrollRef: React.RefObject<any>;
  registerScrollListener: (listener: (offset: number) => void) => () => void;
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
    >
      {() => (
        <View style={styles.card}>
          <View testID={`plan-header-${plan.id}`} style={styles.planHeader}>
            <PlanDragHandle name={plan.name} onDrag={onDrag} disabled={dragging} />
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
            scrollRef={scrollRef}
            registerScrollListener={registerScrollListener}
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
      accessibilityHint="Hold, then drag to change plan order"
      disabled={disabled}
      delayLongPress={180}
      onLongPress={() => {
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
  scrollRef,
  registerScrollListener,
  onReorder,
  onOpenRoutine,
  onStartRoutine,
  onDeleteRoutine,
  footer,
}: {
  columnId: string;
  routines: WorkoutRoutine[];
  workoutTypes: WorkoutTypePreference[];
  scrollRef: React.RefObject<any>;
  registerScrollListener: (listener: (offset: number) => void) => () => void;
  onReorder: (routines: WorkoutRoutine[]) => void;
  onOpenRoutine: (routine: WorkoutRoutine) => void;
  onStartRoutine: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
  footer?: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const sortable = useSortableList({
    id: columnId,
    data: routines,
    keyExtractor: (routine) => routine.id,
    longPressDelay: 180,
    lockToMainAxis: true,
    animationConfig: 'gentle',
    onReorder: ({ data }) => onReorder(data),
  });

  useEffect(
    () =>
      registerScrollListener((offset) => {
        sortable._internal.scrollPosition.value = { x: 0, y: offset };
      }),
    [registerScrollListener, sortable._internal.scrollPosition],
  );

  return (
    <SortableContainer
      sortable={sortable}
      scrollRef={scrollRef}
      style={styles.routineSortableColumn}
    >
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          sortable.onContentSizeChange(width, height);
        }}
      >
        {sortable.data.map((routine, index) => (
          <SortableItem
            key={routine.id}
            sortable={sortable}
            index={index}
            dragHandle
            dragActivationFailOffset={12}
            hoverStyle={styles.routineDragHover}
          >
            <SwipeDelete
              accessibilityLabel={`Delete ${routine.name}`}
              testID={`routine-swipe-${routine.id}`}
              onOpen={() => onOpenRoutine(routine)}
              onDelete={() => onDeleteRoutine(routine)}
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
        ))}
        {footer}
      </View>
    </SortableContainer>
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
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.routineRow, !last && styles.divider]}>
      {dragHandle}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Start ${routine.name}`}
        onPress={onStart}
        style={({ pressed }) => [styles.typeMarker, pressed && styles.pressed]}
      >
        <Icon name={getRoutineTypeIcon(routine.type, workoutTypes)} size={21} color={theme.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Routine actions for ${routine.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.routineCopy, pressed && styles.pressed]}
      >
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
      </Pressable>
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
  children,
}: {
  accessibilityLabel: string;
  testID: string;
  onOpen?: () => void;
  onDelete: () => void;
  rounded?: boolean;
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
      runOnJS(beginSwipe)();
    })
    .onUpdate((event) => {
      if (!open.value && event.translationX >= 0) return;
      const initial = open.value ? -actionWidth : 0;
      offset.value = Math.max(-actionWidth, Math.min(0, initial + event.translationX));
    })
    .onEnd((event) => {
      const initial = open.value ? -actionWidth : 0;
      const next = initial + event.translationX < -actionWidth * 0.55;
      runOnJS(settle)(next, Math.abs(event.translationX) > 6);
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const handleOpen = (): void => {
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
              if (suppressDeletePress.current) return;
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
    routineSortableColumn: { minHeight: 44 },
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
    routineDragHover: {
      borderRadius: 14,
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.26,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 7 },
      elevation: 10,
      transform: [{ scale: 1.015 }],
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
