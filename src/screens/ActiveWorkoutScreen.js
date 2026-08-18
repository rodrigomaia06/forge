import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppScreen, Button, Icon } from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useWorkouts } from '../state/WorkoutContext';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typography } from '../theme/tokens';

function lightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function animateLayout() {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);
  LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

export function ActiveWorkoutScreen({ navigation }) {
  const { activeWorkout, ready, addExercise, addSet, removeExercise, updateSet, toggleSet, finishWorkout } = useWorkouts();
  const [sheetOpen, setSheetOpen] = useState(false);
  const returnToDashboard = (finished) => navigation.reset({ index: 0, routes: [{ name: 'Dashboard', params: finished ? { selectedDay: new Date(finished.completedAt).getDate() } : undefined }] });

  if (!ready) return <AppScreen backgroundColor={dashboardTheme.background}><View style={styles.center}><Text style={styles.muted}>Loading workout…</Text></View></AppScreen>;
  if (!activeWorkout) return <AppScreen backgroundColor={dashboardTheme.background}><View style={styles.center}><Text style={styles.title}>No active workout</Text><Button label="Back to Dashboard" onPress={() => navigation.goBack()} theme={dashboardTheme} /></View></AppScreen>;

  const handleFinish = () => {
    if (!activeWorkout.exercises.length) {
      Alert.alert('Finish empty workout?', 'No workout will be saved.', [
        { text: 'Keep working out', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => { finishWorkout(); returnToDashboard(); } },
      ]);
      return;
    }
    lightHaptic();
    const finished = finishWorkout();
    returnToDashboard(finished);
  };

  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.header}>
        <Button label="Cancel" variant="secondary" onPress={() => navigation.goBack()} theme={dashboardTheme} style={styles.cancelButton} />
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{activeWorkout.name}</Text>
          <Text style={styles.headerMeta}>{activeWorkout.type}</Text>
        </View>
        <Button label="Finish" onPress={handleFinish} variant="outline" theme={dashboardTheme} />
      </View>
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeWorkout.exercises.length > 0 && activeWorkout.exercises.map((exercise, index) => (
          <ExerciseSection key={exercise.id} exercise={exercise} index={index} addSet={addSet} removeExercise={removeExercise} updateSet={updateSet} toggleSet={toggleSet} />
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Add exercise" onPress={() => { animateLayout(); setSheetOpen(true); }} style={styles.addExercise}>
          <Icon name="add" size={17} color={dashboardTheme.ink} />
          <Text style={styles.addExerciseText}>Add exercise</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
      <AddExerciseSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onSubmit={(name) => { lightHaptic(); addExercise(name); setSheetOpen(false); }} />
      <NavigationFooter />
    </AppScreen>
  );
}

function ExerciseSection({ exercise, index, addSet, removeExercise, updateSet, toggleSet }) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}><Text style={styles.exerciseName}>{exercise.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`More options for ${exercise.name}`} onPress={() => setOptionsOpen(true)} style={styles.moreButton}><Icon name="ellipsis-horizontal" size={20} color={dashboardTheme.ink} /></Pressable></View>
      <View style={styles.setHeader}><Text style={[styles.setHeaderText, styles.setColumn]}>Set</Text><Text style={[styles.setHeaderText, styles.previousColumn]}>Previous</Text><Text style={[styles.setHeaderText, styles.inputColumn]}>kg</Text><Text style={[styles.setHeaderText, styles.inputColumn]}>Reps</Text><View style={styles.checkColumn} /></View>
      {exercise.sets.map((set, setIndex) => <SetRow key={set.id} set={set} index={setIndex} onChange={(changes) => updateSet(exercise.id, set.id, changes)} onToggle={() => { lightHaptic(); toggleSet(exercise.id, set.id); }} />)}
      <Pressable accessibilityRole="button" accessibilityLabel={`Add set to ${exercise.name}`} onPress={() => { animateLayout(); lightHaptic(); addSet(exercise.id); }} style={styles.addSet}><Icon name="add" size={16} color={dashboardTheme.ink} /><Text style={styles.addSetText}>Add set</Text></Pressable>
      <ExerciseOptionsSheet visible={optionsOpen} exercise={exercise} onClose={() => setOptionsOpen(false)} onRemove={() => { animateLayout(); removeExercise(exercise.id); setOptionsOpen(false); }} />
    </View>
  );
}

function SetRow({ set, index, onChange, onToggle }) {
  const previous = set.previous || '—';
  return <View style={[styles.setRow, set.completed && styles.setCompleted]}><View style={styles.setNumberWrap}><Text style={styles.setNumber}>{index + 1}</Text></View><Text style={styles.previous} numberOfLines={1}>{previous}</Text><TextInput accessibilityLabel={`Weight for set ${index + 1}`} value={String(set.weight)} onChangeText={(weight) => onChange({ weight })} keyboardType="decimal-pad" placeholder={set.targetWeight || '—'} style={[styles.input, styles.inputColumn]} /><TextInput accessibilityLabel={`Reps for set ${index + 1}`} value={String(set.reps)} onChangeText={(reps) => onChange({ reps })} keyboardType="number-pad" placeholder={set.targetReps || '—'} style={[styles.input, styles.inputColumn]} /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.completed }} accessibilityLabel={set.completed ? `Set ${index + 1} completed` : `Complete set ${index + 1}`} onPress={onToggle} style={[styles.check, set.completed && styles.checkActive]}><Icon name="check" size={16} color={set.completed ? dashboardTheme.surface : dashboardTheme.ink} /></Pressable></View>;
}

function AddExerciseSheet({ visible, onClose, onSubmit }) {
  const [name, setName] = useState('');
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Add exercise</Text><TextInput autoFocus accessibilityLabel="Exercise name" placeholder="Exercise name" value={name} onChangeText={setName} style={styles.nameInput} returnKeyType="done" onSubmitEditing={() => name.trim() && onSubmit(name)} /><View style={styles.sheetActions}><Button label="Cancel" variant="secondary" onPress={onClose} theme={dashboardTheme} /><Button label="Add exercise" disabled={!name.trim()} onPress={() => onSubmit(name)} theme={dashboardTheme} /></View></View></View></Modal>;
}

function ExerciseOptionsSheet({ visible, exercise, onClose, onRemove }) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><View style={styles.sheet}>
      <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Options</Text><Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={onClose} style={styles.sheetClose}><Text style={styles.sheetCloseText}>×</Text></Pressable></View>
      <Text style={styles.sheetExerciseName}>{exercise.name}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${exercise.name}`} onPress={onRemove} style={styles.destructiveAction}><Text style={styles.destructiveText}>Remove exercise</Text></Pressable>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: dashboardTheme.divider },
  headerCopy: { flex: 1 },
  headerTitle: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 21, fontWeight: '600' },
  headerMeta: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 12, marginTop: 3 },
  cancelButton: { minWidth: 92, minHeight: 44 },
  keyboardArea: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 18 },
  exerciseCard: { backgroundColor: dashboardTheme.surface, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: dashboardTheme.divider },
  exerciseHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  exerciseName: { flex: 1, color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  moreButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -6 },
  setHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: dashboardTheme.divider },
  setHeaderText: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 11.5 },
  setRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: dashboardTheme.divider },
  setCompleted: { opacity: 0.58 },
  setColumn: { width: 34 },
  previousColumn: { flex: 1 },
  inputColumn: { width: 52 },
  checkColumn: { width: 38 },
  setNumberWrap: { width: 34, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  setNumber: { width: 24, height: 24, borderRadius: 12, textAlign: 'center', lineHeight: 24, backgroundColor: dashboardTheme.surfaceMuted, color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 11 },
  previous: { flex: 1, color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 12, paddingRight: 2 },
  input: { minHeight: 40, borderWidth: 1, borderColor: dashboardTheme.divider, borderRadius: 8, backgroundColor: dashboardTheme.surface, color: dashboardTheme.ink, fontFamily: typography.medium, fontSize: 14, textAlign: 'center', paddingHorizontal: 3 },
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: dashboardTheme.slate, borderRadius: 22 },
  checkActive: { backgroundColor: dashboardTheme.accent, borderColor: dashboardTheme.accent },
  addSet: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 },
  addSetText: { color: dashboardTheme.ink, fontFamily: typography.medium, fontSize: 13 },
  addExercise: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: dashboardTheme.divider, borderRadius: 12, backgroundColor: dashboardTheme.surface },
  addExerciseText: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 13, fontWeight: '600' },
  muted: { color: dashboardTheme.slate, fontFamily: typography.regular, fontSize: 13, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 20 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.22)' },
  sheet: { backgroundColor: dashboardTheme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 4, backgroundColor: dashboardTheme.divider },
  sheetTitle: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 20, fontWeight: '600' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { color: dashboardTheme.ink, fontFamily: typography.regular, fontSize: 28, lineHeight: 30 },
  sheetExerciseName: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 13 },
  destructiveAction: { minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderTopColor: dashboardTheme.divider },
  destructiveText: { color: '#C54848', fontFamily: typography.semibold, fontSize: 14, fontWeight: '600' },
  nameInput: { minHeight: 50, borderWidth: 1, borderColor: dashboardTheme.divider, borderRadius: 12, paddingHorizontal: 14, color: dashboardTheme.ink, fontFamily: typography.regular, fontSize: 16 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
