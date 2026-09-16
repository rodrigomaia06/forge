import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../theme/motion';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import { ForgeText as Text, Icon, lightHaptic, pressedFeedback, pressedFeedbackSubtle } from './ui';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ForgeTheme, WeekStartsOn, WorkoutMap, WorkoutTypePreference } from '../types';
import { styles } from './calendar/calendarStyles';

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
const MONDAY_FIRST_WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SUNDAY_FIRST_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarProps {
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  theme?: ForgeTheme;
  workoutMap?: WorkoutMap;
  viewMenuOpen?: boolean;
  onViewMenuOpenChange?: (open: boolean) => void;
  onMenuStateChange?: (state: CalendarMenuState | null) => void;
  weekStartsOn?: WeekStartsOn;
  workoutTypes?: WorkoutTypePreference[];
}

export interface CalendarMenuState {
  top: number;
  right: number;
  content: ReactNode;
}
export function Calendar({
  selectedDate,
  setSelectedDate,
  theme = colors,
  workoutMap = {},
  viewMenuOpen,
  onViewMenuOpenChange,
  onMenuStateChange,
  weekStartsOn = 1,
  workoutTypes = [],
}: CalendarProps) {
  const [view, setView] = useState<CalendarView>('month');
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const menuOpen = viewMenuOpen ?? localMenuOpen;
  const isFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const viewControlRef = useRef<View>(null);
  const [month, setMonth] = useState(() => selectedDate.getMonth() + 1);
  useEffect(() => setMonth(selectedDate.getMonth() + 1), [selectedDate]);
  const setMenuOpen = (next: boolean | ((current: boolean) => boolean)): void => {
    const open = typeof next === 'function' ? next(menuOpen) : next;
    setLocalMenuOpen(open);
    onViewMenuOpenChange?.(open);
    if (!open) onMenuStateChange?.(null);
  };

  useEffect(() => {
    if (!isFocused) setMenuOpen(false);
  }, [isFocused]);

  const toggleMenu = (): void => {
    triggerLightHaptic();
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    viewControlRef.current?.measureInWindow((x, y, width, height) => {
      setMenuOpen(true);
      onMenuStateChange?.({
        top: y + height + 6 - insets.top,
        right: windowWidth - x - width,
        content: (
          <CalendarViewMenu
            view={view}
            theme={theme}
            onSelect={selectView}
            style={{ position: 'relative', top: 0, right: 0 }}
          />
        ),
      });
    });
  };
  const title =
    view === 'year'
      ? `Activity ${selectedDate.getFullYear()}`
      : view === 'week'
        ? `Week of ${selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`
        : `${MONTHS[month - 1]} ${selectedDate.getFullYear()}`;

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
            ref={viewControlRef}
            testID="calendar-view-menu-button"
            accessibilityRole="button"
            accessibilityLabel="Change calendar view"
            onPress={toggleMenu}
            style={({ pressed }) => [styles.viewControl, pressed && pressedFeedback]}
          >
            <Text style={[styles.viewControlText, { color: theme.ink }]}>
              {view === 'year' ? 'This Year' : view === 'week' ? 'This Week' : 'This Month'}
            </Text>
            <Icon name="chevron-down" size={15} color={theme.slate} />
          </Pressable>
        </View>
        <CalendarContent
          view={view}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          theme={theme}
          month={month}
          setMonth={setMonth}
          workoutMap={workoutMap}
          workoutTypes={workoutTypes}
          weekStartsOn={weekStartsOn}
        />
      </View>
    </View>
  );
}

function CalendarViewMenu({
  view,
  theme,
  onSelect,
  style,
}: {
  view: CalendarView;
  theme: ForgeTheme;
  onSelect: (view: CalendarView) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useForgeReducedMotion();
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: forgeMotionDuration(reducedMotion, forgeMotion.state),
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress, reducedMotion]);
  return (
    <Animated.View
      style={[
        styles.viewMenu,
        style,
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
          style={({ pressed }) => [
            styles.viewMenuItem,
            item === view && { backgroundColor: theme.surfaceMuted },
            pressed && pressedFeedback,
          ]}
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
  lightHaptic();
}

function CalendarContent({
  view,
  selectedDate,
  setSelectedDate,
  theme,
  month,
  setMonth,
  workoutMap,
  workoutTypes,
  weekStartsOn,
}: {
  view: CalendarView;
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  theme: ForgeTheme;
  month: number;
  setMonth: Dispatch<SetStateAction<number>>;
  workoutMap: WorkoutMap;
  workoutTypes: WorkoutTypePreference[];
  weekStartsOn: WeekStartsOn;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const reducedMotion = useForgeReducedMotion();
  useEffect(() => {
    progress.setValue(reducedMotion ? 1 : 0);
    Animated.timing(progress, {
      toValue: 1,
      duration: forgeMotionDuration(reducedMotion, forgeMotion.transition),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [view, progress, reducedMotion]);
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
            triggerLightHaptic();
            setMonth(selectedMonth);
            setSelectedDate((current) => new Date(
              current.getFullYear(),
              selectedMonth - 1,
              Math.min(current.getDate(), new Date(current.getFullYear(), selectedMonth, 0).getDate()),
            ));
          }}
          workoutMap={workoutMap}
          weekStartsOn={weekStartsOn}
          year={selectedDate.getFullYear()}
        />
      )}
      {view === 'month' && (
        <MonthView
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          theme={theme}
          month={month}
          workoutMap={workoutMap}
          workoutTypes={workoutTypes}
          weekStartsOn={weekStartsOn}
        />
      )}
      {view === 'week' && (
        <WeekView
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          theme={theme}
          workoutMap={workoutMap}
          workoutTypes={workoutTypes}
          weekStartsOn={weekStartsOn}
        />
      )}
    </Animated.View>
  );
}

function MonthView({
  selectedDate,
  setSelectedDate,
  theme,
  month,
  workoutMap,
  workoutTypes,
  weekStartsOn,
}: Omit<Parameters<typeof CalendarContent>[0], 'view' | 'setMonth'>) {
  const weekdays = weekStartsOn === 1 ? MONDAY_FIRST_WEEKDAYS : SUNDAY_FIRST_WEEKDAYS;
  const year = selectedDate.getFullYear();
  const leadingBlanks = leadingDaysForMonth(year, month, weekStartsOn);
  const totalDays = new Date(year, month, 0).getDate();
  return (
    <>
      <View testID="calendar-weekdays" style={styles.weekHeader}>
        {weekdays.map((day, index) => (
          <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.muted }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <View key={`blank-${index}`} style={styles.dayCell} />
        ))}
        {Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => (
          <DayCell
            key={`${year}-${month}-${day}`}
            date={new Date(year, month - 1, day)}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            theme={theme}
            workoutMap={workoutMap}
            workoutTypes={workoutTypes}
          />
        ))}
      </View>
    </>
  );
}

function WeekView({
  selectedDate,
  setSelectedDate,
  theme,
  workoutMap,
  workoutTypes,
  weekStartsOn,
}: Omit<Parameters<typeof CalendarContent>[0], 'view' | 'month' | 'setMonth'>) {
  const days = weekDates(selectedDate, weekStartsOn);
  const weekdays = weekStartsOn === 1 ? MONDAY_FIRST_WEEKDAYS : SUNDAY_FIRST_WEEKDAYS;
  return (
    <>
      <View testID="calendar-weekdays" style={styles.weekHeader}>
        {weekdays.map((day, index) => (
          <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.muted }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((date) => (
          <DayCell
            key={calendarDateKey(date)}
            date={date}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            theme={theme}
            workoutMap={workoutMap}
            workoutTypes={workoutTypes}
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
  weekStartsOn,
  year,
}: {
  theme: ForgeTheme;
  onSelectMonth: (month: number) => void;
  workoutMap: WorkoutMap;
  weekStartsOn: WeekStartsOn;
  year: number;
}) {
  return (
    <View style={styles.yearGrid}>
      {MONTHS.map((month, index) => (
        <Pressable
          key={month}
          accessibilityRole="button"
          accessibilityLabel={`Show ${month} ${year}`}
          onPress={() => onSelectMonth(index + 1)}
          style={({ pressed }) => [styles.yearMonth, pressed && pressedFeedbackSubtle]}
        >
          <Text style={[styles.yearMonthTitle, { color: theme.slate }]}>{month.slice(0, 3)}</Text>
          <MiniMonth
            month={index + 1}
            year={year}
            theme={theme}
            workoutMap={workoutMap}
            weekStartsOn={weekStartsOn}
          />
        </Pressable>
      ))}
    </View>
  );
}

function MiniMonth({
  month,
  year,
  theme,
  workoutMap,
  weekStartsOn,
}: {
  month: number;
  year: number;
  theme: ForgeTheme;
  workoutMap: WorkoutMap;
  weekStartsOn: WeekStartsOn;
}) {
  const leadingBlanks = leadingDaysForMonth(year, month, weekStartsOn);
  const totalDays = new Date(year, month, 0).getDate();
  return (
    <View style={styles.miniGrid}>
      {Array.from({ length: leadingBlanks }, (_, index) => (
        <View key={`blank-${index}`} style={styles.miniDay} />
      ))}
      {Array.from({ length: totalDays }, (_, index) => {
        const day = index + 1;
        const active = Boolean(workoutMap[calendarDateKey(new Date(year, month - 1, day))]);
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
  date,
  selectedDate,
  setSelectedDate,
  theme,
  workoutMap,
  workoutTypes,
}: {
  date: Date;
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  theme: ForgeTheme;
  workoutMap: WorkoutMap;
  workoutTypes: WorkoutTypePreference[];
}) {
  const dayWorkouts = workoutMap[calendarDateKey(date)];
  const isSelected = sameCalendarDay(date, selectedDate);
  const hasWorkout = Boolean(dayWorkouts);
  const selectionProgress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const reducedMotion = useForgeReducedMotion();
  useEffect(() => {
    Animated.timing(selectionProgress, {
      toValue: isSelected ? 1 : 0,
      duration: forgeMotionDuration(reducedMotion, forgeMotion.state),
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isSelected, reducedMotion, selectionProgress]);
  return (
    <Pressable
      testID={isSelected ? 'calendar-selected-day' : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${date.getDate()} ${date.toLocaleDateString(undefined, { month: 'long' })} ${date.getFullYear()}${hasWorkout ? ', workout recorded' : ''}`}
      accessibilityHint="Select this date"
      accessibilityState={{ selected: isSelected }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      pressRetentionOffset={{ top: 8, bottom: 8, left: 4, right: 4 }}
      android_ripple={{ color: 'rgba(31,41,50,0.08)' }}
      onPress={() => {
        triggerLightHaptic();
        setSelectedDate(new Date(date));
      }}
      style={({ pressed }) => [styles.dayCell, pressed && styles.pressed]}
    >
      <View style={styles.dateTouchTarget}>
        <Animated.View
          testID={isSelected ? 'calendar-selected-ring' : undefined}
          style={[
            styles.selectionRing,
            styles.pointerEventsNone,
            { borderColor: theme.calendarSelectionRing ?? theme.selectionIndicator },
            {
              opacity: selectionProgress,
              transform: [
                {
                  scale: selectionProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.86, 1],
                  }),
                },
              ],
            },
          ]}
        />
        <View
          style={[
            styles.daySurface,
            { backgroundColor: theme.calendarDay },
            hasWorkout && {
              backgroundColor: theme.calendarWorkoutDay,
              borderWidth: 1,
              borderColor: theme.calendarWorkoutBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              isSelected && styles.selectedDayText,
              { color: theme.ink },
            ]}
          >
            {date.getDate()}
          </Text>
          {hasWorkout && (
            <View style={styles.markers}>
              {dayWorkouts.slice(0, 2).map((workout, markerIndex) => (
                <View
                  key={markerIndex}
                  testID={`calendar-marker-${date.getDate()}-${markerIndex}`}
                  style={[
                    styles.marker,
                    {
                      backgroundColor: getWorkoutTypePresentation(
                        workout.type,
                        workoutTypes,
                        theme,
                        1,
                      ).color,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function leadingDaysForMonth(year: number, month: number, weekStartsOn: WeekStartsOn): number {
  const sundayFirstDay = new Date(year, month - 1, 1).getDay();
  return weekStartsOn === 1 ? (sundayFirstDay + 6) % 7 : sundayFirstDay;
}

function weekDates(selectedDate: Date, weekStartsOn: WeekStartsOn): Date[] {
  const start = new Date(selectedDate);
  const offset = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - offset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return calendarDateKey(left) === calendarDateKey(right);
}
