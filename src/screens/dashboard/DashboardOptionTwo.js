import React, { useState } from 'react';

import { DashboardCalendar, DashboardContextCard, DashboardScroll, DashboardShell, DashboardWorkoutCard } from './DashboardParts';
import { workoutsByDate } from '../../data/mockWorkouts';
import { dashboardTheme } from '../../theme/dashboardTheme';

export function DashboardOptionTwo() {
  const [selectedDay, setSelectedDay] = useState(24);
  return (
    <DashboardShell theme={dashboardTheme}>
      <DashboardScroll style={{ gap: 10 }}>
        <DashboardCalendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={dashboardTheme} style={{ borderRadius: 12 }} />
        <DashboardWorkoutCard selectedDay={selectedDay} selectedWorkouts={workoutsByDate[selectedDay] || []} theme={dashboardTheme} compact rail />
        <DashboardContextCard theme={dashboardTheme} inline />
      </DashboardScroll>
    </DashboardShell>
  );
}
