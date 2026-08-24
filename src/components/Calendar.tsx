import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { monthDays, workoutsByDate } from '../data/mockWorkouts';
import { colors, typography } from '../theme/tokens';
import { Icon } from './ui';
import type { Dispatch, SetStateAction } from 'react';
import type { ForgeTheme, WorkoutMap, WorkoutSummary } from '../types';

const VIEWS = ['year', 'month', 'week'] as const;
type CalendarView = (typeof VIEWS)[number];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface CalendarProps {
  selectedDay: number;
  setSelectedDay: Dispatch<SetStateAction<number>>;
  theme?: ForgeTheme;
  workoutMap?: WorkoutMap;
}
export function Calendar({
  selectedDay,
  setSelectedDay,
  theme = colors,
  workoutMap = workoutsByDate,
}: CalendarProps) {
  const [view, setView] = useState<CalendarView>('month');
  const [menuOpen, setMenuOpen] = useState(false);
  const [month, setMonth] = useState(8);
  const title =
    view === 'year'
      ? 'Activity 2026'
      : view === 'week'
        ? 'Week of August 24'
        : `${MONTHS[month - 1]} 2026`;

  const selectView = (nextView: CalendarView): void => {
    triggerLightHaptic();
    setView(nextView);
    setMenuOpen(false);
  };

  return (
    <View style={[styles.calendar, { backgroundColor: theme.calendarSurface || '#F2F2F2' }]}>
      <View style={[styles.calendarInner, view !== 'year' && styles.compactCalendarInner]}>
        <View style={styles.header}>
          <Text style={[styles.monthTitle, { color: theme.ink }]}>{title}</Text>
          <Pressable
            testID="calendar-view-menu-button"
            accessibilityRole="button"
            accessibilityLabel="Change calendar view"
            onPress={() => setMenuOpen((open) => !open)}
            style={styles.viewControl}
          >
            <Text style={[styles.viewControlText, { color: theme.ink }]}>
              {view === 'year' ? 'This Year' : view === 'week' ? 'This Week' : 'This Month'}
            </Text>
            <Icon name="chevron-down" size={15} color={theme.slate} />
          </Pressable>
        </View>
        {menuOpen && <CalendarViewMenu view={view} theme={theme} onSelect={selectView} />}
        <CalendarContent
          view={view}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          theme={theme}
          month={month}
          setMonth={setMonth}
          workoutMap={workoutMap}
        />
      </View>
    </View>
  );
}

function CalendarViewMenu({
  view,
  theme,
  onSelect,
}: {
  view: CalendarView;
  theme: ForgeTheme;
  onSelect: (view: CalendarView) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress]);
  return (
    <Animated.View
      style={[
        styles.viewMenu,
        {
          backgroundColor: theme.surface,
          borderColor: theme.divider,
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
          ],
        },
      ]}
    >
      {VIEWS.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="menuitem"
          onPress={() => onSelect(item)}
          style={[styles.viewMenuItem, item === view && { backgroundColor: theme.surfaceMuted }]}
        >
          <Text style={[styles.viewMenuText, { color: theme.ink }]}>
            {item[0].toUpperCase() + item.slice(1)}
          </Text>
          {item === view && <Text style={[styles.viewMenuCheck, { color: theme.marker }]}>✓</Text>}
        </Pressable>
      ))}
    </Animated.View>
  );
}

function triggerLightHaptic() {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function CalendarContent({
  view,
  selectedDay,
  setSelectedDay,
  theme,
  month,
  setMonth,
  workoutMap,
}: {
  view: CalendarView;
  selectedDay: number;
  setSelectedDay: Dispatch<SetStateAction<number>>;
  theme: ForgeTheme;
  month: number;
  setMonth: Dispatch<SetStateAction<number>>;
  workoutMap: WorkoutMap;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [view, progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) },
        ],
      }}
    >
      {view === 'year' && (
        <YearView
          theme={theme}
          onSelectMonth={(selectedMonth) => {
            setMonth(selectedMonth);
          }}
          workoutMap={workoutMap}
        />
      )}
      {view === 'month' && (
        <MonthView
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          theme={theme}
          month={month}
          workoutMap={workoutMap}
        />
      )}
      {view === 'week' && (
        <WeekView
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          theme={theme}
          workoutMap={workoutMap}
        />
      )}
    </Animated.View>
  );
}

function MonthView({
  selectedDay,
  setSelectedDay,
  theme,
  month,
  workoutMap,
}: Omit<Parameters<typeof CalendarContent>[0], 'view' | 'setMonth'>) {
  const leadingBlanks = month === 8 ? 5 : 0;
  return (
    <>
      <View style={styles.weekHeader}>
        {WEEKDAYS.map((day, index) => (
          <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.muted }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <View key={`blank-${index}`} style={styles.dayCell} />
        ))}
        {monthDays.map((day) => (
          <DayCell
            key={day}
            day={day}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            theme={theme}
            workoutMap={workoutMap}
          />
        ))}
      </View>
    </>
  );
}

function WeekView({
  selectedDay,
  setSelectedDay,
  theme,
  workoutMap,
}: Omit<Parameters<typeof CalendarContent>[0], 'view' | 'month' | 'setMonth'>) {
  const days = [24, 25, 26, 27, 28, 29, 30];
  return (
    <>
      <View style={styles.weekHeader}>
        {WEEKDAYS.map((day, index) => (
          <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.muted }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => (
          <DayCell
            key={day}
            day={day}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            theme={theme}
            workoutMap={workoutMap}
          />
        ))}
      </View>
    </>
  );
}

function YearView({
  theme,
  onSelectMonth,
  workoutMap,
}: {
  theme: ForgeTheme;
  onSelectMonth: (month: number) => void;
  workoutMap: WorkoutMap;
}) {
  return (
    <View style={styles.yearGrid}>
      {MONTHS.map((month, index) => (
        <Pressable
          key={month}
          accessibilityRole="button"
          accessibilityLabel={`Show ${month} 2026`}
          onPress={() => onSelectMonth(index + 1)}
          style={styles.yearMonth}
        >
          <Text style={[styles.yearMonthTitle, { color: theme.slate }]}>{month.slice(0, 3)}</Text>
          <MiniMonth month={index + 1} theme={theme} workoutMap={workoutMap} />
        </Pressable>
      ))}
    </View>
  );
}

function MiniMonth({
  month,
  theme,
  workoutMap,
}: {
  month: number;
  theme: ForgeTheme;
  workoutMap: WorkoutMap;
}) {
  const leadingBlanks = (new Date(2026, month - 1, 1).getDay() + 6) % 7;
  const totalDays = new Date(2026, month, 0).getDate();
  return (
    <View style={styles.miniGrid}>
      {Array.from({ length: leadingBlanks }, (_, index) => (
        <View key={`blank-${index}`} style={styles.miniDay} />
      ))}
      {Array.from({ length: totalDays }, (_, index) => {
        const day = index + 1;
        const active = month === 8 && Boolean(workoutMap[day]);
        return (
          <View
            key={day}
            style={[styles.miniDay, { backgroundColor: active ? theme.marker : theme.divider }]}
          />
        );
      })}
    </View>
  );
}

function DayCell({
  day,
  selectedDay,
  setSelectedDay,
  theme,
  workoutMap,
}: {
  day: number;
  selectedDay: number;
  setSelectedDay: Dispatch<SetStateAction<number>>;
  theme: ForgeTheme;
  workoutMap: WorkoutMap;
}) {
  const dayWorkouts = workoutMap[day];
  const isSelected = day === selectedDay;
  const hasWorkout = Boolean(dayWorkouts);
  const selectionProgress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(selectionProgress, {
      toValue: isSelected ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isSelected, selectionProgress]);
  return (
    <Pressable
      testID={isSelected ? 'calendar-selected-day' : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${day} August 2026${hasWorkout ? ', workout recorded' : ''}`}
      accessibilityHint="Select this date"
      accessibilityState={{ selected: isSelected }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      pressRetentionOffset={{ top: 8, bottom: 8, left: 4, right: 4 }}
      android_ripple={{ color: 'rgba(31,41,50,0.08)' }}
      onPress={() => {
        triggerLightHaptic();
        setSelectedDay(day);
      }}
      style={({ pressed }) => [styles.dayCell, pressed && styles.pressed]}
    >
      <View style={styles.dateTouchTarget}>
        <Animated.View
          style={[
            styles.daySurface,
            { backgroundColor: theme.calendarDay || '#FFFFFF' },
            hasWorkout && {
              backgroundColor: 'rgba(31,41,50,0.07)',
              borderWidth: 1,
              borderColor: 'rgba(31,41,50,0.1)',
            },
            isSelected && { backgroundColor: theme.selected, borderWidth: 0, shadowOpacity: 0 },
            {
              transform: [
                {
                  scale: selectionProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.04],
                  }),
                },
              ],
            },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              isSelected && styles.selectedDayText,
              { color: isSelected ? theme.selectedText : theme.ink },
            ]}
          >
            {day}
          </Text>
          {hasWorkout && (
            <View style={styles.markers}>
              {dayWorkouts.slice(0, 2).map((workout, markerIndex) => (
                <View
                  key={markerIndex}
                  style={[
                    styles.marker,
                    {
                      backgroundColor: isSelected ? theme.selectedText : eventColor(workout, theme),
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

function eventColor(workout: WorkoutSummary, theme: ForgeTheme): string {
  if (workout.type === 'Strength') return theme.iconTime || theme.marker || theme.muted;
  if (workout.type === 'Court sport') return theme.marker || theme.muted;
  return theme.muted;
}

const styles = StyleSheet.create({
  calendar: {
    position: 'relative',
    overflow: 'visible',
    paddingTop: 16,
    paddingBottom: 12,
    borderRadius: 24,
    borderBottomWidth: 0,
  },
  calendarInner: { width: '100%', alignSelf: 'center' },
  compactCalendarInner: { maxWidth: 340 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  monthTitle: {
    fontFamily: typography.semibold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  weekHeader: { flexDirection: 'row', marginBottom: 7, paddingHorizontal: 6 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6 },
  dayCell: { width: '14.2857%', height: 46, alignItems: 'center', justifyContent: 'center' },
  dateTouchTarget: { width: '100%', height: 46, alignItems: 'center', justifyContent: 'center' },
  daySurface: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    position: 'relative',
  },
  dayText: { fontFamily: typography.regular, fontSize: 14, lineHeight: 18, fontWeight: '400' },
  selectedDayText: { fontFamily: typography.semibold, fontWeight: '600' },
  markers: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 3,
    height: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  marker: { width: 3, height: 3, flexShrink: 0, borderRadius: 1.5 },
  viewControl: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
  },
  viewControlText: { fontFamily: typography.medium, fontSize: 13 },
  viewMenu: {
    position: 'absolute',
    top: 54,
    right: 14,
    zIndex: 5,
    minWidth: 132,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#172431',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  viewMenuItem: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  viewMenuText: { fontFamily: typography.medium, fontSize: 13 },
  viewMenuCheck: { fontFamily: typography.bold, fontSize: 14 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 12 },
  yearMonth: { width: '31%', minHeight: 58, padding: 4 },
  yearMonthTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
  },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  miniDay: { width: 7, height: 7, borderRadius: 1.5 },
  pressed: { opacity: 0.72 },
});
