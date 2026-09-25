import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeActionSheet, ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../components/ui';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import type { ForgeTheme, RootStackParamList, Workout } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;
type CalendarView = 'month' | 'year' | 'multi';

const CALENDAR_ACCENT = '#3E7DF7';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const VIEW_LABEL: Record<CalendarView, string> = { month: 'Month', year: 'Year', multi: 'Multi-year' };

function dayKeyOf(workout: Workout): string {
  return calendarDateKey(new Date(workout.completedAt ?? workout.startedAt));
}
function monthWeeks(year: number, month: number, weekStart: number): (Date | null)[][] {
  const firstWeekday = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
function weekStartDate(date: Date, weekStart: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function CalendarScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { completedWorkouts } = useWorkouts();
  const { preferences } = useSettings();
  const weekStart = preferences.weekStartsOn;

  const today = useMemo(() => new Date(), []);
  const todayKey = calendarDateKey(today);
  const [view, setView] = useState<CalendarView>('month');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrolledRef = useRef(false);

  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const workout of completedWorkouts) {
      const key = dayKeyOf(workout);
      const list = map.get(key);
      if (list) list.push(workout);
      else map.set(key, [workout]);
    }
    for (const list of map.values()) list.sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));
    return map;
  }, [completedWorkouts]);

  const earliest = useMemo(() => {
    let min = Infinity;
    for (const w of completedWorkouts) min = Math.min(min, w.completedAt ?? w.startedAt);
    return Number.isFinite(min) ? new Date(min) : null;
  }, [completedWorkouts]);

  const { weekStreak, restDays } = useMemo(() => {
    if (!byDay.size) return { weekStreak: 0, restDays: 0 };
    const activeWeeks = new Set<string>();
    let lastTs = 0;
    for (const [key, list] of byDay) {
      activeWeeks.add(calendarDateKey(weekStartDate(new Date(`${key}T00:00:00`), weekStart)));
      lastTs = Math.max(lastTs, list[0].completedAt ?? list[0].startedAt);
    }
    let cursor = weekStartDate(today, weekStart);
    if (!activeWeeks.has(calendarDateKey(cursor))) cursor.setDate(cursor.getDate() - 7);
    let streak = 0;
    while (activeWeeks.has(calendarDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }
    const lastDay = new Date(new Date(lastTs).getFullYear(), new Date(lastTs).getMonth(), new Date(lastTs).getDate());
    const rest = Math.max(0, Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - lastDay.getTime()) / 86_400_000));
    return { weekStreak: streak, restDays: rest };
  }, [byDay, weekStart, today]);

  // Chronological month list from the first workout (capped) through next month.
  const months = useMemo(() => {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    let start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    if (earliest) {
      const e = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
      if (e < start) start = e;
    }
    const cap = new Date(today.getFullYear(), today.getMonth() - 35, 1);
    if (start < cap) start = cap;
    const list: { year: number; month: number }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      list.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, [earliest, today]);

  const years = useMemo(() => {
    const startYear = earliest ? earliest.getFullYear() : today.getFullYear();
    const list: number[] = [];
    for (let y = startYear; y <= today.getFullYear(); y++) list.push(y);
    return list;
  }, [earliest, today]);

  const openWorkout = (dayWorkouts: Workout[]) => {
    if (!dayWorkouts.length) return;
    selectionHaptic();
    navigation.navigate('WorkoutDetails', { workoutId: dayWorkouts[0].id });
  };

  const weekdayHeader = (
    <View style={styles.weekHeader}>
      {Array.from({ length: 7 }, (_, i) => (
        <Text key={i} style={styles.weekday}>{WEEKDAY_LETTERS[(weekStart + i) % 7]}</Text>
      ))}
    </View>
  );

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        {/* Header: back + view dropdown */}
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} hitSlop={8} style={({ pressed }) => [styles.headerButton, pressed && pressedFeedback]}>
            <Icon name="chevron-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Calendar view: ${VIEW_LABEL[view]}. Change`} onPress={() => setViewMenuOpen(true)} style={({ pressed }) => [styles.viewSelect, pressed && pressedFeedback]}>
            <Text style={styles.viewSelectText}>{VIEW_LABEL[view]}</Text>
            <Icon name="chevron-down" size={18} color={theme.textPrimary} />
          </Pressable>
          <View style={styles.headerButton} />
        </View>

        {/* Streak chips */}
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Icon name="warm-up" size={16} color="#F4823B" />
            <Text style={styles.chipText}>{weekStreak} week streak</Text>
          </View>
          <View style={styles.chip}>
            <Icon name="theme-dark" size={15} color={CALENDAR_ACCENT} />
            <Text style={styles.chipText}>{restDays} rest day{restDays === 1 ? '' : 's'}</Text>
          </View>
        </View>

        {view === 'month' ? weekdayHeader : null}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          {view === 'month' ? (
            months.map(({ year, month }) => {
              const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
              return (
                <View
                  key={`${year}-${month}`}
                  style={styles.monthSection}
                  onLayout={(e) => {
                    if (isCurrentMonth && !scrolledRef.current) {
                      scrolledRef.current = true;
                      const y = e.nativeEvent.layout.y;
                      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }));
                    }
                  }}
                >
                  <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
                  {monthWeeks(year, month, weekStart).map((week, wi) => (
                    <View key={wi} style={styles.weekRow}>
                      {week.map((date, di) => {
                        if (!date) return <View key={di} style={styles.dayCell} />;
                        const key = calendarDateKey(date);
                        const dayWorkouts = byDay.get(key) ?? [];
                        const has = dayWorkouts.length > 0;
                        const isToday = key === todayKey;
                        return (
                          <Pressable
                            key={di}
                            accessibilityRole="button"
                            accessibilityLabel={`${date.getDate()} ${MONTHS[month]}${has ? `, ${dayWorkouts[0].name}` : ''}`}
                            disabled={!has}
                            onPress={() => openWorkout(dayWorkouts)}
                            style={styles.dayCell}
                          >
                            <View style={[styles.dayCircle, has ? { backgroundColor: CALENDAR_ACCENT } : null, isToday && !has ? { borderWidth: 1.5, borderColor: theme.border } : null]}>
                              <Text style={[styles.dayNum, has ? styles.dayNumOn : null, isToday && !has ? { color: theme.textPrimary, fontWeight: '800' } : null]}>{date.getDate()}</Text>
                            </View>
                            <Text style={styles.dayLabel} numberOfLines={1}>
                              {has ? (dayWorkouts.length > 1 ? `${dayWorkouts.length} workouts` : dayWorkouts[0].name) : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })
          ) : view === 'year' ? (
            [...years].reverse().map((year) => (
              <View key={year} style={styles.yearSection}>
                <Text style={styles.yearTitle}>{year}</Text>
                <View style={styles.miniGridWrap}>
                  {MONTHS_SHORT.map((label, m) => (
                    <MiniMonth key={m} label={label} year={year} month={m} weekStart={weekStart} byDay={byDay} theme={theme} styles={styles} cell={13} />
                  ))}
                </View>
              </View>
            ))
          ) : (
            [...years].reverse().map((year) => (
              <View key={year} style={styles.multiRow}>
                <Text style={styles.multiYear}>{year}</Text>
                <View style={styles.multiMonths}>
                  {MONTHS_SHORT.map((label, m) => (
                    <MiniMonth key={m} label={label} year={year} month={m} weekStart={weekStart} byDay={byDay} theme={theme} styles={styles} cell={6} compact />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <ForgeActionSheet
        visible={viewMenuOpen}
        onClose={() => setViewMenuOpen(false)}
        accessibilityLabel="Close view options"
        title="Calendar view"
        actions={(['month', 'year', 'multi'] as CalendarView[]).map((v) => ({
          label: VIEW_LABEL[v],
          icon: v === view ? ('check' as const) : ('calendar' as const),
          onPress: () => { setView(v); scrolledRef.current = false; },
        }))}
      />
    </AppScreen>
  );
}

function MiniMonth({ label, year, month, weekStart, byDay, theme, styles, cell, compact }: {
  label: string; year: number; month: number; weekStart: number;
  byDay: Map<string, Workout[]>; theme: ForgeTheme; styles: ReturnType<typeof createStyles>; cell: number; compact?: boolean;
}) {
  const weeks = monthWeeks(year, month, weekStart);
  const gap = compact ? 1.5 : 2;
  return (
    <View style={compact ? styles.miniMonthCompact : styles.miniMonth}>
      <Text style={styles.miniMonthLabel}>{label}</Text>
      <View style={[styles.miniGrid, { gap }]}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ gap }}>
            {week.map((date, di) => {
              const active = date ? byDay.has(calendarDateKey(date)) : false;
              return (
                <View
                  key={di}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: compact ? 1.5 : 3,
                    backgroundColor: active ? CALENDAR_ACCENT : date ? theme.surfaceMuted : 'transparent',
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  viewSelect: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  viewSelectText: { ...typeScale.cardTitle, color: theme.textPrimary },
  chips: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 14, backgroundColor: theme.surface },
  chipText: { ...typeScale.label, color: theme.textPrimary },
  weekHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', ...typeScale.caption, color: theme.muted },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 4 },
  monthSection: { paddingBottom: 8 },
  monthTitle: { ...typeScale.sectionTitle, color: theme.textPrimary, marginTop: 12, marginBottom: 6 },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, aspectRatio: 0.82, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3, gap: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNum: { ...typeScale.label, color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  dayNumOn: { color: '#FFFFFF', fontWeight: '700' },
  dayLabel: { fontSize: 9, lineHeight: 11, color: theme.muted, textAlign: 'center', width: '100%', paddingHorizontal: 1 },
  yearSection: { paddingTop: 12 },
  yearTitle: { ...typeScale.sectionTitle, color: theme.textPrimary, marginBottom: 8 },
  miniGridWrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 8 },
  miniMonth: { width: '31%', gap: 5 },
  miniMonthCompact: { gap: 3 },
  miniMonthLabel: { ...typeScale.caption, color: theme.textSecondary },
  miniGrid: { flexDirection: 'row' },
  multiRow: { paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
  multiYear: { ...typeScale.controlLabel, color: theme.textPrimary },
  multiMonths: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 10 },
});
