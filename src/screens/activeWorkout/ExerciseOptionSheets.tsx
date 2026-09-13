import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  Icon,
  pressedFeedbackSubtle,
} from '../../components/ui';
import { exerciseCatalog, taxonomyLabel, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { buildWarmupPlan } from '../../domain/workouts/warmup';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { Workout, WorkoutExercise } from '../../types';

export function WarmupSetsSheet({
  visible,
  exercise,
  workouts,
  onClose,
  onAdd,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  workouts: readonly Workout[];
  onClose: () => void;
  onAdd: (sets: readonly { weight: string; reps: string }[]) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const previousWorkingSet = useMemo(() => {
    const latest = findPreviousSessions(exercise, workouts)[0]?.exercise;
    return latest?.sets.find((set) => set.tag !== 'Warm Up') ?? latest?.sets[0];
  }, [exercise, workouts]);
  const initialWorkingSet = useMemo(
    () => previousWorkingSet ?? exercise.sets.find((set) => set.tag !== 'Warm Up' && (set.weight || set.reps)) ?? exercise.sets[0],
    [exercise.sets, previousWorkingSet],
  );
  const [weight, setWeight] = useState(initialWorkingSet?.weight ?? '');
  const [reps, setReps] = useState(initialWorkingSet?.reps ?? '');
  useEffect(() => {
    if (!visible) return;
    setWeight(initialWorkingSet?.weight ?? '');
    setReps(initialWorkingSet?.reps ?? '');
  }, [initialWorkingSet?.reps, initialWorkingSet?.weight, visible]);
  const plan = buildWarmupPlan(Number(weight.replace(',', '.')), Number(reps));
  const add = (): void => {
    if (!plan.length) return;
    onAdd(plan);
    onClose();
  };

  return (
    <ForgeBottomSheet visible={visible} onClose={onClose} accessibilityLabel="Close warm-up sets">
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title="Warm-up sets"
        onClose={onClose}
        closePosition="left"
        trailing={<HeaderAction accessibilityLabel="Add warm-up sets" label="Add" icon="add" variant="primary" disabled={!plan.length} onPress={add} />}
      />
      <ScrollView contentContainerStyle={styles.compactContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>WORKING SET</Text>
        <ForgeCard variant="outlined" style={styles.workingCard}>
          <View style={styles.workingRow}>
            <Text style={styles.workingLabel}>Weight</Text>
            <TextInput accessibilityLabel="Working weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textDisabled} style={styles.workingInput} />
            <Text style={styles.unit}>kg</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <View style={styles.workingRow}>
            <Text style={styles.workingLabel}>Reps</Text>
            <TextInput accessibilityLabel="Working reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.textDisabled} style={styles.workingInput} />
            <Text style={styles.unit}>reps</Text>
          </View>
        </ForgeCard>
        <Text style={styles.sectionLabel}>WARM-UP SETS</Text>
        <ForgeCard variant="outlined" style={styles.planCard}>
          {plan.length ? plan.map((set, index) => (
            <View key={`${set.weight}-${set.reps}`} style={[styles.planRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
              <Text style={styles.planIndex}>{index + 1}</Text>
              <Text style={styles.planWeight}>{`${set.weight} kg`}</Text>
              <Text style={[styles.planReps, { color: theme.textSecondary }]}>{`× ${set.reps}`}</Text>
            </View>
          )) : <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>Enter a working weight to see a warm-up ramp.</Text>}
        </ForgeCard>
      </ScrollView>
    </ForgeBottomSheet>
  );
}

export function ExerciseInfoSheet({
  visible,
  exercise,
  onClose,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  onClose: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const detail = useMemo(() => catalogueDetail(exercise), [exercise]);
  if (!detail) return null;
  const fields = [
    ['Exercise', detail.name],
    ...(detail.variation ? [['Variation', detail.variation]] : []),
    ['Category', detail.category],
    ['Equipment', detail.equipment],
    ['Movement family', detail.group],
    ['Tracking', trackingFields[detail.trackingType ?? 'weight-reps'].map((kind) => trackingFieldLabel(detail.trackingType ?? 'weight-reps', kind)).join(' & ')],
    ['Primary muscle', detail.primaryMuscle],
    ...(detail.secondaryMuscles?.length ? [['Secondary muscles', detail.secondaryMuscles.join(' & ')]] : []),
  ];
  return (
    <ForgeBottomSheet visible={visible} onClose={onClose} accessibilityLabel="Close exercise information">
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader title="Exercise info" onClose={onClose} />
      <ExerciseInfoContent exercise={exercise} />
    </ForgeBottomSheet>
  );
}

export function PreviousSessionsSheet({
  visible,
  exercise,
  workouts,
  onClose,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  workouts: readonly Workout[];
  onClose: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const sessions = useMemo(() => findPreviousSessions(exercise, workouts), [exercise, workouts]);
  return (
    <ForgeBottomSheet visible={visible} onClose={onClose} accessibilityLabel="Close previous sessions">
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader title="Previous sessions" onClose={onClose} />
      <PreviousSessionsContent exercise={exercise} workouts={workouts} />
    </ForgeBottomSheet>
  );
}

export function ExerciseInfoContent({ exercise }: { exercise: WorkoutExercise }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const detail = useMemo(() => catalogueDetail(exercise), [exercise]);
  if (!detail) return null;
  const fields = [
    ['Exercise', detail.name],
    ...(detail.variation ? [['Variation', detail.variation]] : []),
    ['Category', detail.category], ['Equipment', detail.equipment], ['Movement family', detail.group],
    ['Tracking', trackingFields[detail.trackingType ?? 'weight-reps'].map((kind) => trackingFieldLabel(detail.trackingType ?? 'weight-reps', kind)).join(' & ')],
    ['Primary muscle', detail.primaryMuscle],
    ...(detail.secondaryMuscles?.length ? [['Secondary muscles', detail.secondaryMuscles.join(' & ')]] : []),
  ];
  return <ScrollView contentContainerStyle={styles.compactContent}><ForgeCard variant="outlined" style={styles.infoCard}>{fields.map(([label, value], index) => <View key={label} style={[styles.infoRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}><Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>)}</ForgeCard></ScrollView>;
}

export function PreviousSessionsContent({ exercise, workouts }: { exercise: WorkoutExercise; workouts: readonly Workout[] }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const sessions = useMemo(() => findPreviousSessions(exercise, workouts), [exercise, workouts]);
  return <ScrollView contentContainerStyle={styles.compactContent}>{sessions.length ? <ForgeCard variant="outlined" style={styles.sessionCard}>{sessions.map(({ workout, exercise: sessionExercise }, index) => <View key={workout.id} style={[styles.sessionRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}><View style={styles.sessionCopy}><Text style={styles.sessionDate}>{new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text><Text style={[styles.sessionDetail, { color: theme.textSecondary }]} numberOfLines={2}>{formatSessionSets(sessionExercise)}</Text></View><Icon name="history" size={20} color={theme.textSecondary} /></View>)}</ForgeCard> : <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}><Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>No completed sessions for this exercise yet.</Text></View>}</ScrollView>;
}

function catalogueDetail(exercise: WorkoutExercise): ExerciseCatalogItem | undefined {
  const snapshot = exercise.exerciseSnapshot;
  if (snapshot) {
    return {
      id: snapshot.id ?? exercise.exerciseId ?? exercise.id,
      name: snapshot.name,
      group: snapshot.group ?? '',
      equipment: snapshot.equipment?.map((item) => taxonomyLabel('equipment', item)).join(' & ') ?? snapshot.primaryEquipment ?? '',
      primaryEquipment: snapshot.primaryEquipment,
      variation: snapshot.variation,
      category: snapshot.category ?? '',
      bodyRegion: snapshot.bodyRegion,
      primaryMuscle: snapshot.primaryMuscle ?? '',
      secondaryMuscles: snapshot.secondaryMuscles ?? [],
      aliases: snapshot.aliases ?? [],
      searchTerms: snapshot.searchTerms,
      workoutTypeIds: snapshot.workoutTypeIds ?? [],
      trackingType: snapshot.trackingType,
      movementPattern: snapshot.movementPattern,
    };
  }
  return exerciseCatalog.find((item) => item.id === exercise.exerciseId);
}

export function findPreviousSessions(exercise: WorkoutExercise, workouts: readonly Workout[]) {
  const id = exercise.exerciseSnapshot?.id ?? exercise.exerciseId;
  const normalizedName = normalizeName(exercise.name);
  return workouts
    .flatMap((workout) => workout.exercises.map((candidate) => ({ workout, exercise: candidate })))
    .filter(({ exercise: candidate }) => {
      const candidateId = candidate.exerciseSnapshot?.id ?? candidate.exerciseId;
      return id ? candidateId === id : normalizeName(candidate.name) === normalizedName;
    })
    .sort((a, b) => (b.workout.completedAt ?? b.workout.startedAt) - (a.workout.completedAt ?? a.workout.startedAt));
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function formatSessionSets(exercise: WorkoutExercise): string {
  const values = exercise.sets.map((set) => {
    const weight = set.weight ? `${set.weight} kg` : '';
    const reps = set.reps ? `${set.reps} reps` : '';
    const values = [weight, reps].filter(Boolean);
    return values.length ? values.join(' × ') : 'No values';
  });
  return `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'} · ${values.slice(0, 2).join(' · ')}${values.length > 2 ? ' …' : ''}`;
}

const createStyles = (theme: import('../../types').ForgeTheme) => StyleSheet.create({
  compactContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  supporting: { ...typeScale.body },
  sectionLabel: { marginTop: 4, color: theme.slate, ...typeScale.caption },
  workingCard: { overflow: 'hidden', borderRadius: 16 },
  workingRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  workingLabel: { flex: 1, color: theme.ink, ...typeScale.label },
  workingInput: { width: 70, minHeight: 42, padding: 0, color: theme.ink, ...typeScale.sectionTitle, textAlign: 'right' },
  unit: { width: 38, color: theme.slate, ...typeScale.label },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  planCard: { overflow: 'hidden', borderRadius: 16 },
  planRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  planIndex: { width: 22, color: theme.slate, ...typeScale.label },
  planWeight: { flex: 1, color: theme.ink, ...typeScale.label },
  planReps: { ...typeScale.label },
  emptyMessage: { padding: 16, ...typeScale.body },
  infoCard: { overflow: 'hidden', borderRadius: 16 },
  infoRow: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 10, gap: 2 },
  infoLabel: { ...typeScale.caption },
  infoValue: { color: theme.ink, ...typeScale.label },
  sessionCard: { overflow: 'hidden', borderRadius: 16 },
  sessionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  sessionCopy: { flex: 1, gap: 3 },
  sessionDate: { color: theme.ink, ...typeScale.label },
  sessionDetail: { ...typeScale.supporting },
  emptyCard: { borderWidth: 1, borderRadius: 16 },
});
