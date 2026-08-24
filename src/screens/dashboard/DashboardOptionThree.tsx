import React, { useEffect, useMemo, useState } from 'react';

import {
  DashboardCalendar,
  DashboardContextCard,
  DashboardScroll,
  DashboardShell,
  DashboardWorkoutCard,
} from './DashboardParts';
import { workoutsByDate } from '../../data/mockWorkouts';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useWorkouts } from '../../state/WorkoutContext';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../types';
import type { CalendarMenuState } from '../../components/Calendar';

export function DashboardOptionThree({
  route,
}: {
  route: RouteProp<RootStackParamList, 'Dashboard'>;
}) {
  const { completedWorkouts } = useWorkouts();
  const [selectedDay, setSelectedDay] = useState(route?.params?.selectedDay || 24);
  const [calendarMenu, setCalendarMenu] = useState<CalendarMenuState | null>(null);
  useEffect(() => {
    if (route?.params?.selectedDay) setSelectedDay(route.params.selectedDay);
  }, [route?.params?.selectedDay]);
  const workoutMap = useMemo(() => {
    const map = { ...workoutsByDate };
    completedWorkouts.forEach((workout) => {
      const day = new Date(workout.completedAt || workout.startedAt).getDate();
      map[day] = [...(map[day] || []), workout];
    });
    return map;
  }, [completedWorkouts]);
  return (
    <DashboardShell
      theme={dashboardTheme}
      calendarMenu={calendarMenu}
      onCalendarMenuDismiss={() => setCalendarMenu(null)}
    >
      <DashboardScroll style={{ gap: 16 }}>
        <DashboardCalendar
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          theme={dashboardTheme}
          workoutMap={workoutMap}
          viewMenuOpen={Boolean(calendarMenu)}
          onViewMenuOpenChange={(open) => {
            if (!open) setCalendarMenu(null);
          }}
          onMenuStateChange={setCalendarMenu}
        />
        <DashboardWorkoutCard
          selectedDay={selectedDay}
          selectedWorkouts={workoutMap[selectedDay] || []}
          theme={dashboardTheme}
        />
        <DashboardContextCard theme={dashboardTheme} icons compact />
      </DashboardScroll>
    </DashboardShell>
  );
}
