import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DashboardScreen } from './src/screens/DashboardScreen';

function getDashboardDirection() {
  if (typeof window === 'undefined') return 'ink';
  const direction = new URLSearchParams(window.location.search).get('direction');
  return ['ink', 'studio', 'signal'].includes(direction) ? direction : 'ink';
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DashboardScreen direction={getDashboardDirection()} />
    </SafeAreaProvider>
  );
}
