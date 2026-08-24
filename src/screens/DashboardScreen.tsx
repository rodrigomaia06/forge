import React from 'react';
import { useRoute } from '@react-navigation/native';

import { DashboardOptionThree } from './dashboard/DashboardOptionThree';
import type { RootStackParamList } from '../types';
import type { RouteProp } from '@react-navigation/native';

export function DashboardScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Dashboard'>>();
  return <DashboardOptionThree route={route} />;
}
