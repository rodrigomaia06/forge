import { ForgeEntityName } from '../../components/ui';
import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
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
import { useTileChrome, tileHeaderRightInset } from './tileChrome';
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
}: {
  suggestion: WorkoutSuggestion | null;
  workoutTypes: WorkoutTypePreference[];
  onStart: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const routine = suggestion?.routine;
  const plan = suggestion?.plan;
  const presentation = getWorkoutTypePresentation(routine?.type ?? 'strength', workoutTypes, theme, 0.14);
  const exerciseCount = routine?.exercises.length ?? 0;
  const setCount = suggestion ? routineSetCount(suggestion) : 0;
  const meta = routine
    ? `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'} · ${setCount} ${setCount === 1 ? 'set' : 'sets'}`
    : 'Blank or from a routine';
  // Name the plan alongside the routine, the same "Plan - Routine" form the
  // history timeline uses for plan-based sessions, so the suggestion reads the same.
  const title = routine ? (plan ? `${plan.name} - ${routine.name}` : routine.name) : 'Start a workout';

  return (
    <View style={styles.startInner}>
      <View style={styles.startHeader}>
        <View style={[styles.startIcon, { backgroundColor: presentation.background }]}>
          <Icon name={routine ? presentation.icon : 'fitness'} size={26} color={presentation.color} />
        </View>
        <View style={styles.startCopy}>
          {suggestion ? <Text style={styles.startEyebrow}>Suggested workout</Text> : null}
          <ForgeEntityName style={styles.startTitle} presentation="full">{title}</ForgeEntityName>
          <Text style={styles.startMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </View>
      <Button
        label="Start Workout"
        icon="play"
        accessibilityLabel={routine ? `Start ${routine.name}` : 'Start a workout'}
        onPress={onStart}
        pressDelay={80}
        style={styles.startButton}
      />
    </View>
  );
}

export function DashboardWeekCard({
  days,
  workoutCount,
  workoutTypes,
  onSelectDay,
}: {
  days: WeekStripDay[];
  workoutCount: number;
  workoutTypes: WorkoutTypePreference[];
  /** Open a trained day's session; omitted (e.g. while editing) leaves the dots inert. */
  onSelectDay?: (day: WeekStripDay) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const inset = tileHeaderRightInset(useTileChrome());
  return (
    <View style={styles.blockInner}>
      <View style={[styles.cardHeaderRow, { paddingRight: inset }]}>
        <Text style={styles.cardTitle}>{DASHBOARD_TILE_DEFAULT_TITLE.week}</Text>
        <Text style={styles.cardAside}>{workoutCount} {workoutCount === 1 ? 'workout' : 'workouts'}</Text>
      </View>
      <View testID="dashboard-week-labels" style={styles.weekRow}>
        {days.map((day, index) => {
          const interactive = day.hasWorkout && !!onSelectDay;
          const dayName = day.date.toLocaleDateString(undefined, { weekday: 'long' });
          const dot = (
            <View
              style={[
                styles.weekDot,
                day.hasWorkout && styles.weekDotFilled,
                !day.hasWorkout && day.isToday && styles.weekDotToday,
                !day.hasWorkout && day.isFuture && styles.weekDotFuture,
              ]}
            >
              {day.hasWorkout ? (
                <>
                  {/* Trained days fill with the workout-type colour; a day with
                      several workouts splits the circle into one segment each. */}
                  <View style={styles.weekDotSegments}>
                    {day.types.map((type, typeIndex) => (
                      <View
                        key={typeIndex}
                        style={{
                          flex: 1,
                          backgroundColor: getWorkoutTypePresentation(type, workoutTypes, theme, 1).color,
                        }}
                      />
                    ))}
                  </View>
                  <View style={styles.weekDotCheck}>
                    <Icon name="check" size={16} color="#FFFFFF" weight="bold" />
                  </View>
                </>
              ) : null}
            </View>
          );
          return (
            <View key={index} style={styles.weekCell}>
              {interactive ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${dayName}'s ${day.types.join(', ')} workout`}
                  // Delay the press so a scroll that starts on this control from
                  // standstill is handed to the list instead of being swallowed.
                  unstable_pressDelay={80}
                  onPress={() => {
                    lightHaptic();
                    onSelectDay?.(day);
                  }}
                  hitSlop={6}
                  style={({ pressed }) => [styles.weekDotAction, pressed && pressedFeedbackSubtle]}
                >
                  {dot}
                </Pressable>
              ) : (
                dot
              )}
              <Text style={[styles.weekLabel, day.isToday && styles.weekLabelToday]}>{day.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DashboardTrainingTimeCard({
  totalSeconds,
  perDaySeconds,
  days,
}: {
  totalSeconds: number;
  perDaySeconds: number[];
  days: WeekStripDay[];
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const maxSeconds = Math.max(1, ...perDaySeconds);
  return (
    <View style={styles.blockInner}>
      <View style={styles.trainingHeaderRow}>
        <Icon name="time-outline" size={17} color={theme.slate} />
        <Text style={styles.cardTitle}>{DASHBOARD_TILE_DEFAULT_TITLE['training-time']}</Text>
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
    </View>
  );
}

export function DashboardLastWorkoutTile({
  lastWorkout,
  workoutTypes,
  onOpen,
}: {
  lastWorkout: Workout | null;
  workoutTypes: WorkoutTypePreference[];
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
    <Pressable
      accessibilityRole={lastWorkout ? 'button' : undefined}
      accessibilityLabel={lastWorkout ? `Open ${lastWorkout.name}` : undefined}
      disabled={!lastWorkout}
      unstable_pressDelay={80}
      onPress={lastWorkout ? () => {
        lightHaptic();
        onOpen(lastWorkout.id);
      } : undefined}
      style={({ pressed }) => [styles.wideInner, pressed && lastWorkout ? pressedFeedbackSubtle : null]}
    >
      <View style={[styles.tileIcon, { backgroundColor: presentation?.background ?? theme.surfaceMuted }]}>
        <Icon name={presentation?.icon ?? 'fitness'} size={26} color={presentation?.color ?? theme.muted} />
      </View>
      <View style={styles.wideCopy}>
        <Text style={styles.tileLabel}>{DASHBOARD_TILE_DEFAULT_TITLE['last-workout']}</Text>
        {lastWorkout ? (
          <>
            <ForgeEntityName style={styles.wideValue} presentation="preview">{lastWorkout.name}</ForgeEntityName>
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
  );
}

export function DashboardVolumeTile({
  thisWeekKg,
  lastWeekKg,
  deltaPct,
}: {
  thisWeekKg: number;
  lastWeekKg: number;
  deltaPct: number | null;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const deltaUp = (deltaPct ?? 0) >= 0;
  // An empty week is not zero volume — it means "nothing logged yet". Keep the
  // tile useful by carrying last week's total forward as context, so the number
  // still means something on a Monday morning.
  const started = thisWeekKg > 0;
  return (
    <View style={styles.wideInner}>
      <View style={[styles.tileIcon, { backgroundColor: theme.surfaceMuted }]}>
        <Icon name="activity" size={20} color={theme.ink} />
      </View>
      <View style={styles.wideCopy}>
        <Text style={styles.tileLabel}>{DASHBOARD_TILE_DEFAULT_TITLE.volume}</Text>
        {started ? (
          <Text style={styles.wideValue} numberOfLines={1}>{formatVolume(thisWeekKg)}</Text>
        ) : lastWeekKg > 0 ? (
          <Text style={styles.tileDetail} numberOfLines={1}>
            Nothing yet · last week {formatVolume(lastWeekKg)}
          </Text>
        ) : (
          <Text style={styles.tileEmpty}>No training logged yet</Text>
        )}
      </View>
      {started && deltaPct !== null ? (
        <View style={styles.deltaRow}>
          <Icon name={deltaUp ? 'arrow-up' : 'arrow-down'} size={14} color={theme.slate} />
          <Text style={styles.tileDetail}>{Math.abs(deltaPct)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  // Right padding keeps the aside ("N workouts") clear of the in-card remove (X).
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: theme.ink, ...typeScale.sectionTitle },
  cardAside: { color: theme.slate, ...typeScale.supporting },
  blockInner: { gap: 0 },

  // Start / suggestion hero.
  startInner: { gap: 14 },
  startHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  startIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  startCopy: { flex: 1, minWidth: 0 },
  startEyebrow: { color: theme.slate, ...typeScale.caption, marginBottom: 2 },
  startTitle: { color: theme.ink, ...typeScale.sectionTitle },
  startMeta: { color: theme.slate, ...typeScale.supporting, marginTop: 2 },
  startButton: { alignSelf: 'stretch' },

  // This week.
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  weekCell: { alignItems: 'center', gap: 8, flex: 1 },
  weekDotAction: { borderRadius: 16 },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.divider,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  weekDotFilled: { borderColor: 'transparent' },
  // The segments carry their own circular clip: iOS does not reliably clip
  // absolutely-positioned children to the parent's border radius, which made the
  // filled dots render as squircles.
  weekDotSegments: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', borderRadius: 16, overflow: 'hidden' },
  weekDotCheck: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  weekDotToday: { borderColor: theme.selectionIndicator },
  weekDotFuture: { borderColor: theme.divider, opacity: 0.5 },
  weekLabel: { color: theme.slate, ...typeScale.caption },
  weekLabelToday: { color: theme.ink },

  // Training time.
  trainingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // The chart box top sits this far below the title, so the tallest bar (capped
  // at the box height) always clears the "Training time" title.
  trainingBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 28 },
  trainingMetricBlock: { justifyContent: 'flex-end', minWidth: 92 },
  trainingMetric: { color: theme.ink, ...typeScale.metricLarge },
  trainingCaption: { color: theme.slate, ...typeScale.caption, marginTop: 4, maxWidth: 116 },
  // Fixed-height chart box so bars never grow into the title above.
  chart: { flex: 1, height: 74, justifyContent: 'flex-end' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%' },
  chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 },
  chartBar: { width: 8, borderRadius: 4, minHeight: 4 },
  chartBarActive: { backgroundColor: theme.muted },
  chartBarToday: { backgroundColor: theme.ink },
  chartBarEmpty: { backgroundColor: theme.divider },
  chartLabel: { color: theme.slate, ...typeScale.caption },

  // Wide stat tiles (last workout / volume).
  wideInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wideCopy: { flex: 1, minWidth: 0, gap: 2 },
  wideValue: { color: theme.ink, ...typeScale.metricMedium },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: theme.slate, ...typeScale.caption },
  tileDetail: { color: theme.slate, ...typeScale.label },
  tileEmpty: { color: theme.muted, ...typeScale.supporting, marginTop: 2 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
