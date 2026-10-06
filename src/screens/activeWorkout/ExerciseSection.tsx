import { scheduleOnRN } from 'react-native-worklets';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { runWhenIdle } from '../../utils/idle';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Button, ForgeConfirmationDialog, ForgeText as Text, Icon, pressedFeedback, UnilateralBadge, useAfterSheetClose } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
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
import { useSettings } from '../../state/SettingsContext';
import type { ExerciseSectionProps } from './activeWorkoutTypes';
import type { RootNavigationProp, WorkoutExercise, WorkoutSet } from '../../types';
import { measurementText, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { formatExerciseMetadata } from '../../domain/exercises/exercisePresentation';
import { isUnilateralExercise } from '../../domain/exercises/laterality';
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
  onSetSideCompleted,
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
  // A restore after a workout-detail push must reappear in place, not replay the
  // sheet's pop-up entrance. Only the return path sets this.
  const [optionsRestoreInstant, setOptionsRestoreInstant] = useState(false);
  const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);
  // Present the remove/off-session/replace follow-up only after the options sheet
  // has fully closed, so it can't race the sheet's dismissal.
  const { runAfterClose, onClosed: onOptionsClosed } = useAfterSheetClose();
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  // Guards against a rapid double-tap on a set's completion control reading the
  // stale pre-toggle state and starting the rest timer / recording a sample twice.
  const lastToggleAtRef = useRef<Record<string, number>>({});
  const [expanded, setExpanded] = useState(!collapsible);
  const cardTranslateX = useSharedValue(deleteRevealed ? -deleteActionWidth : 0);
  const cardOpen = useSharedValue(deleteRevealed);
  const suppressDeletePress = useRef(false);
  const [deletePressed, setDeletePressed] = useState(false);
  const catalogMetadata = showCatalogMetadata
    ? formatExerciseMetadata(exercise.exerciseSnapshot)
    : null;
  const { completedWorkouts } = useWorkouts();
  const navigation = useNavigation<RootNavigationProp>();
  const screenIsFocused = useIsFocused();
  const hasExerciseInfo = Boolean(exercise.exerciseSnapshot) || exerciseCatalogById.has(exercise.exerciseId ?? '');
  const trackingType = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps';
  // Unilateral exercises complete per side. Prefer the workout-owned snapshot,
  // falling back to the catalog for exercises added before laterality was captured.
  const unilateral = isUnilateralExercise(exercise)
    || exerciseCatalogById.get(exercise.exerciseId ?? '')?.laterality === 'unilateral';
  const { preferences } = useSettings();
  const leadSideKey = exercise.exerciseId ?? exercise.exerciseSnapshot?.id;
  const leadSide = (leadSideKey ? preferences.exerciseLeadSide[leadSideKey] : undefined) ?? 'left';
  // Keep the live grid stable. A missing prior value is meaningful information,
  // not a reason to move all measurement fields into a different column.
  const showPrevious = true;
  const canBuildWarmups = showWarmupSets && Boolean(addWarmupSets) && trackingFields[trackingType].includes('weight');

  useEffect(() => {
    if (!screenIsFocused) {
      if (previousSessionPushStarted) setPreviousSessionPushStarted(false);
      return;
    }
    if (restorePreviousSessions && !previousSessionPushStarted) {
      // Let the native stack's pop complete before the native modal rises
      // again, rather than making two independent surfaces compete mid-frame.
      return runWhenIdle(() => {
        setOptionsRestoreInstant(true);
        setOptionsVisible(true);
        setRestorePreviousSessions(false);
      });
    }
  }, [previousSessionPushStarted, restorePreviousSessions, screenIsFocused]);

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

  // Always clear the press guard when the gesture ends OR is cancelled (e.g. the
  // routine editor's draggable list takes over the touch, so onEnd never fires).
  // Without this the guard stays latched true and the revealed Delete press is
  // silently swallowed — the exercise never deletes.
  const clearDeletePressGuard = (): void => {
    requestAnimationFrame(() => {
      suppressDeletePress.current = false;
    });
  };

  const cardGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    // Whichever axis clears 16 pt first wins: a horizontal-dominant drag reveals
    // delete, a vertical-dominant one falls through to the list scroll. Matching
    // the thresholds keeps a real left-swipe from being mistaken for a scroll,
    // while a vertical drag still fails here before this recognizer pins scroll.
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onStart(() => {
      scheduleOnRN(beginCardSwipe);
    })
    .onUpdate((gesture) => {
      if (!cardOpen.value && gesture.translationX >= 0) return;
      const base = cardOpen.value ? -deleteActionWidth : 0;
      const next = Math.max(-deleteActionWidth, Math.min(0, base + gesture.translationX));
      cardTranslateX.value = next;
    })
    .onEnd((gesture) => {
      const offset = (cardOpen.value ? -deleteActionWidth : 0) + gesture.translationX;
      scheduleOnRN(settleCard, Math.max(-deleteActionWidth, Math.min(0, offset)) < -42);
    })
    .onFinalize(() => {
      scheduleOnRN(clearDeletePressGuard);
    });
  const swipeContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardTranslateX.value }],
  }));

  return (
    <GestureDetector gesture={cardGesture}>
      {/* The whole revealed surface (rounded corners included) tints on press,
          matching the dashboard tile / live-workout delete, rather than only the
          fixed-width button filling part of the red. */}
      <View
        testID={testID}
        style={[styles.exerciseSwipe, deletePressed && { backgroundColor: theme.destructiveSurfacePressed }]}
      >
        <View
          style={[
            styles.deleteExerciseActionLayer,
            { pointerEvents: deleteRevealed ? 'auto' : 'none' },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${exercise.name}`}
            onPressIn={() => setDeletePressed(true)}
            onPressOut={() => setDeletePressed(false)}
            onPress={() => {
              if (suppressDeletePress.current) return;
              errorHaptic();
              animateLayout(reducedMotion);
              removeExercise(exercise.id);
              onDeleteRevealChange(exercise.id, false);
            }}
            style={styles.deleteExerciseAction}
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
                    {unilateral ? <UnilateralBadge /> : null}
                    {exercise.offSession ? <OffSessionBadge /> : null}
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
                      setOptionsRestoreInstant(false);
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
                    {unilateral ? <UnilateralBadge /> : null}
                    {exercise.offSession ? <OffSessionBadge /> : null}
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
                      setOptionsRestoreInstant(false);
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
                      const now = Date.now();
                      // Ignore a second tap within the render window; it would read
                      // the stale `set.completed` and double-fire the rest timer.
                      if (now - (lastToggleAtRef.current[set.id] ?? 0) < 300) return;
                      lastToggleAtRef.current[set.id] = now;
                      lightHaptic();
                      toggleSet(exercise.id, set.id);
                      // The rest timer must observe the completed transition,
                      // not the pre-toggle state; unchecking never restarts it.
                      if (!set.completed) onSetCompleted(exercise);
                    }}
                    unilateral={unilateral}
                    leadSide={leadSide}
                    onSetSides={(nextSides) => {
                      lightHaptic();
                      const prevSides = set.sideCompletion ?? { left: false, right: false };
                      const prevCount = (prevSides.left ? 1 : 0) + (prevSides.right ? 1 : 0);
                      const nextCount = (nextSides.left ? 1 : 0) + (nextSides.right ? 1 : 0);
                      const bothDone = nextSides.left && nextSides.right;
                      updateSet(exercise.id, set.id, {
                        sideCompletion: nextSides,
                        completed: bothDone,
                        completedAt: bothDone ? Date.now() : undefined,
                      });
                      // The between-sets rest starts only as the second side lands the
                      // completion; the first side starts the shorter between-sides rest.
                      if (bothDone && !set.completed) onSetCompleted(exercise);
                      else if (nextCount === 1 && prevCount === 0) onSetSideCompleted?.(exercise);
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
                    // Ease the new row in, mirroring the animated set removal so
                    // the list does not jump when a set is added.
                    animateLayout(reducedMotion);
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
                enterInstant={optionsRestoreInstant}
                onClose={() => {
                  // Flip visible so the sheet plays its slide-out. It stays mounted
                  // (rendering nothing while closed) so a previous-sessions push can
                  // restore it in place, and so nothing has to time an unmount.
                  setOptionsVisible(false);
                }}
                onClosed={onOptionsClosed}
                onEditNote={updateExercise ? (note) => updateExercise(exercise.id, { note }) : undefined}
                onToggleOffSession={updateExercise ? () => runAfterClose(() => updateExercise(exercise.id, { offSession: !exercise.offSession })) : undefined}
                onOpenPreviousSessions={() => undefined}
                addWarmupSets={canBuildWarmups && addWarmupSets ? (sets) => addWarmupSets(exercise.id, sets) : undefined}
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
                  runAfterClose(() => setRemoveConfirmationOpen(true));
                }}
                onReplaceExercise={onReplaceExercise ? () => runAfterClose(() => onReplaceExercise(exercise.id)) : undefined}
              />
            )}
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
  showCompletion = true,
  workoutId,
}: {
  exercise: WorkoutExercise;
  /** Recorded workouts show a completion tick; routine Visualize has none. */
  showCompletion?: boolean;
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
  // Restore in place (no pop-up) when returning from a pushed workout detail.
  const [optionsRestoreInstant, setOptionsRestoreInstant] = useState(false);
  const { completedWorkouts } = useWorkouts();
  const navigation = useNavigation<RootNavigationProp>();
  const screenIsFocused = useIsFocused();
  const openSet = openSetIndex === null ? null : exercise.sets[openSetIndex];
  const trackingType = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps';
  const unilateral = isUnilateralExercise(exercise)
    || exerciseCatalogById.get(exercise.exerciseId ?? '')?.laterality === 'unilateral';

  useEffect(() => {
    if (!screenIsFocused) {
      if (previousSessionPushStarted) setPreviousSessionPushStarted(false);
      return;
    }
    if (restorePreviousSessions && !previousSessionPushStarted) {
      return runWhenIdle(() => {
        setOptionsRestoreInstant(true);
        setOptionsVisible(true);
        setRestorePreviousSessions(false);
      });
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
        style={[styles.readOnlyExerciseHeader, styles.readOnlyExerciseHeaderPressable]}
      >
        <View style={styles.readOnlyExerciseCopy}>
          <View style={styles.readOnlyExerciseTitleRow}>
            <View style={styles.readOnlyExerciseNameRow}>
              <Text numberOfLines={1} style={styles.readOnlyExerciseName}>
                {exercise.name}
              </Text>
              {unilateral ? <UnilateralBadge /> : null}
              {exercise.offSession ? <OffSessionBadge /> : null}
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
      {workoutId ? <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${exercise.name}`} onPress={() => { selectionHaptic(); setOptionsRestoreInstant(false); setOptionsOpen(true); setOptionsVisible(true); }} style={styles.readOnlyMoreButton}><Icon name="ellipsis-horizontal" size={20} color={theme.ink} /></Pressable> : null}
      </View>
      {expanded && (
        <View style={styles.readOnlySets}>
          <View style={styles.setHeader}>
            <Text style={[styles.setHeaderText, styles.setColumn]}>Set</Text>
            <Text style={[styles.setHeaderText, styles.previousColumn]}>Previous</Text>
            {trackingFields[trackingType].map((kind) => (
              <Text key={kind} style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>{trackingFieldLabel(trackingType, kind)}</Text>
            ))}
            {showCompletion ? <View style={styles.checkColumn} /> : null}
          </View>
          {exercise.sets.map((set, index) => (
            <HistorySetRow
              key={set.id}
              set={set}
              index={index}
              isLast={index === exercise.sets.length - 1}
              trackingType={trackingType}
              showPrevious
              showCompletion={showCompletion}
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
        enterInstant={optionsRestoreInstant}
        readOnly
        exercise={exercise}
        completedWorkouts={completedWorkouts}
        excludeWorkoutId={workoutId}
        onClose={() => {
          // Slide out but stay mounted (renders nothing while closed) so a
          // previous-sessions push can restore it in place without timing an unmount.
          setOptionsVisible(false);
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

/** A small "Uni" chip marking a unilateral exercise, whose sets complete a side at a time. */

function OffSessionBadge() {
  const theme = useForgeTheme();
  return (
    <View accessible accessibilityLabel="Marked off-session; kept in history but excluded from previous values">
      {/* A crossed-out notes glyph mirrors the "Mark off-session" action icon. */}
      <Icon name="notes-off" size={17} color={theme.slate} />
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
      // Transparent so the container's red (which tints on press) reads as one
      // uniform surface across the whole reveal, corners included.
      backgroundColor: 'transparent',
    },
    deleteExerciseAction: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    deleteExerciseText: { color: dashboardTheme.textDestructive, ...typeScale.caption },
    exerciseCard: {
      backgroundColor: dashboardTheme.surface,
      borderRadius: scaleUI(16),
      overflow: 'hidden',
      paddingTop: scaleUI(4),
      paddingHorizontal: scaleUI(12),
      paddingBottom: 0,
      shadowColor: dashboardTheme.shadow,
      shadowOpacity: dashboardTheme.cardShadowOpacity ?? 0.06,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    exerciseCardLarge: { paddingTop: scaleUI(8), paddingHorizontal: scaleUI(16) },
    collapsibleExerciseCard: {
      overflow: 'hidden',
      borderRadius: scaleUI(16),
      paddingTop: 0,
      paddingHorizontal: 0,
    },
  readOnlyExerciseCard: {
      overflow: 'hidden',
      borderRadius: scaleUI(16),
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
      minHeight: scaleUI(56),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: scaleUI(12),
      paddingVertical: scaleUI(8),
    },
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
    readOnlySets: { paddingHorizontal: scaleUI(12), paddingBottom: 0 },
    exerciseHeader: {
      minHeight: scaleUI(30),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    exerciseHeaderLarge: { minHeight: scaleUI(42) },
    exerciseHeaderWithMetadata: { minHeight: scaleUI(48), paddingVertical: scaleUI(4) },
    collapsibleExerciseHeader: {
      minHeight: scaleUI(64),
      paddingHorizontal: scaleUI(12),
    },
    collapsibleExerciseCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 0 },
    // `flex: 0` resolves to `flex-basis: 0` on react-native-web, collapsing the
    // name to zero width; keep it shrinkable but content-sized instead.
    collapsibleExerciseName: { flexShrink: 1 },
    collapsibleExerciseMeta: { marginTop: 0, ...typeScale.supporting, color: dashboardTheme.slate },
    collapsibleChevron: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
    pointerEventsNone: { pointerEvents: 'none' },
    collapsibleExerciseBody: {
      paddingHorizontal: scaleUI(12),
      paddingTop: scaleUI(3),
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
      minHeight: scaleUI(30),
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaleUI(6),
      borderBottomWidth: 1,
      borderBottomColor: dashboardTheme.divider,
    },
    setHeaderLarge: { minHeight: scaleUI(34) },
    setHeaderText: { color: dashboardTheme.slate, ...typeScale.label, textAlign: 'center' },
    // setColumn/checkColumn hold the 46x44 / 44x44 tap targets, so they stay fixed.
    setColumn: { width: 46 },
    previousColumn: { flex: 1 },
    inputColumn: { width: scaleUI(60) },
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
      minHeight: scaleUI(48),
      borderBottomWidth: 1,
      borderBottomColor: dashboardTheme.divider,
    },
    readOnlyMinimalSetRow: { minHeight: 44, borderBottomWidth: 0 },
    readOnlySetValues: { minHeight: scaleUI(48), flexDirection: 'row', alignItems: 'center', gap: scaleUI(6) },
    setNumberWrap: { position: 'relative', width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
    historySetNumberChip: { position: 'relative', width: scaleUI(30), height: scaleUI(30) },
    setNumber: {
      width: scaleUI(30),
      height: scaleUI(30),
      borderRadius: scaleUI(15),
      textAlign: 'center',
      backgroundColor: dashboardTheme.surfaceMuted,
      color: dashboardTheme.ink,
      ...typeScale.caption,
      lineHeight: scaleUI(30),
    },
    historySetCommentIndicator: {
      position: 'absolute',
      right: 1,
      bottom: 1,
      width: scaleUI(7),
      height: scaleUI(7),
      borderRadius: scaleUI(3.5),
      backgroundColor: dashboardTheme.ink,
    },
    historySetTargetIndicator: {
      position: 'absolute',
      top: 1,
      left: 1,
      width: scaleUI(7),
      height: scaleUI(7),
      borderRadius: scaleUI(3.5),
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
      minHeight: scaleUI(36),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: dashboardTheme.divider,
      borderRadius: scaleUI(8),
      backgroundColor: dashboardTheme.surfaceMuted,
    },
    readOnlyInputText: { color: dashboardTheme.ink, ...typeScale.body },
    check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  });
};
