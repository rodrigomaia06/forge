import React, { useState } from 'react';

import { DashboardCalendar, DashboardScroll, DashboardShell, DashboardWorkoutCard } from './DashboardParts';
import { workoutsByDate } from '../../data/mockWorkouts';
import { dashboardTheme } from '../../theme/dashboardTheme';

export function DashboardOptionThree() {
  const [selectedDay, setSelectedDay] = useState(24);
  return (
    <DashboardShell theme={dashboardTheme}>
      <DashboardScroll style={{ gap: 16 }}>
        <DashboardCalendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={dashboardTheme} style={{ borderRadius: 22 }} />
        <DashboardWorkoutCard selectedDay={selectedDay} selectedWorkouts={workoutsByDate[selectedDay] || []} theme={dashboardTheme} icon />
      </DashboardScroll>
    </DashboardShell>
  );
}
