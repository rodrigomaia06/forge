import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typography } from '../../theme/tokens';
import { animateLayout, animateSetRemoval, lightHaptic } from './activeWorkoutFeedback';
import { SwipeableSetRow } from './SwipeableSetRow';
import { ExerciseOptionsSheet } from './WorkoutSheets';
import type { ExerciseSectionProps } from './activeWorkoutTypes';

export function ExerciseSection({
  exercise,
  addSet,
  removeSet,
  removeExercise,
  updateSet,
  toggleSet,
  onSetCompleted,
}: ExerciseSectionProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${exercise.name}`}
          onPress={() => setOptionsOpen(true)}
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
            lightHaptic();
            animateSetRemoval();
            removeSet(exercise.id, set.id);
          }}
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
      <ExerciseOptionsSheet
        visible={optionsOpen}
        exercise={exercise}
        onClose={() => setOptionsOpen(false)}
        onRemove={() => {
          animateLayout();
          removeExercise(exercise.id);
          setOptionsOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseCard: {
    backgroundColor: dashboardTheme.surface,
    borderRadius: 16,
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
