import React from 'react';

import { DashboardOptionOne } from './dashboard/DashboardOptionOne';
import { DashboardOptionThree } from './dashboard/DashboardOptionThree';
import { DashboardOptionTwo } from './dashboard/DashboardOptionTwo';

export function DashboardScreen({ option = 1 }) {
  if (option === 2) return <DashboardOptionTwo />;
  if (option === 3) return <DashboardOptionThree />;
  return <DashboardOptionOne />;
}
