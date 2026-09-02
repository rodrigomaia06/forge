import React from 'react';
import { useRoute } from '@react-navigation/native';

import { DashboardOptionThree } from './dashboard/DashboardOptionThree';
import type { RootTabParamList } from '../types';
import type { RouteProp } from '@react-navigation/native';

export function DashboardScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Dashboard'>>();
  return <DashboardOptionThree route={route} />;
}
