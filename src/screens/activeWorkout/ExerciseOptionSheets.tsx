import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  Button,
  ForgeBottomSheet,
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
import { measurementText, trackingFieldLabel, trackingFields } from '../../domain/exercises/tracking';
import { buildWarmupPlan } from '../../domain/workouts/warmup';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import type { Workout, WorkoutExercise, WorkoutSet, WorkoutSide } from '../../types';
import { HistorySetRow } from './HistorySetRow';
import { SetDetailsCard } from './SetDetailsCard';
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
      <ForgeCard variant="base" style={styles.workingCard}>
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
      <ForgeCard variant="base" style={styles.planCard}>
        {plan.length ? plan.map((set, index) => (
          <View key={`${set.weight}-${set.reps}`} style={[styles.planRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
            <Text style={styles.planIndex}>{index + 1}</Text>
            <Text style={styles.planWeight}>{`${set.weight} kg`}</Text>
            <Text style={[styles.planReps, { color: theme.textSecondary }]}>{`× ${set.reps}`}</Text>
          </View>
        )) : <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>Enter a working weight to see a warm-up ramp.</Text>}
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
  onPressRest,
  unilateral = false,
  leadSide = 'left',
  unilateralRestOverride,
  onPressUnilateralRest,
  onToggleLeadSide,
}: {
  exercise: WorkoutExercise;
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
  const reducedMotion = useForgeReducedMotion();
  const { preferences } = useSettings();
  const detail = useMemo(() => catalogueDetail(exercise), [exercise]);
  // Only allow scrolling when the content actually overflows: a fits-on-screen
  // card should not rubber-band. Compare measured content vs viewport height.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  if (!detail) return null;
  // Match the read path in ActiveWorkoutScreen.restDurationForExercise.
  const exerciseId = exercise.exerciseId ?? exercise.exerciseSnapshot?.id ?? detail.id;
  const restLabel = restReadout(preferences.exerciseRestSeconds[exerciseId]);
  const unilateralRestLabel = restReadout(unilateralRestOverride);
  const scrollable = contentHeight > viewportHeight + 1;
  // Reuse the exact Exercise Library detail card so the two read identically.
  return (
    <Animated.ScrollView
      testID="exercise-info-content"
      style={styles.infoScrollView}
      contentContainerStyle={styles.infoScroll}
      scrollEnabled={scrollable}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContentHeight(height)}
      // Cross-fade the drill-in/back swap while the surface height eases.
      entering={reducedMotion ? undefined : FadeIn.duration(forgeMotion.state)}
      exiting={reducedMotion ? undefined : FadeOut.duration(forgeMotion.feedback)}
    >
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
    </Animated.ScrollView>
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

  return <><Animated.ScrollView
    ref={scrollViewRef}
    // Hug the content and scroll only once it exceeds the sheet's own max
    // height. See docs/decisions/0005 — a maxHeight ON the ScrollView parks it
    // at that height and creates dead space; the sheet surface already caps it.
    style={styles.previousSessionsScroll}
    contentContainerStyle={styles.previousSessionsContent}
    nestedScrollEnabled
    onScroll={(event) => onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)}
    scrollEventThrottle={16}
    // Cross-fade the drill-in/back swap while the surface height eases.
    entering={reducedMotion ? undefined : FadeIn.duration(forgeMotion.state)}
    exiting={reducedMotion ? undefined : FadeOut.duration(forgeMotion.feedback)}
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
  </> : <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}><Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>No completed sessions for this exercise yet.</Text></View>}</Animated.ScrollView>{openSet ? <SetDetailsCard visible set={openSet.set} index={openSet.index} editable={false} onChange={() => undefined} onDelete={() => undefined} onDone={() => setOpenSet(null)} trackingType={openSet.trackingType} /> : null}</>;
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
  compactContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 14 },
  // Warm-up editing needs room above its final confirmation control; static
  // Exercise info only keeps the normal short-sheet safe trailing clearance.
  infoContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  // Hug-then-scroll (ADR 0005): flexShrink lets the body size to its content and
  // scroll within the surface cap instead of parking content high with dead
  // space beneath it. Never put a height/maxHeight on the scroll view itself.
  infoScrollView: { flexShrink: 1 },
  infoScroll: { paddingTop: 4, paddingBottom: 30 },
  // Let the list occupy all remaining sheet height. The former percentage cap
  // left an inert band under the final card and could clip Show more.
  previousSessionsScroll: { flexShrink: 1 },
  previousSessionsContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 14 },
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
  previousSessionCard: { overflow: 'hidden', borderRadius: 22, marginBottom: 2 },
  previousSessionHeader: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 },
  sessionCopy: { flex: 1, gap: 3 },
  sessionTitle: { color: theme.ink, ...typeScale.cardTitle },
  sessionDate: { color: theme.ink, ...typeScale.body },
  showMoreSessions: { minHeight: 56, borderRadius: 20, justifyContent: 'center', paddingHorizontal: 24 },
  showMoreText: { color: theme.ink, ...typeScale.sectionTitle },
  emptyCard: { borderWidth: 1, borderRadius: 16 },
});
