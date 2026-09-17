import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

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
import { ExerciseDetailBody } from '../../components/ExerciseDetailBody';
import { useSettings } from '../../state/SettingsContext';
import { exerciseCatalog, taxonomyLabel, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { measurementText, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { buildWarmupPlan } from '../../domain/workouts/warmup';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { useForgeReducedMotion } from '../../theme/motion';
import type { Workout, WorkoutExercise, WorkoutSet } from '../../types';
import { HistorySetRow } from './HistorySetRow';
import { SetDetailsCard } from './SetDetailsCard';
import { animateLayout } from './activeWorkoutFeedback';

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
        <ForgeCard variant="base" style={styles.workingCard}>
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
        <ForgeCard variant="base" style={styles.planCard}>
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

export function ExerciseInfoContent({
  exercise,
  onPressRest,
}: {
  exercise: WorkoutExercise;
  onPressRest?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const detail = useMemo(() => catalogueDetail(exercise), [exercise]);
  if (!detail) return null;
  // Match the read path in ActiveWorkoutScreen.restDurationForExercise.
  const exerciseId = exercise.exerciseId ?? exercise.exerciseSnapshot?.id ?? detail.id;
  const restOverride = preferences.exerciseRestSeconds[exerciseId];
  const restLabel = restOverride === undefined
    ? 'Default'
    : `${Math.floor(restOverride / 60)}:${String(restOverride % 60).padStart(2, '0')}`;
  // Reuse the exact Exercise Library detail card so the two read identically.
  return (
    <ScrollView testID="exercise-info-content" contentContainerStyle={styles.infoScroll}>
      <ExerciseDetailBody
        detail={detail}
        workoutTypes={preferences.workoutTypes}
        restLabel={restLabel}
        onPressRest={onPressRest}
      />
    </ScrollView>
  );
}

export function PreviousSessionsContent({
  exercise,
  workouts,
  excludeWorkoutId,
  onOpenWorkout,
  showAll: controlledShowAll,
  onShowAllChange,
  scrollOffset,
  onScrollOffsetChange,
}: {
  exercise: WorkoutExercise;
  workouts: readonly Workout[];
  excludeWorkoutId?: string;
  onOpenWorkout?: (workoutId: string) => void;
  /** State is lifted by option sheets that temporarily close for a stack push. */
  showAll?: boolean;
  onShowAllChange?: (showAll: boolean) => void;
  /** Preserves the list position when returning from a read-only workout detail. */
  scrollOffset?: number;
  onScrollOffsetChange?: (offset: number) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [uncontrolledShowAll, setUncontrolledShowAll] = useState(false);
  const [openSet, setOpenSet] = useState<{ set: WorkoutSet; index: number; trackingType: NonNullable<WorkoutExercise['trackingType']> } | null>(null);
  const sessions = useMemo(
    () => findPreviousSessions(exercise, workouts).filter(({ workout }) => workout.id !== excludeWorkoutId),
    [excludeWorkoutId, exercise, workouts],
  );
  const showAll = controlledShowAll ?? uncontrolledShowAll;
  const visibleSessions = showAll ? sessions : sessions.slice(0, 3);
  const revealAll = (): void => {
    animateLayout(reducedMotion);
    if (onShowAllChange) onShowAllChange(true);
    else setUncontrolledShowAll(true);
  };

  useEffect(() => {
    if (!scrollOffset) return;
    const frame = requestAnimationFrame(() => scrollViewRef.current?.scrollTo({ y: scrollOffset, animated: false }));
    return () => cancelAnimationFrame(frame);
    // The sheet remounts after a stack drill-in. Do not react to each user
    // scroll update here or the list would continually command itself back to
    // the current pixel while the user is dragging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  return <><ScrollView
    ref={scrollViewRef}
    // A concrete cap gives the list a bounded viewport so it can scroll inside
    // the sheet; flexShrink alone let it grow to its content height (no scroll).
    // Keep it tall (close to the prior content-driven height) and scroll past it.
    style={[styles.previousSessionsScroll, { maxHeight: Math.round(windowHeight * 0.72) }]}
    contentContainerStyle={styles.previousSessionsContent}
    nestedScrollEnabled
    onScroll={(event) => onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)}
    scrollEventThrottle={16}
  >{sessions.length ? <>
    {visibleSessions.map(({ workout, exercise: sessionExercise }) => <View key={workout.id}>
      <ForgeCard testID={`previous-session-card-${workout.id}`} variant="base" style={styles.previousSessionCard}>
      <Pressable accessibilityRole={onOpenWorkout ? 'button' : undefined} accessibilityLabel={onOpenWorkout ? `Open ${workout.name}` : undefined} onPress={() => onOpenWorkout?.(workout.id)} style={({ pressed }) => [styles.previousSessionHeader, pressed && pressedFeedbackSubtle]}>
        <View style={styles.sessionCopy}><Text style={styles.sessionTitle} numberOfLines={1}>{workout.name}</Text><Text style={[styles.sessionDate, { color: theme.textSecondary }]}>{sessionDateTime(workout)}</Text></View>{onOpenWorkout ? <Icon name="chevron-forward" size={22} color={theme.textSecondary} /> : null}
      </Pressable>
      {sessionExercise.sets.map((set, index) => <HistorySetRow key={set.id} set={set} index={index} compact isLast={index === sessionExercise.sets.length - 1} trackingType={sessionExercise.exerciseSnapshot?.trackingType ?? sessionExercise.trackingType ?? 'weight-reps'} onOpenDetails={() => setOpenSet({ set, index, trackingType: sessionExercise.exerciseSnapshot?.trackingType ?? sessionExercise.trackingType ?? 'weight-reps' })} />)}
      </ForgeCard>
    </View>)}
    {!showAll && sessions.length > 3 ? <Pressable accessibilityRole="button" accessibilityLabel={`Show ${sessions.length - 3} more sessions`} onPress={revealAll} style={({ pressed }) => [styles.showMoreSessions, { backgroundColor: theme.surface }, pressed && pressedFeedbackSubtle]}><Text style={styles.showMoreText}>{`Show ${sessions.length - 3} more`}</Text></Pressable> : null}
  </> : <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}><Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>No completed sessions for this exercise yet.</Text></View>}</ScrollView>{openSet ? <SetDetailsCard visible set={openSet.set} index={openSet.index} editable={false} onChange={() => undefined} onDelete={() => undefined} onDone={() => setOpenSet(null)} trackingType={openSet.trackingType} /> : null}</>;
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

function sessionDateTime(workout: Workout): string {
  const date = new Date(workout.completedAt ?? workout.startedAt);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })} at ${time}`;
}

function formatRecordedSet(set: WorkoutSet, exercise: WorkoutExercise): string {
  const tracking = exercise.exerciseSnapshot?.trackingType ?? exercise.trackingType ?? 'weight-reps';
  const values = trackingFields[tracking].map((kind) => measurementText(set, kind)).filter(Boolean);
  const recorded = values.length ? values.join(' × ') : 'Not recorded';
  const range = (set.plannedTargets ?? []).map((target) => target.maxValue !== undefined && target.maxValue !== target.minValue ? `${target.minValue}–${target.maxValue}` : String(target.minValue ?? target.maxValue ?? '')).filter(Boolean).join(' · ');
  return range ? `${recorded}   ${range}` : recorded;
}

const createStyles = (theme: import('../../types').ForgeTheme) => StyleSheet.create({
  compactContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 72, gap: 14 },
  // Warm-up editing needs room above its final confirmation control; static
  // Exercise info only keeps the normal short-sheet safe trailing clearance.
  infoContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  infoScroll: { paddingTop: 4, paddingBottom: 8 },
  // Let the list occupy all remaining sheet height. The former percentage cap
  // left an inert band under the final card and could clip Show more.
  previousSessionsScroll: { flexShrink: 1 },
  previousSessionsContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 14 },
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
  previousSessionCard: { overflow: 'hidden', borderRadius: 22, marginBottom: 2 },
  previousSessionHeader: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 },
  sessionCopy: { flex: 1, gap: 3 },
  sessionTitle: { color: theme.ink, ...typeScale.cardTitle },
  sessionDate: { color: theme.ink, ...typeScale.body },
  showMoreSessions: { minHeight: 56, borderRadius: 20, justifyContent: 'center', paddingHorizontal: 24 },
  showMoreText: { color: theme.ink, ...typeScale.sectionTitle },
  emptyCard: { borderWidth: 1, borderRadius: 16 },
});
