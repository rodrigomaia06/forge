import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeCard, ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../components/ui';
import { SettingsDetailHeader } from './settings/SettingsScreenChrome';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../domain/workouts/presentation';
import type { ForgeTheme, RootStackParamList, Workout } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function workoutDayKey(workout: Workout): string {
  return calendarDateKey(new Date(workout.completedAt ?? workout.startedAt));
}

function formatTotalMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function CalendarScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { completedWorkouts } = useWorkouts();
  const { preferences } = useSettings();
  const weekStart = preferences.weekStartsOn; // 0 = Sunday, 1 = Monday
  const [elevated, setElevated] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = calendarDateKey(today);
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);

  // Group all completed workouts by local day, most-recent first within a day.
  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const workout of completedWorkouts) {
      const key = workoutDayKey(workout);
      const list = map.get(key);
      if (list) list.push(workout);
      else map.set(key, [workout]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));
    }
    return map;
  }, [completedWorkouts]);

  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  // A fixed six-week grid so the calendar never changes height between months.
  const cells = useMemo(() => {
    const firstWeekday = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - firstWeekday + i));
  }, [year, month, weekStart]);

  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => WEEKDAY_LETTERS[(weekStart + i) % 7]),
    [weekStart],
  );

  const monthSummary = useMemo(() => {
    let workouts = 0;
    let seconds = 0;
    const activeDays = new Set<string>();
    for (const [key, list] of byDay) {
      const date = new Date(`${key}T00:00:00`);
      if (date.getFullYear() === year && date.getMonth() === month) {
        workouts += list.length;
        activeDays.add(key);
        for (const w of list) seconds += w.durationSeconds ?? 0;
      }
    }
    return { workouts, seconds, activeDays: activeDays.size };
  }, [byDay, year, month]);

  const selectedWorkouts = byDay.get(selectedKey) ?? [];
  const selectedDate = new Date(`${selectedKey}T00:00:00`);

  const changeMonth = (delta: number) => {
    selectionHaptic();
    setAnchor(new Date(year, month + delta, 1));
  };
  const goToday = () => {
    selectionHaptic();
    setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedKey(todayKey);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader title="Calendar" navigation={navigation} elevated={elevated} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setElevated(e.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <ForgeCard variant="base" style={styles.calendarCard}>
            <View style={styles.monthBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => changeMonth(-1)}
                hitSlop={8}
                style={({ pressed }) => [styles.navButton, pressed && pressedFeedback]}
              >
                <Icon name="chevron-back" size={20} color={theme.textPrimary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${MONTHS[month]} ${year}. Tap for today`}
                onPress={goToday}
                style={({ pressed }) => [styles.monthLabelWrap, pressed && pressedFeedback]}
              >
                <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => changeMonth(1)}
                hitSlop={8}
                style={({ pressed }) => [styles.navButton, pressed && pressedFeedback]}
              >
                <Icon name="chevron-forward" size={20} color={theme.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {weekdayLabels.map((label, i) => (
                <Text key={i} style={styles.weekday}>{label}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((date) => {
                const key = calendarDateKey(date);
                const inMonth = date.getMonth() === month;
                const dayWorkouts = byDay.get(key) ?? [];
                const hasWorkout = dayWorkouts.length > 0;
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                const color = hasWorkout
                  ? getWorkoutTypePresentation(dayWorkouts[0].type, preferences.workoutTypes, theme, 0.16).color
                  : undefined;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${WEEKDAY_FULL[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${hasWorkout ? `, ${dayWorkouts.length} workout${dayWorkouts.length > 1 ? 's' : ''}` : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => { selectionHaptic(); setSelectedKey(key); if (!inMonth) setAnchor(new Date(date.getFullYear(), date.getMonth(), 1)); }}
                    style={styles.cell}
                  >
                    <View
                      style={[
                        styles.dayMark,
                        hasWorkout && color ? { backgroundColor: color } : null,
                        isSelected ? { borderWidth: 2, borderColor: theme.textPrimary } : isToday ? { borderWidth: 1.5, borderColor: theme.border } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          hasWorkout ? styles.dayNumberOnFill : null,
                          !inMonth ? styles.dayNumberMuted : null,
                          isToday && !hasWorkout ? { color: theme.textPrimary, fontWeight: '800' } : null,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                      {dayWorkouts.length > 1 ? (
                        <View style={[styles.countDot, { backgroundColor: theme.background }]}>
                          <Text style={styles.countText}>{dayWorkouts.length}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {monthSummary.workouts === 0
                  ? 'No workouts this month'
                  : `${monthSummary.workouts} workout${monthSummary.workouts > 1 ? 's' : ''} · ${monthSummary.activeDays} day${monthSummary.activeDays > 1 ? 's' : ''} · ${formatTotalMinutes(monthSummary.seconds)}`}
              </Text>
              {!isCurrentMonth ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Jump to today" onPress={goToday} hitSlop={8} style={({ pressed }) => [styles.todayChip, pressed && pressedFeedback]}>
                  <Text style={styles.todayChipText}>Today</Text>
                </Pressable>
              ) : null}
            </View>
          </ForgeCard>

          <Text style={styles.dayTitle}>
            {selectedKey === todayKey ? 'Today' : `${WEEKDAY_FULL[selectedDate.getDay()]}, ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`}
          </Text>

          {selectedWorkouts.length ? (
            <View style={styles.dayList}>
              {selectedWorkouts.map((workout) => {
                const pres = getWorkoutTypePresentation(workout.type, preferences.workoutTypes, theme, 0.16);
                const sets = countWorkoutSets(workout);
                return (
                  <Pressable
                    key={workout.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${workout.name}`}
                    onPress={() => { selectionHaptic(); navigation.navigate('WorkoutDetails', { workoutId: workout.id }); }}
                    style={({ pressed }) => [styles.workoutRow, pressed && pressedFeedback]}
                  >
                    <View style={[styles.workoutIcon, { backgroundColor: pres.background }]}>
                      <Icon name={pres.icon} size={20} color={pres.color} />
                    </View>
                    <View style={styles.workoutCopy}>
                      <Text style={styles.workoutName} numberOfLines={1}>{workout.name}</Text>
                      <Text style={styles.workoutMeta} numberOfLines={1}>
                        {workout.type} · {formatCompactDuration(workout.durationSeconds ?? 0)} · {sets} set{sets === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color={theme.muted} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <ForgeCard variant="base" style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {selectedKey === todayKey ? 'No workout logged today.' : 'No workout on this day.'}
              </Text>
            </ForgeCard>
          )}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 18 },
  calendarCard: { padding: 14, gap: 12 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  monthLabelWrap: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12 },
  monthLabel: { ...typeScale.cardTitle, color: theme.textPrimary },
  weekHeader: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', ...typeScale.caption, color: theme.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayMark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { ...typeScale.label, color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  dayNumberOnFill: { color: '#FFFFFF', fontWeight: '700' },
  dayNumberMuted: { color: theme.textDisabled },
  countDot: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  countText: { color: theme.textPrimary, fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  summaryText: { ...typeScale.caption, color: theme.textSecondary, flexShrink: 1 },
  todayChip: { paddingHorizontal: 12, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
  todayChipText: { ...typeScale.caption, color: theme.textPrimary, fontWeight: '700' },
  dayTitle: { ...typeScale.sectionTitle, color: theme.textPrimary },
  dayList: { gap: 10 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: theme.surface },
  workoutIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  workoutCopy: { flex: 1, minWidth: 0, gap: 2 },
  workoutName: { ...typeScale.controlLabel, color: theme.textPrimary },
  workoutMeta: { ...typeScale.caption, color: theme.textSecondary },
  emptyCard: { padding: 20, alignItems: 'center' },
  emptyText: { ...typeScale.body, color: theme.textSecondary },
});
