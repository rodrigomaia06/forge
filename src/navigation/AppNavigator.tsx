import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableFreeze } from 'react-native-screens';
import { WorkoutDetailsScreen } from '../screens/WorkoutDetailsScreen';
import { HistoryWorkoutEditorScreen } from '../screens/HistoryWorkoutEditorScreen';
import { RoutineEditorScreen } from '../screens/RoutineEditorScreen';
import { GeneralSettingsScreen } from '../screens/settings/GeneralSettingsScreen';
import { DailyMeasurementsScreen } from '../screens/settings/DailyMeasurementsScreen';
import { SettingsDestinationScreen } from '../screens/settings/SettingsDestinationScreen';
import { ImportSelectionScreen } from '../screens/settings/ImportSelectionScreen';
import { ImportConflictScreen } from '../screens/settings/ImportConflictScreen';
import { WorkoutTypesScreen } from '../screens/settings/WorkoutTypesScreen';
import { WorkoutTypeEditorScreen } from '../screens/settings/WorkoutTypeEditorScreen';
import { WorkoutTypeUsageScreen } from '../screens/settings/WorkoutTypeUsageScreen';
import { ExerciseLibraryScreen } from '../screens/settings/ExerciseLibraryScreen';
import { ExerciseBrowserScreen } from '../screens/settings/ExerciseBrowserScreen';
import { MuscleHeatmapDetailScreen } from '../screens/MuscleHeatmapDetailScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { useWorkouts } from '../state/WorkoutContext';
import { ForgeLoadingScreen } from '../components/ForgeLoadingScreen';
import { useForgeTheme } from '../theme/ThemeProvider';
import { forgeMotion, useForgeReducedMotion } from '../theme/motion';
import type { RootStackParamList } from '../types';
import { MainTabNavigator } from './MainTabNavigator';
import { useForgeFileOpen } from './useForgeFileOpen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['forge://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          ActiveWorkout: 'rest-timer/:openRestTimer',
        },
      },
    },
  },
};

enableFreeze(true);

export function AppNavigator() {
  const { ready } = useWorkouts();
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  // Route a `.forge` file the OS asked Forge to open into the existing import
  // flow. `onReady` handles the cold-launch initial URL; the hook also listens
  // for warm opens while the app is running.
  const { onReady: handleFileOpenReady } = useForgeFileOpen(navigationRef);
  const navigationTheme = useMemo(
    () => {
      const base = theme.colorScheme === 'dark' ? DarkTheme : DefaultTheme;
      return {
        ...base,
        colors: {
          ...base.colors,
          primary: theme.selectionIndicator,
          background: theme.background,
          card: theme.background,
          text: theme.textPrimary,
          border: theme.border,
        },
      };
    },
    [theme],
  );

  // Keep the Forge splash up through data hydration rather than flashing an
  // empty root. The app pays the warmup cost once here, up front, so navigation
  // is fast for the rest of the session.
  if (!ready) return <ForgeLoadingScreen />;

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={navigationTheme} onReady={handleFileOpenReady}>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: false,
          animation: reducedMotion ? 'fade' : 'slide_from_right',
          animationDuration: forgeMotion.transition,
          freezeOnBlur: true,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ gestureEnabled: false }} />
        <Stack.Screen name="WorkoutDetails" component={WorkoutDetailsScreen} options={{ gestureEnabled: true }} />
        <Stack.Screen
          name="HistoryWorkoutEditor"
          component={HistoryWorkoutEditorScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="RoutineEditor"
          component={RoutineEditorScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="GeneralSettings"
          component={GeneralSettingsScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="DailyMeasurements"
          component={DailyMeasurementsScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="ExerciseLibrary"
          component={ExerciseLibraryScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="ExerciseBrowser"
          component={ExerciseBrowserScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="WorkoutTypes"
          component={WorkoutTypesScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="WorkoutTypeEditor"
          component={WorkoutTypeEditorScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="WorkoutTypeUsage"
          component={WorkoutTypeUsageScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="BackupExport"
          component={SettingsDestinationScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="ImportSelection"
          component={ImportSelectionScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="ImportConflict"
          component={ImportConflictScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="Logs"
          component={SettingsDestinationScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="About"
          component={SettingsDestinationScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="MuscleHeatmapDetail"
          component={MuscleHeatmapDetailScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{ gestureEnabled: true }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
