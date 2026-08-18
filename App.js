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

function getDashboardOption() {
  if (typeof window === 'undefined' || !window.location) return 3;
  const option = Number(new URLSearchParams(window.location.search).get('option'));
  return [1, 2, 3].includes(option) ? option : 3;
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
      <DashboardScreen option={getDashboardOption()} />
    </SafeAreaProvider>
  );
}
