import React from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// react-native-draggable-flatlist's Nestable lists log this benign warning from
// their own layout measurement (the plan/routine reorder still works); silence
// just that message so it doesn't flood the console in edit mode.
LogBox.ignoreLogs([/measureLayout must be called with a ref to a native component/]);
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';

import { AppNavigator } from './src/navigation/AppNavigator';
import { WorkoutProvider } from './src/state/WorkoutContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { PlansProvider } from './src/state/PlansContext';
import { ForgeThemeProvider, useForgeTheme } from './src/theme/ThemeProvider';
import { ExerciseCatalogProvider } from './src/state/ExerciseCatalogContext';
import { ForgeLoadingScreen } from './src/components/ForgeLoadingScreen';
import { RestTimerProvider } from './src/state/RestTimerContext';

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  if (!fontsLoaded) return <ForgeLoadingScreen />;

  return (
    <SettingsProvider>
      <ForgeThemeProvider>
        <ThemedApp />
      </ForgeThemeProvider>
    </SettingsProvider>
  );
}

function ThemedApp() {
  const theme = useForgeTheme();
  const rootStyle = { flex: 1, backgroundColor: theme.background };

  return (
    <GestureHandlerRootView testID="app-root" style={rootStyle}>
      <SafeAreaProvider style={rootStyle}>
        <ExerciseCatalogProvider><PlansProvider><WorkoutProvider><RestTimerProvider><AppNavigator /></RestTimerProvider></WorkoutProvider></PlansProvider></ExerciseCatalogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
