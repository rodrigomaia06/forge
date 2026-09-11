import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AppScreen,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  HeaderEdge,
  Icon,
  lightHaptic,
  pressedFeedback,
  pressedFeedbackSubtle,
  successHaptic,
} from '../components/ui';
import { ExerciseSection } from './activeWorkout/ExerciseSection';
import { AddExerciseSheet } from './activeWorkout/WorkoutSheets';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { useWorkouts } from '../state/WorkoutContext';
import {
  addExerciseToWorkout,
  addSetToWorkout,
  removeExerciseFromWorkout,
  removeSetFromWorkout,
  toggleWorkoutSet,
  updateWorkoutSet,
} from '../state/workoutMutations';
import type { RootStackParamList, Workout } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'HistoryWorkoutEditor'>;

export function HistoryWorkoutEditorScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { completedWorkouts, updateCompletedWorkout } = useWorkouts();
  const source = completedWorkouts.find((workout) => workout.id === route.params.workoutId);
  const [draft, setDraft] = useState<Workout | null>(() => (source ? cloneWorkout(source) : null));
  const [picker, setPicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const returnToHistory = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'History' });
  };

  const dirty = useMemo(
    () => Boolean(source && draft && JSON.stringify(source) !== JSON.stringify(draft)),
    [draft, source],
  );
  const updateDraft = (update: (current: Workout) => Workout): void => {
    setDraft((current) => (current ? update(current) : current));
    setError(null);
  };
  const discard = (): void => {
    const leave = returnToHistory;
    if (!dirty) return leave();
    Alert.alert('Discard changes?', 'Your edits to this workout will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: leave },
    ]);
  };
  const save = (): void => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.type.trim())
      return setError('Name and workout type are required.');
    const completedAt = draft.completedAt ?? draft.startedAt;
    if (
      Number.isNaN(new Date(draft.startedAt).getTime()) ||
      Number.isNaN(new Date(completedAt).getTime())
    )
      return setError('Choose a valid date and time.');
    const durationSeconds = Math.round((completedAt - draft.startedAt) / 1000);
    if (durationSeconds < 1) return setError('End time must be after the start time.');
    const saved: Workout = {
      ...draft,
      name: draft.name.trim(),
      type: draft.type.trim(),
      note: draft.note.trim(),
      location: optional(draft.location),
      mood: optional(draft.mood),
      averageRestSeconds: draft.averageRestSeconds,
      durationSeconds,
    };
    updateCompletedWorkout(saved.id, () => saved);
    successHaptic();
    navigation.goBack();
  };

  if (!source || !draft) return null;
  const startedAt = new Date(draft.startedAt);
  const completedAt = new Date(draft.completedAt ?? draft.startedAt);
  const setDate = (next: Date): void =>
    updateDraft((current) => ({
      ...current,
      startedAt: setDatePart(new Date(current.startedAt), next).getTime(),
      completedAt: setDatePart(new Date(current.completedAt ?? current.startedAt), next).getTime(),
    }));
  const setTime = (kind: 'start' | 'end', next: Date): void =>
    updateDraft((current) => {
      const currentValue =
        kind === 'start' ? current.startedAt : (current.completedAt ?? current.startedAt);
      const updated = setTimePart(new Date(currentValue), next).getTime();
      return kind === 'start'
        ? { ...current, startedAt: updated }
        : { ...current, completedAt: updated };
    });
  return (
    <AppScreen
      backgroundColor={theme.background}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <HeaderAction
            accessibilityLabel="Cancel editing workout"
            icon="close"
            label="Cancel"
            iconOnly
            onPress={discard}
          />
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={styles.title}>
              {draft.name}
            </Text>
          </View>
          <HeaderAction
            accessibilityLabel="Save workout"
            icon="check"
            label="Save"
            variant="primary"
            onPress={save}
            haptic="none"
          />
        </View>
        <HeaderEdge />
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <View style={styles.identityGroup}>
              <TextInput
                accessibilityLabel="Workout name"
                value={draft.name}
                onChangeText={(name) => updateDraft((current) => ({ ...current, name }))}
                numberOfLines={1}
                style={styles.nameInput}
              />
              <TextInput
                accessibilityLabel="Workout type"
                value={draft.type}
                onChangeText={(type) => updateDraft((current) => ({ ...current, type }))}
                numberOfLines={1}
                style={styles.typeInput}
              />
            </View>
            <View style={styles.cardDivider} />
            {Platform.OS === 'web' ? (
              <>
                <Field
                  label="Date"
                  value={dateInput(startedAt)}
                  onChangeText={(value) => setDate(parseDate(value, startedAt))}
                />
                <View style={styles.formRow}>
                  <Field
                    label="Start time"
                    value={timeInput(startedAt)}
                    onChangeText={(value) => setTime('start', parseTime(value, startedAt))}
                    style={styles.halfField}
                  />
                  <Field
                    label="End time"
                    value={timeInput(completedAt)}
                    onChangeText={(value) => setTime('end', parseTime(value, completedAt))}
                    style={styles.halfField}
                  />
                </View>
              </>
            ) : (
              <>
                <PickerButton
                  label="Date"
                  value={dateInput(startedAt)}
                  onPress={() => {
                    lightHaptic();
                    setPicker('date');
                  }}
                />
                <View style={styles.formRow}>
                  <PickerButton
                    label="Start time"
                    value={timeInput(startedAt)}
                    onPress={() => {
                      lightHaptic();
                      setPicker('start');
                    }}
                  />
                  <PickerButton
                    label="End time"
                    value={timeInput(completedAt)}
                    onPress={() => {
                      lightHaptic();
                      setPicker('end');
                    }}
                  />
                </View>
              </>
            )}
            <View style={styles.cardDivider} />
            <Field
              label="Location"
              value={draft.location ?? ''}
              onChangeText={(location) => updateDraft((current) => ({ ...current, location }))}
            />
            <Field
              label="Mood"
              value={draft.mood ?? ''}
              onChangeText={(mood) => updateDraft((current) => ({ ...current, mood }))}
            />
            <Field
              label="Notes"
              value={draft.note}
              multiline
              onChangeText={(note) => updateDraft((current) => ({ ...current, note }))}
            />
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </View>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <View style={styles.exerciseList}>
            {draft.exercises.map((exercise, index) => (
              <ExerciseSection
                key={exercise.id}
                exercise={exercise}
                index={index}
                addSet={(exerciseId) =>
                  updateDraft((current) => addSetToWorkout(current, exerciseId) as Workout)
                }
                removeSet={(exerciseId, setId) =>
                  updateDraft(
                    (current) => removeSetFromWorkout(current, exerciseId, setId) as Workout,
                  )
                }
                removeExercise={(exerciseId) =>
                  updateDraft(
                    (current) => removeExerciseFromWorkout(current, exerciseId) as Workout,
                  )
                }
                updateSet={(exerciseId, setId, changes) =>
                  updateDraft(
                    (current) => updateWorkoutSet(current, exerciseId, setId, changes) as Workout,
                  )
                }
                toggleSet={(exerciseId, setId) =>
                  updateDraft((current) => toggleWorkoutSet(current, exerciseId, setId) as Workout)
                }
                onSetCompleted={() => undefined}
                size="large"
                deleteRevealed={openExerciseId === exercise.id}
                onDeleteRevealChange={(exerciseId, revealed) =>
                  setOpenExerciseId(revealed ? exerciseId : null)
                }
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
              onPress={() => {
                lightHaptic();
                setAddExerciseOpen(true);
              }}
              style={({ pressed }) => [styles.addExercise, pressed && pressedFeedback]}
            >
              <Icon name="add" size={17} color={theme.ink} />
              <Text style={styles.addExerciseText}>Add exercise</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AddExerciseSheet
        visible={addExerciseOpen}
        onClose={() => setAddExerciseOpen(false)}
        onSubmit={(exercises) => {
          exercises.forEach((exercise) =>
            updateDraft((current) => addExerciseToWorkout(current, { exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: { id: exercise.id, name: exercise.name, catalogueVersion: 3, trackingType: exercise.trackingType ?? 'weight-reps' } }) as Workout),
          );
          setAddExerciseOpen(false);
        }}
      />
      {picker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setPicker(null)}>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => {
              lightHaptic();
              setPicker(null);
            }}
          >
            <Pressable style={styles.pickerSheet} onPress={() => undefined}>
              <View style={styles.pickerSheetHeader}>
                <Text style={styles.pickerSheetTitle}>
                  Select {picker === 'date' ? 'date' : `${picker} time`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done selecting date and time"
                  onPress={() => {
                    lightHaptic();
                    setPicker(null);
                  }}
                  style={({ pressed }) => [styles.pickerDone, pressed && pressedFeedback]}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={picker === 'start' ? startedAt : completedAt}
                mode={picker === 'date' ? 'date' : 'time'}
                display="spinner"
                onChange={(_, value) => {
                  if (!value) return;
                  if (picker === 'date') setDate(value);
                  else setTime(picker, value);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {picker && Platform.OS === 'android' && (
        <DateTimePicker
          value={picker === 'start' ? startedAt : completedAt}
          mode={picker === 'date' ? 'date' : 'time'}
          display="default"
          onChange={(_, value) => {
            setPicker(null);
            if (!value) return;
            if (picker === 'date') setDate(value);
            else setTime(picker, value);
          }}
        />
      )}
    </AppScreen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  multiline?: boolean;
  style?: object;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.notesInput]}
      />
    </View>
  );
}
function PickerButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.field, styles.halfField, pressed && pressedFeedbackSubtle]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.pickerValue}>{value}</Text>
    </Pressable>
  );
}
function cloneWorkout(workout: Workout): Workout {
  return JSON.parse(JSON.stringify(workout)) as Workout;
}
function optional(value?: string): string | undefined {
  return value?.trim() || undefined;
}
function dateInput(date: Date): string {
  return date.toLocaleDateString('en-CA');
}
function timeInput(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function parseDate(value: string, current: Date): Date {
  const next = new Date(`${value}T${timeInput(current)}:00`);
  return Number.isNaN(next.getTime()) ? current : next;
}
function parseTime(value: string, current: Date): Date {
  const next = new Date(`${dateInput(current)}T${value}:00`);
  return Number.isNaN(next.getTime()) ? current : next;
}
function setDatePart(current: Date, date: Date): Date {
  const next = new Date(current);
  next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return next;
}
function setTimePart(current: Date, time: Date): Date {
  const next = new Date(current);
  next.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return next;
}

const createStyles = (theme: import('../types').ForgeTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: {
    position: 'relative',
    zIndex: 2,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: theme.background,
  },
  headerTop: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    position: 'absolute',
    top: 0,
    right: 100,
    bottom: 0,
    left: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: theme.ink, ...typeScale.sectionTitle, textAlign: 'center' },
  keyboardArea: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  formCard: {
    padding: 14,
    gap: 10,
    borderRadius: 16,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  identityGroup: { gap: 0 },
  cardEyebrow: { color: theme.slate, ...typeScale.caption, textTransform: 'uppercase' },
  nameInput: {
    minHeight: 36,
    padding: 0,
    color: theme.ink,
    ...typeScale.metricMedium,
  },
  typeInput: {
    minHeight: 22,
    marginTop: -7,
    padding: 0,
    color: theme.slate,
    ...typeScale.supporting,
  },
  cardDivider: { height: 1, marginVertical: 2, backgroundColor: theme.divider },
  formRow: { flexDirection: 'row', gap: 10 },
  field: { gap: 4 },
  halfField: { flex: 1 },
  fieldLabel: { color: theme.slate, ...typeScale.label },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 10,
    paddingHorizontal: 10,
    color: theme.ink,
    backgroundColor: theme.surfaceMuted,
    ...typeScale.supporting,
  },
  notesInput: { minHeight: 72, paddingTop: 9, textAlignVertical: 'top' },
  pickerValue: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 10,
    backgroundColor: theme.surfaceMuted,
    color: theme.ink,
    ...typeScale.supporting,
    lineHeight: 40,
  },
  error: { color: theme.textDestructive, ...typeScale.label },
  sectionTitle: { color: theme.ink, ...typeScale.sectionTitle },
  addExercise: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 12,
    backgroundColor: theme.surface,
  },
  addExerciseText: { color: theme.ink, ...typeScale.label },
  exerciseList: { gap: 10 },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.22)' },
  pickerSheet: {
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: theme.surface,
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerSheetTitle: { color: theme.ink, ...typeScale.cardTitle },
  pickerDone: { minWidth: 56, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  pickerDoneText: { color: theme.selectionIndicator, ...typeScale.supporting },
});
