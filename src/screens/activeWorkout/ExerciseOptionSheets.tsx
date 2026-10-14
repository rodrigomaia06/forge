import { ExerciseInfoTabs, type ExerciseInfoTab, type ExerciseInfoReview, type ExerciseInfoHeader } from '../../components/exerciseInfo/ExerciseInfoTabs';
import { ExerciseHistory as PreviousSessionsContent } from '../../components/exerciseInfo/ExerciseHistory';
import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import { ForgeSheetScrollView } from '../../components/ui/ForgeSheetScrollView';
import { effectiveTracking } from '../../domain/exercises/tracking';
import React, { useMemo, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  Button,
  ForgeBottomSheet,
  ForgeBottomSheetDragArea,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  Icon,
  pressedFeedback,
  pressedFeedbackSubtle,
} from '../../components/ui';
import { ExerciseDetailBody, UnilateralDetailSection } from '../../components/ExerciseDetailBody';
import { useSettings } from '../../state/SettingsContext';
import { exerciseCatalog, taxonomyLabel, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { measurementDisplay, measurementText, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { buildWarmupPlan } from '../../domain/workouts/warmup';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import type { Workout, WorkoutExercise, WorkoutSet, WorkoutSide } from '../../types';
import { animateLayout } from './activeWorkoutFeedback';

export function WarmupSetsContent({
  exercise,
  workouts,
  onAdd,
}: {
  exercise: WorkoutExercise;
  workouts: readonly Workout[];
  /** Adds the computed ramp; the host sheet closes so the new sets show in the workout. */
  onAdd: (sets: readonly { weight: string; reps: string }[]) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const previousWorkingSet = useMemo(() => {
    const latest = findPreviousSessions(exercise, workouts)[0]?.exercise;
    return latest?.sets.find((set) => set.tag !== 'Warm Up') ?? latest?.sets[0];
  }, [exercise, workouts]);
  const initialWorkingSet = useMemo(
    () => previousWorkingSet ?? exercise.sets.find((set) => set.tag !== 'Warm Up' && (set.weight || set.reps)) ?? exercise.sets[0],
    [exercise.sets, previousWorkingSet],
  );
  // This view mounts fresh each time the warm-up option opens (keyed fragment),
  // so it can seed its working set from state without a visibility effect.
  const [weight, setWeight] = useState(initialWorkingSet?.weight ?? '');
  const [reps, setReps] = useState(initialWorkingSet?.reps ?? '');
  // Scroll only when the ramp overflows the sheet — a short plan stays static.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const plan = buildWarmupPlan(Number(weight.replace(',', '.')), Number(reps));
  const scrollable = contentHeight > viewportHeight + 1;
  const add = (): void => {
    if (!plan.length) return;
    // Dismiss the working-set keyboard before the sheet closes so the workout's
    // set list is fully visible when the user lands back on it.
    Keyboard.dismiss();
    onAdd(plan);
  };

  return (
    <Animated.ScrollView
      // Direct child of the sheet surface (ADR 0005): flexShrink lets it hug its
      // content and scroll only within the surface cap. The fade lives on this
      // scroll root, never a wrapping View, so the height chain stays intact.
      style={styles.infoScrollView}
      contentContainerStyle={styles.compactContent}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollable}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContentHeight(height)}
      entering={reducedMotion ? undefined : FadeIn.duration(forgeMotion.state)}
      exiting={reducedMotion ? undefined : FadeOut.duration(forgeMotion.feedback)}
    >
      <Text style={styles.sectionLabel}>Working set</Text>
      <ForgeCard variant="nested" style={styles.workingCard}>
        <View style={styles.workingRow}>
          <Text style={styles.workingLabel}>Weight</Text>
          <TextInput accessibilityLabel="Working weight" value={weight} selection={{ start: weight.length, end: weight.length }} selectTextOnFocus={false} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textDisabled} style={styles.workingInput} />
          <Text style={styles.unit}>kg</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        <View style={styles.workingRow}>
          <Text style={styles.workingLabel}>Reps</Text>
          <TextInput accessibilityLabel="Working reps" value={reps} selection={{ start: reps.length, end: reps.length }} selectTextOnFocus={false} onChangeText={setReps} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.textDisabled} style={styles.workingInput} />
          <Text style={styles.unit}>reps</Text>
        </View>
      </ForgeCard>
      <Text style={styles.sectionLabel}>Warm-up sets</Text>
      <ForgeCard variant="nested" style={styles.planCard}>
        {plan.length ? plan.map((set, index) => (
          <View key={`${set.weight}-${set.reps}`} style={[styles.planRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
            <Text style={styles.planIndex}>{index + 1}</Text>
            <Text style={styles.planWeight}>{`${set.weight} kg`}</Text>
            <Text style={[styles.planReps, { color: theme.textSecondary }]}>{`× ${set.reps}`}</Text>
          </View>
        )) : (
          <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
            Enter a working weight to see a warm-up ramp.
          </Text>
        )}
      </ForgeCard>
      <Button
        label="Add warm-up sets"
        accessibilityLabel="Add warm-up sets"
        icon="check"
        variant="outline"
        tone={plan.length ? 'success' : 'neutral'}
        disabled={!plan.length}
        onPress={add}
        style={styles.warmupAddButton}
      />
    </Animated.ScrollView>
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

function restReadout(seconds: number | undefined): string {
  return seconds === undefined
    ? 'Default'
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ExerciseInfoContent({
  exercise,
  workouts = [],
  excludeWorkoutId,
  onOpenWorkout,
  tab,
  onTabChange,
  review,
  onReviewChange,
  onHeaderChange,
  onPressRest,
  unilateral = false,
  leadSide = 'left',
  unilateralRestOverride,
  onPressUnilateralRest,
  onToggleLeadSide,
}: {
  exercise: WorkoutExercise;
  workouts?: readonly Workout[];
  excludeWorkoutId?: string;
  onOpenWorkout?: (id: string) => void;
  tab?: ExerciseInfoTab;
  onTabChange?: (tab: ExerciseInfoTab) => void;
  review?: ExerciseInfoReview;
  onReviewChange?: (review: ExerciseInfoReview) => void;
  onHeaderChange?: (header: ExerciseInfoHeader | null) => void;
  onPressRest?: () => void;
  /** Unilateral exercises expose a between-sides rest and a leading-side choice. */
  unilateral?: boolean;
  leadSide?: WorkoutSide;
  unilateralRestOverride?: number;
  onPressUnilateralRest?: () => void;
  onToggleLeadSide?: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const detail = useMemo(() => catalogueDetail(exercise), [exercise]);
  if (!detail) return <ExerciseInfoTabs exercise={exercise} workouts={workouts} excludeWorkoutId={excludeWorkoutId} onOpenWorkout={onOpenWorkout} tab={tab} onTabChange={onTabChange} review={review} onReviewChange={onReviewChange} onHeaderChange={onHeaderChange} info={<ForgeSheetScrollView contentContainerStyle={styles.infoScroll}><Text style={{ color: theme.textSecondary }}>Catalogue details are not available for this exercise.</Text></ForgeSheetScrollView>} />;
  // Match the read path in ActiveWorkoutScreen.restDurationForExercise.
  const exerciseId = exercise.exerciseId ?? exercise.exerciseSnapshot?.id ?? detail.id;
  const restLabel = restReadout(preferences.exerciseRestSeconds[exerciseId]);
  const unilateralRestLabel = restReadout(unilateralRestOverride);
  const body = (
    <ExerciseDetailBody
      detail={detail}
      workoutTypes={preferences.workoutTypes}
      restLabel={restLabel}
      onPressRest={onPressRest}
      // The sheet already provides bottom clearance; keep the content's own
      // padding small so it doesn't stack into dead space under the last card.
      bottomPadding={2}
      secondaryRest={unilateral
        ? { title: 'Between sides', value: unilateralRestLabel, onPress: onPressUnilateralRest }
        : undefined}
      footer={unilateral ? (
        <UnilateralDetailSection leadSide={leadSide} onToggleLeadSide={onToggleLeadSide} />
      ) : undefined}
    />
  );
  return <ExerciseInfoTabs exercise={exercise} workouts={workouts} excludeWorkoutId={excludeWorkoutId} onOpenWorkout={onOpenWorkout} tab={tab} onTabChange={onTabChange} review={review} onReviewChange={onReviewChange} onHeaderChange={onHeaderChange} info={
    <ForgeSheetScrollView testID="exercise-info-content" contentContainerStyle={styles.infoScroll}>{body}</ForgeSheetScrollView>
  } />;
}


export { ExerciseHistory as PreviousSessionsContent } from '../../components/exerciseInfo/ExerciseHistory';

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
      trackingType: effectiveTracking(exercise),
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
      return effectiveTracking(candidate) === effectiveTracking(exercise) && (id ? candidateId === id : normalizeName(candidate.name) === normalizedName);
    })
    .sort((a, b) => (b.workout.completedAt ?? b.workout.startedAt) - (a.workout.completedAt ?? a.workout.startedAt));
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function formatRecordedSet(set: WorkoutSet, exercise: WorkoutExercise): string {
  const tracking = effectiveTracking(exercise);
  const values = trackingFields[tracking].map((kind) => measurementDisplay(set, kind)).filter(Boolean);
  const recorded = values.length ? values.join(' × ') : 'Not recorded';
  const range = (set.plannedTargets ?? []).map((target) => target.maxValue !== undefined && target.maxValue !== target.minValue ? `${target.minValue}–${target.maxValue}` : String(target.minValue ?? target.maxValue ?? '')).filter(Boolean).join(' · ');
  return range ? `${recorded}   ${range}` : recorded;
}

const createStyles = (theme: import('../../types').ForgeTheme) => StyleSheet.create({
  compactContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 14 },
  // Warm-up editing needs room above its final confirmation control; static
  // Exercise info only keeps the normal short-sheet safe trailing clearance.
  infoContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  // The warm-up body must retain its height across content swaps while yielding
  // scrolling to the sheet; a zero-height remount collapses native layout.
  infoScrollView: { flexShrink: 1, minHeight: 400 },
  infoScroll: { paddingTop: 4, paddingBottom: 30 },
  supporting: { ...typeScale.body },
  sectionLabel: { marginTop: 8, marginLeft: 6, color: theme.textPrimary, ...typeScale.sectionTitle },
  workingCard: { overflow: 'hidden', borderRadius: 16 },
  workingRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  workingLabel: { flex: 1, color: theme.ink, ...typeScale.label },
  // Boxed, centre-aligned entry that matches the Live Workout set/reps inputs,
  // so text is edited from the centre rather than right-anchored.
  workingInput: {
    width: 78,
    minHeight: 38,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 8,
    backgroundColor: theme.surfaceMuted,
    color: theme.ink,
    ...typeScale.body,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingVertical: 0,
    paddingHorizontal: 6,
  },
  unit: { width: 34, color: theme.slate, ...typeScale.label },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  planCard: { overflow: 'hidden', borderRadius: 16 },
  planRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  planIndex: { width: 22, color: theme.slate, ...typeScale.label },
  planWeight: { flex: 1, color: theme.ink, ...typeScale.label },
  planReps: { ...typeScale.label },
  // The warm-up confirmation lives in the scroll body, not the sheet header, so
  // no working-set state has to lift into the host options sheet.
  warmupAddButton: { marginTop: 2, alignSelf: 'stretch', minHeight: 48, borderRadius: 14 },
  emptyMessage: { padding: 16, ...typeScale.body },
  infoCard: { overflow: 'hidden', borderRadius: 16 },
  infoRow: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 10, gap: 2 },
  infoLabel: { ...typeScale.caption },
  infoValue: { color: theme.ink, ...typeScale.label },
  emptyCard: { borderWidth: 1, borderRadius: 16 },
});
