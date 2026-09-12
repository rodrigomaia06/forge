import React, { useEffect, useMemo, useState } from 'react';

import {
  DashboardCalendar,
  DashboardContextCard,
  DashboardScroll,
  DashboardShell,
  DashboardWorkoutCard,
} from './DashboardParts';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useWorkouts } from '../../state/WorkoutContext';
import type { RouteProp } from '@react-navigation/native';
import type { RootTabParamList, WorkoutMap } from '../../types';
import type { CalendarMenuState } from '../../components/Calendar';
import { calendarDateKey, parseCalendarDate } from '../../domain/workouts/calendarDate';

const DEFAULT_SELECTED_DATE = new Date(2026, 7, 24);

export function DashboardOptionThree({
  route,
}: {
  route: RouteProp<RootTabParamList, 'Dashboard'>;
}) {
  const { completedWorkouts } = useWorkouts();
  const theme = useForgeTheme();
  const [selectedDate, setSelectedDate] = useState(() => parseCalendarDate(route?.params?.selectedDate, DEFAULT_SELECTED_DATE));
  const [calendarMenu, setCalendarMenu] = useState<CalendarMenuState | null>(null);
  useEffect(() => {
    if (route?.params?.selectedDate) setSelectedDate(parseCalendarDate(route.params.selectedDate, DEFAULT_SELECTED_DATE));
  }, [route?.params?.selectedDate]);
  const workoutMap = useMemo(() => {
    const map: WorkoutMap = {};
    completedWorkouts.forEach((workout) => {
      const date = calendarDateKey(workout.completedAt || workout.startedAt);
      map[date] = [...(map[date] || []), workout];
    });
    return map;
  }, [completedWorkouts]);
  return (
    <DashboardShell
      theme={theme}
      calendarMenu={calendarMenu}
      onCalendarMenuDismiss={() => setCalendarMenu(null)}
    >
      <DashboardScroll style={{ gap: 16 }}>
        <DashboardCalendar
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          theme={theme}
          workoutMap={workoutMap}
          viewMenuOpen={Boolean(calendarMenu)}
          onViewMenuOpenChange={(open) => {
            if (!open) setCalendarMenu(null);
          }}
          onMenuStateChange={setCalendarMenu}
        />
        <DashboardWorkoutCard
          selectedDate={selectedDate}
          selectedWorkouts={workoutMap[calendarDateKey(selectedDate)] || []}
          theme={theme}
        />
        <DashboardContextCard theme={theme} icons compact />
      </DashboardScroll>
    </DashboardShell>
  );
}
