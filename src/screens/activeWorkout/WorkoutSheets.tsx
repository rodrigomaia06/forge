import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typography } from '../../theme/tokens';
import type { WorkoutExercise } from '../../types';

export function AddExerciseSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add exercise</Text>
          <TextInput
            autoFocus
            accessibilityLabel="Exercise name"
            placeholder="Exercise name"
            value={name}
            onChangeText={setName}
            style={styles.nameInput}
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onSubmit(name)}
          />
          <View style={styles.sheetActions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} theme={dashboardTheme} />
            <Button
              label="Add exercise"
              disabled={!name.trim()}
              onPress={() => onSubmit(name)}
              theme={dashboardTheme}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ExerciseOptionsSheet({
  visible,
  exercise,
  onClose,
  onRemove,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Options</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close options"
              onPress={onClose}
              style={styles.sheetClose}
            >
              <Text style={styles.sheetCloseText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.sheetExerciseName}>{exercise.name}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${exercise.name}`}
            onPress={onRemove}
            style={styles.destructiveAction}
          >
            <Text style={styles.destructiveText}>Remove exercise</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.22)' },
  sheet: {
    backgroundColor: dashboardTheme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: dashboardTheme.divider,
  },
  sheetTitle: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 20,
    fontWeight: '600',
  },
  nameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: dashboardTheme.ink,
    fontFamily: typography.regular,
    fontSize: 16,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: {
    color: dashboardTheme.ink,
    fontFamily: typography.regular,
    fontSize: 28,
    lineHeight: 30,
  },
  sheetExerciseName: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 13 },
  destructiveAction: {
    minHeight: 48,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: dashboardTheme.divider,
  },
  destructiveText: {
    color: '#C54848',
    fontFamily: typography.semibold,
    fontSize: 14,
    fontWeight: '600',
  },
});
