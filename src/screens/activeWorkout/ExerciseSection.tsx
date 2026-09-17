import React, { useEffect, useRef, useState } from 'react';
import { InteractionManager, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Button, ForgeConfirmationDialog, ForgeText as Text, Icon, pressedFeedback } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import {
  animateLayout,
  animateSetRemoval,
  errorHaptic,
  lightHaptic,
  mediumHaptic,
  selectionHaptic,
} from './activeWorkoutFeedback';
import { CompletionCheck } from './CompletionCheck';
import { SwipeableSetRow } from './SwipeableSetRow';
import { SetDetailsCard } from './SetDetailsCard';
import { ExerciseOptionsSheet } from './WorkoutSheets';
import {
  ExerciseInfoSheet,
  PreviousSessionsSheet,
  WarmupSetsSheet,
} from './ExerciseOptionSheets';
import type { ExerciseSectionProps } from './activeWorkoutTypes';
import type { RootNavigationProp, WorkoutExercise, WorkoutSet } from '../../types';
import { measurementText, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { formatExerciseMetadata } from '../../domain/exercises/exercisePresentation';
import { exerciseCatalogById } from '../../data/exerciseCatalog';
import { useWorkouts } from '../../state/WorkoutContext';
import { hasNextSessionTarget, setTagPresentation } from '../../domain/workouts/setPresentation';
import { HistorySetRow } from './HistorySetRow';

export const ExerciseSection = React.memo(function ExerciseSection({
  exercise,
  addSet,
  removeSet,
  removeExercise,
  updateExercise,
  addWarmupSets,
  updateSet,
  toggleSet,
  onSetCompleted,
  deleteRevealed,
  onDeleteRevealChange,
  size = 'standard',
  dragHandle,
  testID,
  collapsible = false,
  forceCollapsed = false,
  swipeEnabled = true,
  showMoreOptions = true,
  onReplaceExercise,
  showCatalogMetadata = false,
  showSetCompletion = true,
  setTargetMode = 'next-session',
  showWarmupSets = false,
  onSetInputFocus,
}: ExerciseSectionProps) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const styles = useThemedStyles(createStyles);
  const deleteActionWidth = 64;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [restorePreviousSessions, setRestorePreviousSessions] = useState(false);
  const [previousSessionPushStarted, setPreviousSessionPushStarted] = useState(false);
  const [optionView, setOptionView] = useState<'history' | 'warmup' | 'info' | null>(null);
  const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);
  const optionTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!collapsible);
  const cardTranslateX = useSharedValue(deleteRevealed ? -deleteActionWidth : 0);
  const cardOpen = useSharedValue(deleteRevealed);
  const suppressDeletePress = useRef(false);
  const catalogMetadata = showCatalogMetadata
    ? formatExerciseMetadata(exercise.exerciseSnapshot)
    : null;
  const { completedWorkouts } = useWorkouts();
  const navigation = useNavigation<RootNavigationProp>();
  const screenIsFocused = useIsFocused();
  const hasExerciseInfo = Boolean(exercise.exerciseSnapshot) || exerciseCatalogById.has(exercise.exerciseId ?? '');
  const trackingType = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps';
  // Keep the live grid stable. A missing prior value is meaningful information,
  // not a reason to move all measurement fields into a different column.
  const showPrevious = true;
  const canBuildWarmups = showWarmupSets && Boolean(addWarmupSets) && trackingFields[trackingType].includes('weight');

  useEffect(
    () => () => {
      if (optionTransitionTimer.current) clearTimeout(optionTransitionTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!screenIsFocused) {
      if (previousSessionPushStarted) setPreviousSessionPushStarted(false);
      return;
    }
    if (restorePreviousSessions && !previousSessionPushStarted) {
      // Let the native stack's pop complete before the native modal rises
      // again, rather than making two independent surfaces compete mid-frame.
      const interaction = InteractionManager.runAfterInteractions(() => {
        setOptionsVisible(true);
        setRestorePreviousSessions(false);
      });
      return () => interaction.cancel();
    }
  }, [previousSessionPushStarted, restorePreviousSessions, screenIsFocused]);

  const afterOptionsClose = (action: () => void): void => {
    if (optionTransitionTimer.current) clearTimeout(optionTransitionTimer.current);
    // ForgeActionSheet owns a short close animation. Defer its next surface so
    // two bottom sheets never compete visually or for touch handling.
    optionTransitionTimer.current = setTimeout(() => {
      optionTransitionTimer.current = null;
      action();
    }, reducedMotion ? 0 : forgeMotion.sheetExit);
  };

  useEffect(() => {
    cardOpen.value = deleteRevealed;
    cardTranslateX.value = reducedMotion
      ? (deleteRevealed ? -deleteActionWidth : 0)
      : withSpring(deleteRevealed ? -deleteActionWidth : 0, forgeMotion.swipeSpring);
  }, [cardOpen, cardTranslateX, deleteActionWidth, deleteRevealed, reducedMotion]);

  useEffect(() => {
    setExpanded(!collapsible);
  }, [collapsible]);

  useEffect(() => {
    if (forceCollapsed) setExpanded(false);
  }, [forceCollapsed]);

  const settleCard = (shouldOpen: boolean): void => {
    if (shouldOpen !== deleteRevealed) {
      mediumHaptic();
      onDeleteRevealChange(exercise.id, shouldOpen);
    } else {
      cardTranslateX.value = reducedMotion
        ? (shouldOpen ? -deleteActionWidth : 0)
        : withSpring(shouldOpen ? -deleteActionWidth : 0, forgeMotion.swipeSpring);
    }
    requestAnimationFrame(() => {
      suppressDeletePress.current = false;
    });
  };

  const beginCardSwipe = (): void => {
    suppressDeletePress.current = true;
  };

  const cardGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    // Require a clearer horizontal intent and fail fast on any vertical motion so
    // the list's native scroll always wins a near-vertical drag; a too-eager
    // horizontal recognizer here could pin the scroll until the list remounts.
    .activeOffsetX([-16, 16])
    .failOffsetY([-4, 4])
    .onStart(() => {
      runOnJS(beginCardSwipe)();
    })
    .onUpdate((gesture) => {
      if (!cardOpen.value && gesture.translationX >= 0) return;
      const base = cardOpen.value ? -deleteActionWidth : 0;
      const next = Math.max(-deleteActionWidth, Math.min(0, base + gesture.translationX));
      cardTranslateX.value = next;
    })
    .onEnd((gesture) => {
      const offset = (cardOpen.value ? -deleteActionWidth : 0) + gesture.translationX;
      runOnJS(settleCard)(Math.max(-deleteActionWidth, Math.min(0, offset)) < -42);
    });
  const swipeContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardTranslateX.value }],
  }));

  return (
    <GestureDetector gesture={cardGesture}>
      <View testID={testID} style={styles.exerciseSwipe}>
        <View
          style={[
            styles.deleteExerciseActionLayer,
            { pointerEvents: deleteRevealed ? 'auto' : 'none' },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${exercise.name}`}
            onPress={() => {
              if (suppressDeletePress.current) return;
              errorHaptic();
              animateLayout(reducedMotion);
              removeExercise(exercise.id);
              onDeleteRevealChange(exercise.id, false);
            }}
            style={({ pressed }) => [
              styles.deleteExerciseAction,
              pressed && styles.deleteExerciseActionPressed,
            ]}
          >
            <Icon name="trash" size={20} color={theme.textDestructive} />
            <Text style={styles.deleteExerciseText}>Delete</Text>
          </Pressable>
        </View>
        <Animated.View
          style={[
            styles.exerciseSwipeContent,
            swipeContentStyle,
          ]}
        >
          <View
            style={[
              styles.exerciseCard,
              collapsible && styles.collapsibleExerciseCard,
              size === 'large' && styles.exerciseCardLarge,
            ]}
          >
            {collapsible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${exercise.name}`}
                accessibilityState={{ expanded }}
                unstable_pressDelay={80}
                onPress={() => {
                  selectionHaptic();
                  animateLayout(reducedMotion);
                  setExpanded((current) => !current);
                }}
                style={({ pressed }) => [
                  styles.exerciseHeader,
                  styles.collapsibleExerciseHeader,
                  pressed && pressedFeedback,
                ]}
              >
                {dragHandle}
                <View style={styles.collapsibleExerciseCopy}>
                  <View style={styles.exerciseNameRow}>
                    <Text numberOfLines={1} style={[styles.exerciseName, styles.collapsibleExerciseName]}>
                      {exercise.name}
                    </Text>
                    {exercise.note?.trim() ? (
                      <Icon accessibilityLabel="Exercise has a comment" name="comment" size={15} color={theme.slate} />
                    ) : null}
                  </View>
                  <Text style={styles.collapsibleExerciseMeta}>
                    {`${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`}
                  </Text>
                </View>
                {showMoreOptions && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`More options for ${exercise.name}`}
                    onPress={() => {
                      selectionHaptic();
                      setOptionsOpen(true);
                      setOptionsVisible(true);
                    }}
                    style={({ pressed }) => [styles.moreButton, pressed && pressedFeedback]}
                  >
                    <Icon name="ellipsis-horizontal" size={20} color={theme.ink} />
                  </Pressable>
                )}
                <View style={[styles.collapsibleChevron, styles.pointerEventsNone]}>
                  <Icon
                    name={expanded ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={theme.slate}
                  />
                </View>
              </Pressable>
            ) : (
              <View style={[styles.exerciseHeader, catalogMetadata && styles.exerciseHeaderWithMetadata, size === 'large' && styles.exerciseHeaderLarge]}>
                {dragHandle}
                <View style={styles.exerciseCopy}>
                  <View style={styles.exerciseNameRow}>
                    <Text numberOfLines={1} style={[styles.exerciseName, size === 'large' && styles.exerciseNameLarge]}>
                      {exercise.name}
                    </Text>
                    {exercise.note?.trim() ? (
                      <Icon accessibilityLabel="Exercise has a comment" name="comment" size={16} color={theme.slate} />
                    ) : null}
                  </View>
                  {catalogMetadata && (
                    <Text numberOfLines={1} style={styles.exerciseMetadata}>
                      {catalogMetadata}
                    </Text>
                  )}
                </View>
                {showMoreOptions && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`More options for ${exercise.name}`}
                    onPress={() => {
                      selectionHaptic();
                      setOptionsOpen(true);
                      setOptionsVisible(true);
                    }}
                    style={({ pressed }) => [styles.moreButton, pressed && pressedFeedback]}
                  >
                    <Icon name="ellipsis-horizontal" size={20} color={theme.ink} />
                  </Pressable>
                )}
              </View>
            )}
            {(!collapsible || expanded) && (
              <View style={collapsible ? styles.collapsibleExerciseBody : undefined}>
                <View style={[styles.setHeader, size === 'large' && styles.setHeaderLarge]}>
                  <Text style={[styles.setHeaderText, styles.setColumn]}>Set</Text>
                  <Text style={[styles.setHeaderText, styles.previousColumn]}>Previous</Text>
                  {trackingFields[trackingType].map((kind) => (
                    <Text key={kind} style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>{trackingFieldLabel(trackingType, kind)}</Text>
                  ))}
                  <View style={styles.checkColumn} />
                </View>
                {exercise.sets.map((set, setIndex) => (
                  <SwipeableSetRow
                    key={set.id}
                    set={set}
                    index={setIndex}
                    onChange={(changes) => updateSet(exercise.id, set.id, changes)}
                    onToggle={() => {
                      lightHaptic();
                      toggleSet(exercise.id, set.id);
                      // The rest timer must observe the completed transition,
                      // not the pre-toggle state; unchecking never restarts it.
                      if (!set.completed) onSetCompleted(exercise);
                    }}
                    onDelete={() => {
                      errorHaptic();
                      animateSetRemoval(reducedMotion);
                      removeSet(exercise.id, set.id);
                    }}
                    deleteRevealed={openSetId === set.id}
                    onDeleteRevealChange={(revealed) => setOpenSetId(revealed ? set.id : null)}
                    showCompletion={showSetCompletion}
                    showPrevious={showPrevious}
                    trackingType={trackingType}
                    setTargetMode={setTargetMode}
                    onInputFocus={onSetInputFocus}
                  />
                ))}
                <Button
                  accessibilityLabel={`Add set to ${exercise.name}`}
                  label="Add set"
                  icon="add"
                  iconSize={16}
                  variant="ghost"
                  haptic="none"
                  onPress={() => {
                    lightHaptic();
                    addSet(exercise.id);
                  }}
                  style={[styles.addSet, size === 'large' && styles.addSetLarge]}
                />
              </View>
            )}
            {showMoreOptions && optionsOpen && (
              <ExerciseOptionsSheet
                exercise={exercise}
                visible={optionsVisible}
                onClose={() => {
                  setOptionsVisible(false);
                  setOptionsOpen(false);
                }}
                onEditNote={updateExercise ? (note) => updateExercise(exercise.id, { note }) : undefined}
                onOpenPreviousSessions={() => undefined}
                onOpenWarmupSets={canBuildWarmups ? () => afterOptionsClose(() => setOptionView('warmup')) : undefined}
                onOpenExerciseInfo={hasExerciseInfo ? () => undefined : undefined}
                completedWorkouts={completedWorkouts}
                onOpenWorkout={(workoutId) => {
                  // The option-sheet component stays mounted so its history view,
                  // expanded cards, and scroll offset can return after this push.
                  setOptionsVisible(false);
                  setRestorePreviousSessions(true);
                  setPreviousSessionPushStarted(true);
                  navigation.push('WorkoutDetails', { workoutId, returnTo: 'ActiveWorkout', returnContext: 'previous-sessions' });
                }}
                onRemove={() => {
                  afterOptionsClose(() => setRemoveConfirmationOpen(true));
                }}
                onReplaceExercise={onReplaceExercise ? () => afterOptionsClose(() => onReplaceExercise(exercise.id)) : undefined}
              />
            )}
            {optionView === 'warmup' && addWarmupSets ? (
              <WarmupSetsSheet
                visible
                exercise={exercise}
                workouts={completedWorkouts}
                onClose={() => setOptionView(null)}
                onAdd={(sets) => addWarmupSets(exercise.id, sets)}
              />
            ) : null}
            <ForgeConfirmationDialog
              visible={removeConfirmationOpen}
              title={`Remove ${exercise.name}?`}
              message="Its sets and recorded values will be removed from this workout."
              cancelLabel="Keep exercise"
              confirmLabel="Remove exercise"
              onCancel={() => setRemoveConfirmationOpen(false)}
              onConfirm={() => {
                setRemoveConfirmationOpen(false);
                animateLayout(reducedMotion);
                removeExercise(exercise.id);
              }}
            />
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

export function ReadOnlyExerciseSection({
  exercise,
  minimal = false,
  workoutId,
}: {
  exercise: WorkoutExercise;
  /** Routine Visualize keeps the expanded set table visually inside its card. */
  minimal?: boolean;
  /** Enables read-only exercise actions when rendered inside workout history. */
  workoutId?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [openSetIndex, setOpenSetIndex] = useState<number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [restorePreviousSessions, setRestorePreviousSessions] = useState(false);
  const [previousSessionPushStarted, setPreviousSessionPushStarted] = useState(false);
  const { completedWorkouts } = useWorkouts();
  const navigation = useNavigation<RootNavigationProp>();
  const screenIsFocused = useIsFocused();
  const openSet = openSetIndex === null ? null : exercise.sets[openSetIndex];
  const trackingType = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps';

  useEffect(() => {
    if (!screenIsFocused) {
      if (previousSessionPushStarted) setPreviousSessionPushStarted(false);
      return;
    }
    if (restorePreviousSessions && !previousSessionPushStarted) {
      const interaction = InteractionManager.runAfterInteractions(() => {
        setOptionsVisible(true);
        setRestorePreviousSessions(false);
      });
      return () => interaction.cancel();
    }
  }, [previousSessionPushStarted, restorePreviousSessions, screenIsFocused]);

  return (
    <View testID={`history-exercise-${exercise.id}`} style={styles.readOnlyExerciseCard}>
      <View style={styles.readOnlyExerciseHeaderRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${exercise.name}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        unstable_pressDelay={80}
        onPress={() => {
          selectionHaptic();
          animateLayout(reducedMotion);
          setExpanded((current) => !current);
        }}
        style={[styles.readOnlyExerciseHeader, styles.readOnlyExerciseHeaderPressable, minimal && styles.readOnlyMinimalExerciseHeader]}
      >
        <View style={styles.readOnlyExerciseCopy}>
          <View style={styles.readOnlyExerciseTitleRow}>
            <View style={styles.readOnlyExerciseNameRow}>
              <Text numberOfLines={1} style={styles.readOnlyExerciseName}>
                {exercise.name}
              </Text>
              {exercise.note?.trim() ? (
                <Icon accessibilityLabel="Exercise has a comment" name="comment" size={15} color={theme.slate} />
              ) : null}
            </View>
            <Text style={styles.readOnlyExerciseCount}>
              {`${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`}
            </Text>
          </View>
        </View>
        <Icon
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={20}
          color={theme.slate}
        />
      </Pressable>
      {workoutId ? <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${exercise.name}`} onPress={() => { selectionHaptic(); setOptionsOpen(true); setOptionsVisible(true); }} style={styles.readOnlyMoreButton}><Icon name="ellipsis-horizontal" size={20} color={theme.ink} /></Pressable> : null}
      </View>
      {expanded && (
        <View style={[styles.readOnlySets, minimal && styles.readOnlyMinimalSets]}>
          <View style={[styles.setHeader, minimal && styles.readOnlyMinimalSetHeader]}>
            <Text style={[styles.setHeaderText, styles.setColumn]}>Set</Text>
            <Text style={[styles.setHeaderText, styles.previousColumn]}>Previous</Text>
            {trackingFields[trackingType].map((kind) => (
              <Text key={kind} style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>{trackingFieldLabel(trackingType, kind)}</Text>
            ))}
            <View style={styles.checkColumn} />
          </View>
          {exercise.sets.map((set, index) => (
            <HistorySetRow
              key={set.id}
              set={set}
              index={index}
              isLast={index === exercise.sets.length - 1}
              trackingType={trackingType}
              showPrevious
              onOpenDetails={() => setOpenSetIndex(index)}
            />
          ))}
        </View>
      )}
      {openSet && (
        <SetDetailsCard
          visible
          set={openSet}
          index={openSetIndex ?? 0}
          editable={false}
          onChange={() => undefined}
          onDelete={() => undefined}
          onDone={() => setOpenSetIndex(null)}
          trackingType={trackingType}
        />
      )}
      {workoutId && optionsOpen ? <ExerciseOptionsSheet
        visible={optionsVisible}
        readOnly
        exercise={exercise}
        completedWorkouts={completedWorkouts}
        excludeWorkoutId={workoutId}
        onClose={() => {
          setOptionsVisible(false);
          setOptionsOpen(false);
        }}
        onOpenPreviousSessions={() => undefined}
        onOpenExerciseInfo={() => undefined}
        onOpenWorkout={(sessionWorkoutId) => {
          setOptionsVisible(false);
          setRestorePreviousSessions(true);
          setPreviousSessionPushStarted(true);
          navigation.push('WorkoutDetails', { workoutId: sessionWorkoutId, returnTo: 'History', returnContext: 'previous-sessions' });
        }}
      /> : null}
    </View>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
    exerciseSwipe: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: dashboardTheme.destructiveSurface,
    },
    // The exercise card owns its rounded surface. A transparent motion layer
    // preserves that curve while the destructive action is revealed behind it.
    exerciseSwipeContent: { zIndex: 1, flex: 1, alignSelf: 'stretch' },
    deleteExerciseActionLayer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 64,
      backgroundColor: dashboardTheme.destructiveSurface,
    },
    deleteExerciseAction: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    deleteExerciseActionPressed: { backgroundColor: dashboardTheme.destructiveSurfacePressed },
    deleteExerciseText: { color: dashboardTheme.textDestructive, ...typeScale.caption },
    exerciseCard: {
      backgroundColor: dashboardTheme.surface,
      borderRadius: 16,
      overflow: 'hidden',
      paddingTop: 4,
      paddingHorizontal: 12,
      paddingBottom: 0,
      shadowColor: dashboardTheme.shadow,
      shadowOpacity: dashboardTheme.cardShadowOpacity ?? 0.06,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    exerciseCardLarge: { paddingTop: 8, paddingHorizontal: 16 },
    collapsibleExerciseCard: {
      overflow: 'hidden',
      borderRadius: 16,
      paddingTop: 0,
      paddingHorizontal: 0,
    },
  readOnlyExerciseCard: {
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: dashboardTheme.surface,
      shadowColor: dashboardTheme.shadow,
      shadowOpacity: dashboardTheme.cardShadowOpacity ?? 0.06,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
  },
  readOnlyExerciseHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  readOnlyExerciseHeaderPressable: { flex: 1 },
  readOnlyMoreButton: { width: 44, height: 44, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
    readOnlyExerciseHeader: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    // Routine Visualize is a read-only summary. Keep its rows compact while
    // retaining the 44 pt tap target on the expandable exercise header.
    readOnlyMinimalExerciseHeader: { minHeight: 48, paddingVertical: 4 },
    readOnlyExerciseCopy: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: 2,
    },
    readOnlyExerciseTitleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    readOnlyExerciseNameRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
    readOnlyExerciseName: {
      flexShrink: 1,
      color: dashboardTheme.ink,
      ...typeScale.cardTitle,
    },
    readOnlyExerciseCount: {
      flexShrink: 0,
      marginLeft: 4,
      color: dashboardTheme.slate,
      ...typeScale.label,
    },
    readOnlySets: { paddingHorizontal: 12, paddingBottom: 0 },
    readOnlyMinimalSets: { paddingBottom: 0 },
    exerciseHeader: {
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    exerciseHeaderLarge: { minHeight: 42 },
    exerciseHeaderWithMetadata: { minHeight: 48, paddingVertical: 4 },
    collapsibleExerciseHeader: {
      minHeight: 64,
      paddingHorizontal: 12,
    },
    collapsibleExerciseCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 0 },
    collapsibleExerciseName: { flex: 0, flexShrink: 1 },
    collapsibleExerciseMeta: { marginTop: 0, ...typeScale.supporting, color: dashboardTheme.slate },
    collapsibleChevron: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
    pointerEventsNone: { pointerEvents: 'none' },
    collapsibleExerciseBody: {
      paddingHorizontal: 12,
      paddingTop: 3,
      borderTopWidth: 1,
      borderTopColor: dashboardTheme.border,
    },
    exerciseName: {
      flexShrink: 1,
      color: dashboardTheme.ink,
      ...typeScale.cardTitle,
    },
    exerciseCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
    exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
    exerciseMetadata: { marginTop: 1, color: dashboardTheme.slate, ...typeScale.supporting },
    exerciseNoteRow: { marginTop: 3, flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
    exerciseNote: { flex: 1, color: dashboardTheme.slate, ...typeScale.supporting },
    exerciseNameLarge: typeScale.sectionTitle,
    moreButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: -6,
    },
    setHeader: {
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: dashboardTheme.divider,
    },
    readOnlyMinimalSetHeader: { minHeight: 28, borderBottomWidth: 0 },
    setHeaderLarge: { minHeight: 34 },
    setHeaderText: { color: dashboardTheme.slate, ...typeScale.label, textAlign: 'center' },
    setColumn: { width: 46 },
    previousColumn: { flex: 1 },
    inputColumn: { width: 60 },
    firstInputWithoutPrevious: { marginLeft: 'auto' },
    inputHeader: { textAlign: 'center' },
    checkColumn: { width: 44 },
    addSet: {
      minHeight: 44,
      borderTopWidth: 1,
      borderTopColor: dashboardTheme.divider,
    },
    addSetLarge: { minHeight: 48 },
    readOnlySetRow: {
      minHeight: 48,
      borderBottomWidth: 1,
      borderBottomColor: dashboardTheme.divider,
    },
    readOnlyMinimalSetRow: { minHeight: 44, borderBottomWidth: 0 },
    readOnlySetValues: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
    setNumberWrap: { position: 'relative', width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
    historySetNumberChip: { position: 'relative', width: 30, height: 30 },
    setNumber: {
      width: 30,
      height: 30,
      borderRadius: 15,
      textAlign: 'center',
      backgroundColor: dashboardTheme.surfaceMuted,
      color: dashboardTheme.ink,
      ...typeScale.caption,
      lineHeight: 30,
    },
    historySetCommentIndicator: {
      position: 'absolute',
      right: 1,
      bottom: 1,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: dashboardTheme.ink,
    },
    historySetTargetIndicator: {
      position: 'absolute',
      top: 1,
      left: 1,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: dashboardTheme.setTargetIndicator,
    },
    historySetRpeIndicator: {
      position: 'absolute',
      bottom: 1,
      left: 3,
      color: dashboardTheme.ink,
      ...typeScale.caption,
    },
    previous: {
      flex: 1,
      color: dashboardTheme.ink,
      ...typeScale.body,
      textAlign: 'center',
    },
    readOnlyInput: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: dashboardTheme.divider,
      borderRadius: 8,
      backgroundColor: dashboardTheme.surfaceMuted,
    },
    readOnlyInputText: { color: dashboardTheme.ink, ...typeScale.body },
    check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  });
};
