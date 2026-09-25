import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeSelectionSheet, ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../components/ui';
import { SettingsDetailHeader } from './settings/SettingsScreenChrome';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import type { ForgeTheme, RootStackParamList, Workout } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;
type CalendarView = 'month' | 'year' | 'multi';

// A day's density colour for the year/multi heat grids — Forge's consistency
// green, the same language the dashboard's commit grid speaks.
const HEAT_ACCENT = '#5C8B74';
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
  const [elevated, setElevated] = useState(false);
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


  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader
          title="Calendar"
          navigation={navigation}
          elevated={elevated}
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Calendar view: ${VIEW_LABEL[view]}. Change`}
              onPress={() => setViewMenuOpen(true)}
              style={({ pressed }) => [styles.viewSelect, pressed && pressedFeedback]}
            >
              <Text style={styles.viewSelectText}>{VIEW_LABEL[view]}</Text>
              <Icon name="chevron-down" size={16} color={theme.textPrimary} />
            </Pressable>
          }
        />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setElevated(e.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
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
                  <View style={styles.monthWeekHead}>
                    {Array.from({ length: 7 }, (_, i) => <Text key={i} style={styles.monthWeekHeadText}>{WEEKDAY_LETTERS[(weekStart + i) % 7]}</Text>)}
                  </View>
                  {monthWeeks(year, month, weekStart).map((week, wi) => (
                    <View key={wi} style={styles.weekRow}>
                      {week.map((date, di) => {
                        if (!date) return <View key={di} style={styles.dayCell} />;
                        const key = calendarDateKey(date);
                        const dayWorkouts = byDay.get(key) ?? [];
                        const has = dayWorkouts.length > 0;
                        const isToday = key === todayKey;
                        const color = has ? getWorkoutTypePresentation(dayWorkouts[0].type, preferences.workoutTypes, theme, 0.16).color : undefined;
                        return (
                          <Pressable
                            key={di}
                            accessibilityRole="button"
                            accessibilityLabel={`${date.getDate()} ${MONTHS[month]}${has ? `, ${dayWorkouts[0].name}` : ''}`}
                            disabled={!has}
                            onPress={() => openWorkout(dayWorkouts)}
                            style={styles.dayCell}
                          >
                            <View style={[styles.dayCircle, has && color ? { backgroundColor: color } : null, isToday && !has ? { borderWidth: 1.5, borderColor: theme.border } : null]}>
                              <Text style={[styles.dayNum, has ? styles.dayNumOn : null, isToday && !has ? { color: theme.textPrimary, fontWeight: '800' } : null]}>{date.getDate()}</Text>
                              {dayWorkouts.length > 1 ? <View style={styles.dayMulti} /> : null}
                            </View>
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

      <ForgeSelectionSheet
        visible={viewMenuOpen}
        onClose={() => setViewMenuOpen(false)}
        accessibilityLabel="Close view options"
        title="Calendar view"
        selectedTone="success"
        options={(['month', 'year', 'multi'] as CalendarView[]).map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
        selectedValue={view}
        onSelect={(v) => { setView(v); scrolledRef.current = false; }}
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
                    backgroundColor: active ? HEAT_ACCENT : date ? theme.surfaceMuted : 'transparent',
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
  viewSelect: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: theme.surfaceMuted },
  viewSelectText: { ...typeScale.label, color: theme.textPrimary, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  monthSection: { paddingBottom: 14 },
  monthTitle: { ...typeScale.sectionTitle, color: theme.textPrimary, marginTop: 12, marginBottom: 6 },
  monthWeekHead: { flexDirection: 'row', marginBottom: 4 },
  monthWeekHeadText: { flex: 1, textAlign: 'center', color: theme.muted, fontSize: 11, lineHeight: 14 },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 15, lineHeight: 18, color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  dayNumOn: { color: '#FFFFFF', fontWeight: '700' },
  dayMulti: { position: 'absolute', bottom: 2, width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#FFFFFF' },
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
