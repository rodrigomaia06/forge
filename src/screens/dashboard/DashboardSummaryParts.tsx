import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  ForgeCard,
  ForgeText as Text,
  Icon,
  lightHaptic,
  pressedFeedbackSubtle,
} from '../../components/ui';
import { formatCompactDuration, getWorkoutTypePresentation } from '../../domain/workouts/presentation';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { formatTrainingTime, formatVolume } from './dashboardSummary';
import { DASHBOARD_TILE_DEFAULT_TITLE } from '../../state/dashboardLayout';
import type { ForgeTheme, Workout, WorkoutTypePreference } from '../../types';
import type { WorkoutSuggestion } from '../../domain/workouts/suggestNextWorkout';
import type { WeekStripDay } from './dashboardSummary';

function routineSetCount(suggestion: WorkoutSuggestion): number {
  return suggestion.routine.exercises.reduce((total, exercise) => total + (exercise.sets?.length ?? 0), 0);
}

export function DashboardStartCard({
  suggestion,
  workoutTypes,
  onStart,
  onChooseAnother,
}: {
  suggestion: WorkoutSuggestion | null;
  workoutTypes: WorkoutTypePreference[];
  onStart: () => void;
  onChooseAnother: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const routine = suggestion?.routine;
  const presentation = getWorkoutTypePresentation(routine?.type ?? 'strength', workoutTypes, theme, 0.14);
  const exerciseCount = routine?.exercises.length ?? 0;
  const setCount = suggestion ? routineSetCount(suggestion) : 0;
  const meta = routine
    ? `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'} · ${setCount} ${setCount === 1 ? 'set' : 'sets'}`
    : 'Blank or from a routine';
  const title = routine?.name ?? 'Start a workout';

  return (
    <ForgeCard testID="dashboard-start-card" style={styles.startCard}>
      <View style={styles.startHeader}>
        <View style={[styles.startIcon, { backgroundColor: presentation.background }]}>
          <Icon name={routine ? presentation.icon : 'fitness'} size={26} color={presentation.color} />
        </View>
        <View style={styles.startCopy}>
          {suggestion ? <Text style={styles.startEyebrow}>Suggested workout</Text> : null}
          <Text style={styles.startTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.startMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </View>
      <Button
        label="Start Workout"
        icon="play"
        accessibilityLabel={routine ? `Start ${routine.name}` : 'Start a workout'}
        onPress={onStart}
        style={styles.startButton}
      />
      {suggestion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose another workout"
          onPress={() => {
            lightHaptic();
            onChooseAnother();
          }}
          style={({ pressed }) => [styles.startSecondary, pressed && pressedFeedbackSubtle]}
        >
          <Text style={styles.startSecondaryText}>Choose another workout</Text>
        </Pressable>
      ) : null}
    </ForgeCard>
  );
}

export function DashboardWeekCard({
  days,
  workoutCount,
  title,
}: {
  days: WeekStripDay[];
  workoutCount: number;
  title?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <ForgeCard testID="dashboard-week-card" style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{title ?? DASHBOARD_TILE_DEFAULT_TITLE.week}</Text>
        <Text style={styles.cardAside}>{workoutCount} {workoutCount === 1 ? 'workout' : 'workouts'}</Text>
      </View>
      <View testID="dashboard-week-labels" style={styles.weekRow}>
        {days.map((day, index) => (
          <View key={index} style={styles.weekCell}>
            <View
              style={[
                styles.weekDot,
                day.hasWorkout && styles.weekDotFilled,
                !day.hasWorkout && day.isToday && styles.weekDotToday,
                !day.hasWorkout && day.isFuture && styles.weekDotFuture,
              ]}
            >
              {day.hasWorkout ? (
                <Icon name="check" size={16} color={theme.onActionPrimary} weight="bold" />
              ) : null}
            </View>
            <Text style={[styles.weekLabel, day.isToday && styles.weekLabelToday]}>{day.label}</Text>
          </View>
        ))}
      </View>
    </ForgeCard>
  );
}

export function DashboardTrainingTimeCard({
  totalSeconds,
  perDaySeconds,
  days,
  title,
}: {
  totalSeconds: number;
  perDaySeconds: number[];
  days: WeekStripDay[];
  title?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const maxSeconds = Math.max(1, ...perDaySeconds);
  return (
    <ForgeCard testID="dashboard-training-time" style={styles.card}>
      <View style={styles.trainingHeaderRow}>
        <Icon name="time-outline" size={17} color={theme.slate} />
        <Text style={styles.cardTitle}>{title ?? DASHBOARD_TILE_DEFAULT_TITLE['training-time']}</Text>
      </View>
      <View style={styles.trainingBody}>
        <View style={styles.trainingMetricBlock}>
          <Text style={styles.trainingMetric}>{formatTrainingTime(totalSeconds)}</Text>
          <Text style={styles.trainingCaption}>
            {totalSeconds > 0 ? 'this week' : 'No training logged this week'}
          </Text>
        </View>
        <View style={styles.chart}>
          <View style={styles.chartBars}>
            {perDaySeconds.map((seconds, index) => (
              <View key={index} style={styles.chartColumn}>
                <View
                  style={[
                    styles.chartBar,
                    { height: `${Math.max(6, Math.round((seconds / maxSeconds) * 100))}%` },
                    days[index]?.isToday ? styles.chartBarToday : seconds > 0 ? styles.chartBarActive : styles.chartBarEmpty,
                  ]}
                />
                <Text style={[styles.chartLabel, days[index]?.isToday && styles.weekLabelToday]}>
                  {days[index]?.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ForgeCard>
  );
}

export function DashboardLastWorkoutTile({
  lastWorkout,
  workoutTypes,
  title,
  onOpen,
}: {
  lastWorkout: Workout | null;
  workoutTypes: WorkoutTypePreference[];
  title?: string;
  onOpen: (workoutId: string) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const presentation = lastWorkout
    ? getWorkoutTypePresentation(lastWorkout.type, workoutTypes, theme, 0.14)
    : null;
  const lastDate = lastWorkout
    ? new Date(lastWorkout.completedAt ?? lastWorkout.startedAt).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;
  return (
    <ForgeCard testID="dashboard-last-workout" style={styles.wideTile}>
      <Pressable
        accessibilityRole={lastWorkout ? 'button' : undefined}
        accessibilityLabel={lastWorkout ? `Open ${lastWorkout.name}` : undefined}
        disabled={!lastWorkout}
        onPress={lastWorkout ? () => {
          lightHaptic();
          onOpen(lastWorkout.id);
        } : undefined}
        style={({ pressed }) => [styles.wideTileInner, pressed && lastWorkout ? pressedFeedbackSubtle : null]}
      >
        <View style={[styles.tileIcon, { backgroundColor: presentation?.background ?? theme.surfaceMuted }]}>
          <Icon name={presentation?.icon ?? 'fitness'} size={20} color={presentation?.color ?? theme.muted} />
        </View>
        <View style={styles.wideTileCopy}>
          <Text style={styles.tileLabel}>{title ?? DASHBOARD_TILE_DEFAULT_TITLE['last-workout']}</Text>
          {lastWorkout ? (
            <>
              <Text style={styles.wideTileValue} numberOfLines={1}>{lastWorkout.name}</Text>
              <Text style={styles.tileDetail} numberOfLines={1}>
                {lastDate} · {formatCompactDuration(lastWorkout.durationSeconds)}
              </Text>
            </>
          ) : (
            <Text style={styles.tileEmpty}>No workouts yet</Text>
          )}
        </View>
        {lastWorkout ? <Icon name="chevron-forward" size={18} color={theme.slate} /> : null}
      </Pressable>
    </ForgeCard>
  );
}

export function DashboardVolumeTile({
  thisWeekKg,
  deltaPct,
  title,
}: {
  thisWeekKg: number;
  deltaPct: number | null;
  title?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const deltaUp = (deltaPct ?? 0) >= 0;
  return (
    <ForgeCard testID="dashboard-volume" style={styles.wideTile}>
      <View style={styles.wideTileInner}>
        <View style={[styles.tileIcon, { backgroundColor: theme.surfaceMuted }]}>
          <Icon name="activity" size={20} color={theme.ink} />
        </View>
        <View style={styles.wideTileCopy}>
          <Text style={styles.tileLabel}>{title ?? DASHBOARD_TILE_DEFAULT_TITLE.volume}</Text>
          {thisWeekKg > 0 ? (
            <Text style={styles.wideTileValue} numberOfLines={1}>{formatVolume(thisWeekKg)}</Text>
          ) : (
            <Text style={styles.tileEmpty}>—</Text>
          )}
        </View>
        {thisWeekKg > 0 && deltaPct !== null ? (
          <View style={styles.deltaRow}>
            <Icon name={deltaUp ? 'arrow-up' : 'arrow-down'} size={14} color={theme.slate} />
            <Text style={styles.tileDetail}>{Math.abs(deltaPct)}%</Text>
          </View>
        ) : null}
      </View>
    </ForgeCard>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  card: { padding: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: theme.ink, ...typeScale.sectionTitle },
  cardAside: { color: theme.slate, ...typeScale.supporting },

  // Start / suggestion hero.
  startCard: { padding: 16, gap: 14 },
  startHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  startIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  startCopy: { flex: 1, minWidth: 0 },
  startEyebrow: { color: theme.slate, ...typeScale.caption, marginBottom: 2 },
  startTitle: { color: theme.ink, ...typeScale.sectionTitle },
  startMeta: { color: theme.slate, ...typeScale.supporting, marginTop: 2 },
  startButton: { alignSelf: 'stretch' },
  startSecondary: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  startSecondaryText: { color: theme.slate, ...typeScale.controlLabel },

  // This week.
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  weekCell: { alignItems: 'center', gap: 8, flex: 1 },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.divider,
    backgroundColor: 'transparent',
  },
  weekDotFilled: { backgroundColor: theme.actionPrimary, borderColor: theme.actionPrimary },
  weekDotToday: { borderColor: theme.selectionIndicator },
  weekDotFuture: { borderColor: theme.divider, opacity: 0.5 },
  weekLabel: { color: theme.slate, ...typeScale.caption },
  weekLabelToday: { color: theme.ink },

  // Training time.
  trainingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  trainingBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 14 },
  trainingMetricBlock: { justifyContent: 'flex-end', minWidth: 96 },
  trainingMetric: { color: theme.ink, ...typeScale.metricLarge },
  trainingCaption: { color: theme.slate, ...typeScale.caption, marginTop: 4, maxWidth: 120 },
  chart: { flex: 1, height: 88, justifyContent: 'flex-end' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%' },
  chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 },
  chartBar: { width: 8, borderRadius: 4, minHeight: 4 },
  chartBarActive: { backgroundColor: theme.muted },
  chartBarToday: { backgroundColor: theme.ink },
  chartBarEmpty: { backgroundColor: theme.divider },
  chartLabel: { color: theme.slate, ...typeScale.caption },

  // Wide (full-width) stat tiles.
  wideTile: { padding: 0 },
  wideTileInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  wideTileCopy: { flex: 1, minWidth: 0, gap: 2 },
  wideTileValue: { color: theme.ink, ...typeScale.metricMedium },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: theme.slate, ...typeScale.caption },
  tileDetail: { color: theme.slate, ...typeScale.label },
  tileEmpty: { color: theme.muted, ...typeScale.supporting, marginTop: 2 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
