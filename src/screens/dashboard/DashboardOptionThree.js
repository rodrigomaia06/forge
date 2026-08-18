import React, { useState } from 'react';

import { DashboardCalendar, DashboardContextCard, DashboardScroll, DashboardShell, DashboardTodaySection, DashboardWorkoutCard } from './DashboardParts';
import { workoutsByDate } from '../../data/mockWorkouts';
import { dashboardTheme } from '../../theme/dashboardTheme';

export function DashboardOptionThree() {
  const [selectedDay, setSelectedDay] = useState(24);
  return (
    <DashboardShell theme={dashboardTheme}>
      <DashboardScroll style={{ gap: 16 }}>
        <DashboardCalendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={dashboardTheme} style={{ borderRadius: 22 }} />
        <DashboardTodaySection count={(workoutsByDate[selectedDay] || []).length} theme={dashboardTheme} />
        <DashboardWorkoutCard selectedDay={selectedDay} selectedWorkouts={workoutsByDate[selectedDay] || []} theme={dashboardTheme} icon />
        <DashboardContextCard theme={dashboardTheme} icons compact />
      </DashboardScroll>
    </DashboardShell>
  );
}
