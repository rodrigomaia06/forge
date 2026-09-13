import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import type { WorkoutExercise, WorkoutSet } from '../../types';
import { measurementText, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { formatExerciseMetadata } from '../../domain/exercises/exercisePresentation';
import { exerciseCatalog } from '../../data/exerciseCatalog';
import { useWorkouts } from '../../state/WorkoutContext';
import { setTagPresentation } from '../../domain/workouts/setPresentation';

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
  showMoreOptions = true,
  showCatalogMetadata = false,
  showSetCompletion = true,
  showWarmupSets = false,
  onSetInputFocus,
}: ExerciseSectionProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const deleteActionWidth = 64;
  const [optionsOpen, setOptionsOpen] = useState(false);
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
  const hasExerciseInfo = Boolean(exercise.exerciseSnapshot || exerciseCatalog.some((item) => item.id === exercise.exerciseId));
  const canBuildWarmups = showWarmupSets && Boolean(addWarmupSets) && trackingFields[exercise.trackingType ?? 'weight-reps'].includes('weight');

  useEffect(
    () => () => {
      if (optionTransitionTimer.current) clearTimeout(optionTransitionTimer.current);
    },
    [],
  );

  const afterOptionsClose = (action: () => void): void => {
    if (optionTransitionTimer.current) clearTimeout(optionTransitionTimer.current);
    // ForgeActionSheet owns a short close animation. Defer its next surface so
    // two bottom sheets never compete visually or for touch handling.
    optionTransitionTimer.current = setTimeout(() => {
      optionTransitionTimer.current = null;
      action();
    }, 220);
  };

  useEffect(() => {
    cardOpen.value = deleteRevealed;
    cardTranslateX.value = withSpring(deleteRevealed ? -deleteActionWidth : 0, {
      damping: 22,
      stiffness: 280,
      mass: 0.65,
      overshootClamping: true,
    });
  }, [cardOpen, cardTranslateX, deleteActionWidth, deleteRevealed]);

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
      cardTranslateX.value = withSpring(shouldOpen ? -deleteActionWidth : 0, {
        damping: 22,
        stiffness: 280,
        mass: 0.65,
        overshootClamping: true,
      });
    }
    requestAnimationFrame(() => {
      suppressDeletePress.current = false;
    });
  };

  const beginCardSwipe = (): void => {
    suppressDeletePress.current = true;
  };

  const cardGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    // Vertical intent must fail this horizontal-delete recognizer promptly;
    // otherwise a slightly diagonal scroll can leave the card under the finger.
    .failOffsetY([-6, 6])
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
              animateLayout();
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
                  {trackingFields[exercise.trackingType ?? 'weight-reps'].map((kind) => (
                    <Text key={kind} style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>{trackingFieldLabel(exercise.trackingType ?? 'weight-reps', kind)}</Text>
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
                      if (!set.completed) onSetCompleted();
                      toggleSet(exercise.id, set.id);
                    }}
                    onDelete={() => {
                      errorHaptic();
                      animateSetRemoval();
                      removeSet(exercise.id, set.id);
                    }}
                    deleteRevealed={openSetId === set.id}
                    onDeleteRevealChange={(revealed) => setOpenSetId(revealed ? set.id : null)}
                    showCompletion={showSetCompletion}
                    trackingType={exercise.trackingType}
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
                visible
                exercise={exercise}
                onClose={() => setOptionsOpen(false)}
                onEditNote={updateExercise ? (note) => updateExercise(exercise.id, { note }) : undefined}
                onOpenPreviousSessions={() => undefined}
                onOpenWarmupSets={canBuildWarmups ? () => afterOptionsClose(() => setOptionView('warmup')) : undefined}
                onOpenExerciseInfo={hasExerciseInfo ? () => undefined : undefined}
                completedWorkouts={completedWorkouts}
                onRemove={() => {
                  afterOptionsClose(() => setRemoveConfirmationOpen(true));
                }}
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
                animateLayout();
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
}: {
  exercise: WorkoutExercise;
  /** Routine Visualize keeps the expanded set table visually inside its card. */
  minimal?: boolean;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const [openSetIndex, setOpenSetIndex] = useState<number | null>(null);
  const openSet = openSetIndex === null ? null : exercise.sets[openSetIndex];
  const trackingType = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps';

  return (
    <View testID={`history-exercise-${exercise.id}`} style={styles.readOnlyExerciseCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${exercise.name}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        unstable_pressDelay={80}
        onPress={() => {
          selectionHaptic();
          setExpanded((current) => !current);
        }}
        style={[styles.readOnlyExerciseHeader, minimal && styles.readOnlyMinimalExerciseHeader]}
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
              {`· ${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`}
            </Text>
          </View>
        </View>
        <Icon
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={20}
          color={theme.slate}
        />
      </Pressable>
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
            <ReadOnlyHistorySetRow
              key={set.id}
              set={set}
              index={index}
              minimal={minimal}
              trackingType={trackingType}
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
    </View>
  );
}

function ReadOnlyHistorySetRow({
  set,
  index,
  minimal = false,
  trackingType,
  onOpenDetails,
}: {
  set: WorkoutSet;
  index: number;
  minimal?: boolean;
  trackingType: import('../../types').TrackingType;
  onOpenDetails: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const targetSummary = nextTimeTargetSummary(set, trackingType);
  const tag = setTagPresentation(set.tag);
  const hasAnnotations = Boolean(set.tag || targetSummary);
  return (
    <View
      testID={`workout-details-set-${set.id}`}
      style={[
        styles.readOnlySetRow,
        hasAnnotations && styles.readOnlySetRowWithAnnotations,
        minimal && styles.readOnlyMinimalSetRow,
      ]}
    >
      <View style={styles.readOnlySetValues}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open details for set ${index + 1}`}
          accessibilityHint="Opens recorded set details"
          onPress={() => {
            selectionHaptic();
            onOpenDetails();
          }}
          style={styles.setNumberWrap}
        >
          <View testID={`history-set-number-chip-${index + 1}`} style={styles.historySetNumberChip}>
            <Text
              style={[
                styles.setNumber,
                tag && { color: tag.color, backgroundColor: `${tag.color}20` },
              ]}
            >
              {tag?.letter ?? index + 1}
            </Text>
            {set.comment?.trim() ? (
              <View accessibilityLabel={`Set ${index + 1} has a comment`} style={styles.historySetCommentIndicator} />
            ) : null}
          </View>
        </Pressable>
        <Text style={styles.previous} numberOfLines={1}>
          {set.previous || '—'}
        </Text>
        {trackingFields[trackingType].map((kind) => (
          <View key={kind} style={[styles.readOnlyInput, styles.inputColumn]}>
            <Text style={styles.readOnlyInputText}>{measurementText(set, kind) || '—'}</Text>
          </View>
        ))}
        <View style={styles.check}>
          <CompletionCheck
            selected={set.completed}
            testID={`workout-details-set-completion-${set.id}`}
          />
        </View>
      </View>
      {hasAnnotations ? (
        <View style={styles.historySetAnnotations}>
          {set.tag ? (
            <View style={styles.historySetTagRow}>
              <View style={[styles.historySetTagDot, { backgroundColor: tag?.color ?? theme.slate }]} />
              <Text style={styles.historySetTag}>{set.tag}</Text>
            </View>
          ) : null}
          {targetSummary ? <Text style={styles.historySetTarget}>{`Next time · ${targetSummary}`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function nextTimeTargetSummary(set: WorkoutSet, trackingType: import('../../types').TrackingType): string {
  return trackingFields[trackingType].flatMap((kind) => {
    const target = set.targets?.find((item) => item.kind === kind);
    const value = target?.minValue !== undefined
      ? target.maxValue !== undefined && target.maxValue !== target.minValue
        ? `${target.minValue}–${target.maxValue}`
        : String(target.minValue)
      : kind === 'reps'
        ? set.targetReps
        : kind === 'weight' || kind === 'addedWeight'
          ? set.targetWeight
          : undefined;
    return value?.trim() ? [`${trackingFieldLabel(trackingType, kind)} ${value}`] : [];
  }).join(' · ');
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
      transform: [{ translateY: 3 }],
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
      borderWidth: 1,
      borderColor: dashboardTheme.border,
      shadowColor: dashboardTheme.ink,
      shadowOpacity: 0.06,
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
      borderWidth: 1,
      borderColor: dashboardTheme.divider,
      borderRadius: 16,
      backgroundColor: dashboardTheme.surface,
      shadowColor: dashboardTheme.ink,
      shadowOpacity: 0.06,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
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
    readOnlySets: { paddingHorizontal: 12, paddingBottom: 4 },
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
    readOnlySetRowWithAnnotations: { paddingBottom: 8 },
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
      backgroundColor: dashboardTheme.surface,
    },
    previous: {
      flex: 1,
      color: dashboardTheme.ink,
      ...typeScale.label,
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
    readOnlyInputText: { color: dashboardTheme.ink, ...typeScale.supporting },
    check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    historySetAnnotations: { marginLeft: 52, marginRight: 6, gap: 3 },
    historySetTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    historySetTagDot: { width: 7, height: 7, borderRadius: 4 },
    historySetTag: { color: dashboardTheme.slate, ...typeScale.caption },
    historySetTarget: { color: dashboardTheme.slate, ...typeScale.caption },
  });
};
