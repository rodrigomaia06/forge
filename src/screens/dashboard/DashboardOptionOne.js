import React, { useState } from 'react';

import { DashboardCalendar, DashboardContextCard, DashboardScroll, DashboardShell, DashboardWorkoutCard } from './DashboardParts';
import { workoutsByDate } from '../../data/mockWorkouts';
import { dashboardTheme } from '../../theme/dashboardTheme';

export function DashboardOptionOne() {
  const [selectedDay, setSelectedDay] = useState(24);
  return (
    <DashboardShell theme={dashboardTheme} floatingDock>
      <DashboardScroll>
        <DashboardCalendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={dashboardTheme} />
        <DashboardWorkoutCard selectedDay={selectedDay} selectedWorkouts={workoutsByDate[selectedDay] || []} theme={dashboardTheme} />
        <DashboardContextCard theme={dashboardTheme} />
      </DashboardScroll>
    </DashboardShell>
  );
}
