import React from 'react';
import { useRoute } from '@react-navigation/native';

import { DashboardOptionThree } from './dashboard/DashboardOptionThree';

export function DashboardScreen() {
  const route = useRoute();
  return <DashboardOptionThree route={route} />;
}
