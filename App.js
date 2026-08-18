import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  useFonts,
} from '@expo-google-fonts/open-sans';

import { DashboardScreen } from './src/screens/DashboardScreen';

function getDashboardDirection() {
  if (typeof window === 'undefined' || !window.location) return 'ink';
  const direction = new URLSearchParams(window.location.search).get('direction');
  return ['ink', 'studio', 'signal'].includes(direction) ? direction : 'ink';
}

export default function App() {
  const [fontsLoaded] = useFonts({
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <DashboardScreen direction={getDashboardDirection()} />
    </SafeAreaProvider>
  );
}
