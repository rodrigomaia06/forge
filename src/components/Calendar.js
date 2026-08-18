import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { monthDays, workoutsByDate } from '../data/mockWorkouts';
import { colors, typography } from '../theme/tokens';
import { Icon } from './ui';

const VIEWS = ['year', 'month', 'week'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Calendar({ selectedDay, setSelectedDay, theme = colors }) {
  const [view, setView] = useState('month');
  const [menuOpen, setMenuOpen] = useState(false);
  const [month, setMonth] = useState(8);
  const title = view === 'year' ? 'Activity 2026' : view === 'week' ? 'Week of August 24' : `${MONTHS[month - 1]} 2026`;

  const selectView = (nextView) => {
    setView(nextView);
    setMenuOpen(false);
  };

  return (
    <View style={[styles.calendar, { backgroundColor: theme.calendarSurface || '#F2F2F2', borderRadius: theme.cardRadius || 20 }]}>
      <View style={styles.header}>
        <Text style={[styles.monthTitle, { color: theme.ink }]}>{title}</Text>
        <Pressable testID="calendar-view-menu-button" accessibilityRole="button" accessibilityLabel="Change calendar view" onPress={() => setMenuOpen((open) => !open)} style={styles.viewControl}>
          <Text style={[styles.viewControlText, { color: theme.ink }]}>{view === 'year' ? 'This Year' : view === 'week' ? 'This Week' : 'This Month'}</Text>
          <Icon name="chevron-down" size={15} color={theme.slate} />
        </Pressable>
      </View>
      {menuOpen && <CalendarViewMenu view={view} theme={theme} onSelect={selectView} />}
      <CalendarContent view={view} selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} month={month} setMonth={setMonth} />
    </View>
  );
}

function CalendarViewMenu({ view, theme, onSelect }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [progress]);
  return <Animated.View style={[styles.viewMenu, { backgroundColor: theme.surface, borderColor: theme.divider, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }]}>{VIEWS.map((item) => <Pressable key={item} accessibilityRole="menuitem" onPress={() => onSelect(item)} style={[styles.viewMenuItem, item === view && { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.viewMenuText, { color: theme.ink }]}>{item[0].toUpperCase() + item.slice(1)}</Text>{item === view && <Text style={[styles.viewMenuCheck, { color: theme.marker }]}>✓</Text>}</Pressable>)}</Animated.View>;
}

function CalendarContent({ view, selectedDay, setSelectedDay, theme, month, setMonth }) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [view, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }}>{view === 'year' && <YearView theme={theme} onSelectMonth={(selectedMonth) => { setMonth(selectedMonth); }} />}{view === 'month' && <MonthView selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} month={month} />}{view === 'week' && <WeekView selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} />}</Animated.View>;
}

function MonthView({ selectedDay, setSelectedDay, theme, month }) {
  const leadingBlanks = month === 8 ? 5 : 0;
  return <><View style={styles.weekHeader}>{WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.muted }]}>{day}</Text>)}</View><View style={styles.grid}>{Array.from({ length: leadingBlanks }, (_, index) => <View key={`blank-${index}`} style={styles.dayCell} />)}{monthDays.map((day) => <DayCell key={day} day={day} selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} />)}</View></>;
}

function WeekView({ selectedDay, setSelectedDay, theme }) {
  const days = [24, 25, 26, 27, 28, 29, 30];
  return <><View style={styles.weekHeader}>{WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.muted }]}>{day}</Text>)}</View><View style={styles.grid}>{days.map((day) => <DayCell key={day} day={day} selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} />)}</View></>;
}

function YearView({ theme, onSelectMonth }) {
  return <View style={styles.yearGrid}>{MONTHS.map((month, index) => <Pressable key={month} accessibilityRole="button" accessibilityLabel={`Show ${month} 2026`} onPress={() => onSelectMonth(index + 1)} style={styles.yearMonth}><Text style={[styles.yearMonthTitle, { color: theme.slate }]}>{month.slice(0, 3)}</Text><MiniMonth month={index + 1} theme={theme} /></Pressable>)}</View>;
}

function MiniMonth({ month, theme }) {
  const leadingBlanks = (new Date(2026, month - 1, 1).getDay() + 6) % 7;
  const totalDays = new Date(2026, month, 0).getDate();
  return <View style={styles.miniGrid}>{Array.from({ length: leadingBlanks }, (_, index) => <View key={`blank-${index}`} style={styles.miniDay} />)}{Array.from({ length: totalDays }, (_, index) => { const day = index + 1; const active = month === 8 && Boolean(workoutsByDate[day]); return <View key={day} style={[styles.miniDay, { backgroundColor: active ? theme.marker : theme.divider }]} />; })}</View>;
}

function DayCell({ day, selectedDay, setSelectedDay, theme }) {
  const dayWorkouts = workoutsByDate[day];
  const isSelected = day === selectedDay;
  const hasWorkout = Boolean(dayWorkouts);
  return <Pressable testID={isSelected ? 'calendar-selected-day' : undefined} accessibilityRole="button" accessibilityLabel={`${day} August 2026${hasWorkout ? ', workout recorded' : ''}`} accessibilityState={{ selected: isSelected }} onPress={() => setSelectedDay(day)} style={({ pressed }) => [styles.dayCell, pressed && styles.pressed]}><View style={[styles.daySurface, { backgroundColor: theme.calendarDay || '#FFFFFF' }, hasWorkout && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' }, isSelected && { backgroundColor: theme.selected, borderWidth: 0, shadowOpacity: 0 }]}><Text style={[styles.dayText, { color: isSelected ? theme.selectedText : theme.ink }]}>{day}</Text>{hasWorkout && <View style={styles.markers}>{dayWorkouts.slice(0, 2).map((workout, markerIndex) => <View key={markerIndex} style={[styles.marker, { backgroundColor: isSelected ? theme.selectedText : eventColor(workout, theme) }]} />)}</View>}</View></Pressable>;
}

function eventColor(workout, theme) {
  if (workout.type === 'Strength') return theme.iconTime || theme.marker;
  if (workout.type === 'Court sport') return theme.marker;
  return theme.muted;
}

const styles = StyleSheet.create({
  calendar: { position: 'relative', overflow: 'hidden', paddingTop: 14, paddingBottom: 10, borderBottomWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  monthTitle: { fontFamily: typography.semibold, fontSize: 16, fontWeight: '600', letterSpacing: -0.15 },
  weekHeader: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontFamily: typography.medium, fontSize: 11, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 39, alignItems: 'center', justifyContent: 'center' },
  daySurface: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, position: 'relative', shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  dayText: { fontFamily: typography.medium, fontSize: 12, fontWeight: '500' },
  markers: { position: 'absolute', bottom: 3, flexDirection: 'row', gap: 2 },
  marker: { width: 3, height: 3, borderRadius: 2 },
  viewControl: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 2 },
  viewControlText: { fontFamily: typography.medium, fontSize: 13 },
  viewMenu: { position: 'absolute', top: 54, right: 14, zIndex: 5, minWidth: 132, borderWidth: 1, borderRadius: 12, padding: 4, shadowColor: '#172431', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 4 },
  viewMenuItem: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 8 },
  viewMenuText: { fontFamily: typography.medium, fontSize: 13 },
  viewMenuCheck: { fontFamily: typography.bold, fontSize: 14 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  yearMonth: { width: '23%', minHeight: 58, padding: 4 },
  yearMonthTitle: { fontFamily: typography.semibold, fontSize: 13, fontWeight: '600', marginBottom: 7 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  miniDay: { width: 7, height: 7, borderRadius: 1.5 },
  pressed: { opacity: 0.65 },
});
