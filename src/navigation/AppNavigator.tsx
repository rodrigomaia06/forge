import React, { useMemo } from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableFreeze } from 'react-native-screens';
import { WorkoutDetailsScreen } from '../screens/WorkoutDetailsScreen';
import { HistoryWorkoutEditorScreen } from '../screens/HistoryWorkoutEditorScreen';
import { RoutineEditorScreen } from '../screens/RoutineEditorScreen';
import { GeneralSettingsScreen } from '../screens/settings/GeneralSettingsScreen';
import { SettingsDestinationScreen } from '../screens/settings/SettingsDestinationScreen';
import { WorkoutTypesScreen } from '../screens/settings/WorkoutTypesScreen';
import { WorkoutTypeEditorScreen } from '../screens/settings/WorkoutTypeEditorScreen';
import { ExerciseLibraryScreen } from '../screens/settings/ExerciseLibraryScreen';
import { ExerciseBrowserScreen } from '../screens/settings/ExerciseBrowserScreen';
import { useWorkouts } from '../state/WorkoutContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import type { RootStackParamList } from '../types';
import { MainTabNavigator } from './MainTabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

enableFreeze(true);

export function AppNavigator() {
  const { ready } = useWorkouts();
  const theme = useForgeTheme();
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: theme.selectionIndicator,
        background: theme.background,
        card: theme.background,
        text: theme.textPrimary,
        border: theme.border,
      },
    }),
    [theme],
  );

  if (!ready) return null;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 180,
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="WorkoutDetails"
          component={WorkoutDetailsScreen}
          options={{ gestureEnabled: true }}
        />
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
          name="BackupExport"
          component={SettingsDestinationScreen}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
