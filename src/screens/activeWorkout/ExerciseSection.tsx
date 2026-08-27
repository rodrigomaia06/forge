import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typography } from '../../theme/tokens';
import {
  animateLayout,
  animateSetRemoval,
  errorHaptic,
  lightHaptic,
  mediumHaptic,
  selectionHaptic,
} from './activeWorkoutFeedback';
import { SwipeableSetRow } from './SwipeableSetRow';
import { ExerciseOptionsSheet } from './WorkoutSheets';
import type { ExerciseSectionProps } from './activeWorkoutTypes';

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
}: ExerciseSectionProps) {
  const deleteActionWidth = 64;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const cardTranslateX = useSharedValue(deleteRevealed ? -deleteActionWidth : 0);
  const cardOpen = useSharedValue(deleteRevealed);

  useEffect(() => {
    cardOpen.value = deleteRevealed;
    cardTranslateX.value = withSpring(deleteRevealed ? -deleteActionWidth : 0, {
      damping: 22,
      stiffness: 280,
      mass: 0.65,
      overshootClamping: true,
    });
  }, [cardOpen, cardTranslateX, deleteActionWidth, deleteRevealed]);

  const settleCard = (shouldOpen: boolean): void => {
    if (shouldOpen !== deleteRevealed) {
      mediumHaptic();
      onDeleteRevealChange(exercise.id, shouldOpen);
      return;
    }
    cardTranslateX.value = withSpring(shouldOpen ? -deleteActionWidth : 0, {
      damping: 22,
      stiffness: 280,
      mass: 0.65,
      overshootClamping: true,
    });
  };

  const cardGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
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
      <View style={styles.exerciseSwipe}>
      <View
        pointerEvents={deleteRevealed ? 'auto' : 'none'}
        style={styles.deleteExerciseActionLayer}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${exercise.name}`}
          onPress={() => {
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
          <Icon name="trash" size={20} color="#D64848" />
          <Text style={styles.deleteExerciseText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.exerciseSwipeContent, swipeContentStyle]}>
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${exercise.name}`}
          onPress={() => {
            selectionHaptic();
            setOptionsOpen(true);
          }}
          style={styles.moreButton}
        >
          <Icon name="ellipsis-horizontal" size={20} color={dashboardTheme.ink} />
        </Pressable>
      </View>
      <View style={styles.setHeader}>
        <Text style={[styles.setHeaderText, styles.setColumn]}>Set</Text>
        <Text style={[styles.setHeaderText, styles.previousColumn]}>Previous</Text>
        <Text style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>KG</Text>
        <Text style={[styles.setHeaderText, styles.inputColumn, styles.inputHeader]}>Reps</Text>
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
        />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${exercise.name}`}
        onPress={() => {
          lightHaptic();
          addSet(exercise.id);
        }}
        style={styles.addSet}
      >
        <Icon name="add" size={16} color={dashboardTheme.accent} />
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
      {optionsOpen && (
        <ExerciseOptionsSheet
          visible
          exercise={exercise}
          onClose={() => setOptionsOpen(false)}
          onRemove={() => {
            animateLayout();
            removeExercise(exercise.id);
            setOptionsOpen(false);
          }}
        />
      )}
      </View>
      </Animated.View>
    </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  exerciseSwipe: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#F6DCDD',
  },
  exerciseSwipeContent: { zIndex: 1, backgroundColor: dashboardTheme.surface },
  deleteExerciseActionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 64,
    backgroundColor: '#F6DCDD',
  },
  deleteExerciseAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transform: [{ translateY: 3 }],
  },
  deleteExerciseActionPressed: { backgroundColor: '#F1CED0' },
  deleteExerciseText: { color: '#D64848', fontFamily: typography.semibold, fontSize: 12 },
  exerciseCard: {
    backgroundColor: dashboardTheme.surface,
    borderRadius: 0,
    paddingTop: 4,
    paddingHorizontal: 12,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(226,227,224,0.72)',
    shadowColor: dashboardTheme.ink,
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  exerciseHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    flex: 1,
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  moreButton: {
    width: 40,
    height: 40,
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
  setHeaderText: {
    color: dashboardTheme.slate,
    fontFamily: typography.medium,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  setColumn: { width: 46 },
  previousColumn: { flex: 1 },
  inputColumn: { width: 52 },
  inputHeader: { textAlign: 'center' },
  checkColumn: { width: 44 },
  addSet: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: dashboardTheme.divider,
  },
  addSetText: { color: dashboardTheme.accent, fontFamily: typography.medium, fontSize: 13 },
});
