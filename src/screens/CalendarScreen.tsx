import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../components/ui';
import { SettingsDetailHeader } from './settings/SettingsScreenChrome';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeReducedMotion } from '../theme/motion';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import type { ForgeTheme, RootStackParamList, Workout } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;
type CalendarView = 'month' | 'year';

// Fallback density colour when a workout has no resolvable type colour.
const HEAT_ACCENT = '#5C8B74';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const VIEW_LABEL: Record<CalendarView, string> = { month: 'Month', year: 'Year' };

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
  const reducedMotion = useForgeReducedMotion();
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
  // The month the month-view should scroll to on its next layout (defaults to
  // the current month; a tap on a year cell retargets it).
  const scrollTarget = useRef<{ year: number; month: number }>({ year: today.getFullYear(), month: today.getMonth() });

  const goToMonth = (year: number, month: number) => {
    selectionHaptic();
    scrollTarget.current = { year, month };
    scrolledRef.current = false;
    setView('month');
    setViewMenuOpen(false);
  };
  const colorForDay = (key: string): string | undefined => {
    const workout = byDay.get(key)?.[0];
    return workout ? getWorkoutTypePresentation(workout.type, preferences.workoutTypes, theme, 0.16).color : undefined;
  };

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
              const isTarget = year === scrollTarget.current.year && month === scrollTarget.current.month;
              return (
                <View
                  key={`${year}-${month}`}
                  style={styles.monthSection}
                  onLayout={(e) => {
                    if (isTarget && !scrolledRef.current) {
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
          ) : (
            [...years].reverse().map((year) => (
              <View key={year} style={styles.yearSection}>
                <Text style={styles.yearTitle}>{year}</Text>
                <View style={styles.miniGridWrap}>
                  {MONTHS_SHORT.map((label, m) => (
                    <MiniMonth key={m} label={label} year={year} month={m} weekStart={weekStart} colorFor={colorForDay} onPress={goToMonth} theme={theme} styles={styles} cell={13} />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {viewMenuOpen ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss view options" onPress={() => setViewMenuOpen(false)} style={StyleSheet.absoluteFill} />
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(140)}
              exiting={reducedMotion ? undefined : FadeOut.duration(120)}
              style={[styles.dropdown, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadow }]}
            >
              {(['month', 'year'] as CalendarView[]).map((v) => {
                const active = v === view;
                return (
                  <Pressable
                    key={v}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={VIEW_LABEL[v]}
                    onPress={() => {
                      selectionHaptic();
                      if (v === 'month') { scrollTarget.current = { year: today.getFullYear(), month: today.getMonth() }; scrolledRef.current = false; }
                      setView(v);
                      setViewMenuOpen(false);
                    }}
                    style={({ pressed }) => [styles.dropdownItem, active && { backgroundColor: theme.successSurface }, pressed && !active && { backgroundColor: theme.pressed }]}
                  >
                    <Text style={[styles.dropdownText, active && { color: theme.success, fontWeight: '700' }]}>{VIEW_LABEL[v]}</Text>
                    {active ? <Icon name="check" size={16} color={theme.success} weight="bold" /> : null}
                  </Pressable>
                );
              })}
            </Animated.View>
          </>
        ) : null}
      </View>
    </AppScreen>
  );
}

function MiniMonth({ label, year, month, weekStart, colorFor, onPress, theme, styles, cell }: {
  label: string; year: number; month: number; weekStart: number;
  colorFor: (key: string) => string | undefined; onPress: (year: number, month: number) => void;
  theme: ForgeTheme; styles: ReturnType<typeof createStyles>; cell: number;
}) {
  const weeks = monthWeeks(year, month, weekStart);
  const gap = 2;
  return (
    <Pressable style={styles.miniMonth} accessibilityRole="button" accessibilityLabel={`${label} ${year}`} onPress={() => onPress(year, month)}>
      <Text style={styles.miniMonthLabel}>{label}</Text>
      <View style={[styles.miniGrid, { gap }]}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ gap }}>
            {week.map((date, di) => {
              const color = date ? colorFor(calendarDateKey(date)) : undefined;
              return (
                <View
                  key={di}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: 3,
                    backgroundColor: color ?? (date ? theme.surfaceMuted : 'transparent'),
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  viewSelect: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: theme.surfaceMuted },
  viewSelectText: { ...typeScale.controlLabel, color: theme.textPrimary },
  dropdown: { position: 'absolute', top: 64, right: 16, minWidth: 168, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: 6, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14, zIndex: 20 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, height: 44, borderRadius: 12 },
  dropdownText: { ...typeScale.controlLabel, color: theme.textPrimary },
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
  yearSection: { paddingTop: 14, alignItems: 'center' },
  yearTitle: { ...typeScale.sectionTitle, color: theme.textPrimary, marginBottom: 12, alignSelf: 'flex-start' },
  miniGridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18, width: '100%' },
  miniMonth: { width: '30%', gap: 6, alignItems: 'center' },
  miniMonthLabel: { ...typeScale.caption, color: theme.textSecondary, alignSelf: 'flex-start' },
  miniGrid: { flexDirection: 'row' },
});
