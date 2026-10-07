import React, { useEffect } from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { embeddedFontsReady } from './src/theme/fonts';
import { refreshDateFormatters } from './src/utils/dateFormatters';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
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
  const [fontsLoaded] = useFonts(
    embeddedFontsReady
      ? {}
      : {
          Manrope_400Regular,
          Manrope_500Medium,
          Manrope_600SemiBold,
          Manrope_700Bold,
        },
  );

  useEffect(() => {
    // RN Web's virtualized lists queue work through InteractionManager. A bounded
    // timer budget prevents idle callbacks from starving after continuous gestures.
    if (Platform.OS === 'web') InteractionManager.setDeadline(8);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshDateFormatters();
    });
    if (Platform.OS === 'web') window.addEventListener('languagechange', refreshDateFormatters);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web')
        window.removeEventListener('languagechange', refreshDateFormatters);
    };
  }, []);

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
        <ExerciseCatalogProvider>
          <PlansProvider>
            <WorkoutProvider>
              <RestTimerProvider>
                <AppNavigator />
              </RestTimerProvider>
            </WorkoutProvider>
          </PlansProvider>
        </ExerciseCatalogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
