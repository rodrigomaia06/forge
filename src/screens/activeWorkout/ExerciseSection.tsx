import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Button, ForgeText as Text, Icon, pressedFeedback } from '../../components/ui';
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
import type { ExerciseSectionProps } from './activeWorkoutTypes';
import type { WorkoutExercise, WorkoutSet } from '../../types';

export const ExerciseSection = React.memo(function ExerciseSection({
  exercise,
  addSet,
  removeSet,
  removeExercise,
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
  showSetCompletion = true,
  onSetInputFocus,
}: ExerciseSectionProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const deleteActionWidth = 64;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!collapsible);
  const cardTranslateX = useSharedValue(deleteRevealed ? -deleteActionWidth : 0);
  const cardOpen = useSharedValue(deleteRevealed);
  const suppressDeletePress = useRef(false);

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
    .failOffsetY([-12, 12])
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
                  <Text style={[styles.exerciseName, styles.collapsibleExerciseName]}>
                    {exercise.name}
                  </Text>
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
              <View style={[styles.exerciseHeader, size === 'large' && styles.exerciseHeaderLarge]}>
                {dragHandle}
                <Text style={[styles.exerciseName, size === 'large' && styles.exerciseNameLarge]}>
                  {exercise.name}
                </Text>
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
                  <Text style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>KG</Text>
                  <Text style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>
                    Reps
                  </Text>
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
                onRemove={() => {
                  animateLayout();
                  removeExercise(exercise.id);
                }}
              />
            )}
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

  return (
    <View testID={`history-exercise-${exercise.id}`} style={styles.readOnlyExerciseCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${exercise.name}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => {
          selectionHaptic();
          setExpanded((current) => !current);
        }}
        style={[styles.readOnlyExerciseHeader, minimal && styles.readOnlyMinimalExerciseHeader]}
      >
        <View style={styles.readOnlyExerciseCopy}>
          <Text numberOfLines={1} style={styles.readOnlyExerciseName}>
            {exercise.name}
          </Text>
          <Text style={styles.readOnlyExerciseCount}>
            {`· ${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`}
          </Text>
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
            <Text style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>KG</Text>
            <Text style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>Reps</Text>
            <View style={styles.checkColumn} />
          </View>
          {exercise.sets.map((set, index) => (
            <ReadOnlyHistorySetRow
              key={set.id}
              set={set}
              index={index}
              minimal={minimal}
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
        />
      )}
    </View>
  );
}

function ReadOnlyHistorySetRow({
  set,
  index,
  minimal = false,
  onOpenDetails,
}: {
  set: WorkoutSet;
  index: number;
  minimal?: boolean;
  onOpenDetails: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View
      testID={`workout-details-set-${set.id}`}
      style={[styles.readOnlySetRow, minimal && styles.readOnlyMinimalSetRow]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open details for set ${index + 1}`}
        accessibilityHint="Opens recorded set tags, comments, and targets"
        onPress={() => {
          selectionHaptic();
          onOpenDetails();
        }}
        style={styles.setNumberWrap}
      >
        <Text style={styles.setNumber}>{index + 1}</Text>
      </Pressable>
      <Text style={styles.previous} numberOfLines={1}>
        {set.previous || '—'}
      </Text>
      <View style={[styles.readOnlyInput, styles.inputColumn]}>
        <Text style={styles.readOnlyInputText}>{set.weight || '—'}</Text>
      </View>
      <View style={[styles.readOnlyInput, styles.inputColumn]}>
        <Text style={styles.readOnlyInputText}>{set.reps || '—'}</Text>
      </View>
      <View style={styles.check}>
        <CompletionCheck
          selected={set.completed}
          testID={`workout-details-set-completion-${set.id}`}
        />
      </View>
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
      flexDirection: 'row',
      alignItems: 'baseline',
    },
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
      flex: 1,
      color: dashboardTheme.ink,
      ...typeScale.cardTitle,
    },
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: dashboardTheme.divider,
    },
    readOnlyMinimalSetRow: { minHeight: 44, borderBottomWidth: 0 },
    setNumberWrap: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  });
};
