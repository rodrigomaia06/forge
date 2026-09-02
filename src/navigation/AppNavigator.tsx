import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableFreeze } from 'react-native-screens';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ActiveWorkoutScreen } from '../screens/ActiveWorkoutScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { WorkoutDetailsScreen } from '../screens/WorkoutDetailsScreen';
import { HistoryWorkoutEditorScreen } from '../screens/HistoryWorkoutEditorScreen';
import { PlansScreen } from '../screens/PlansScreen';
import { RoutineEditorScreen } from '../screens/RoutineEditorScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GeneralSettingsScreen } from '../screens/settings/GeneralSettingsScreen';
import { SettingsDestinationScreen } from '../screens/settings/SettingsDestinationScreen';
import { WorkoutTypesScreen } from '../screens/settings/WorkoutTypesScreen';
import { WorkoutTypeEditorScreen } from '../screens/settings/WorkoutTypeEditorScreen';
import { ExerciseLibraryScreen } from '../screens/settings/ExerciseLibraryScreen';
import { ExerciseBrowserScreen } from '../screens/settings/ExerciseBrowserScreen';
import { useWorkouts } from '../state/WorkoutContext';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const rootTabOptions = { gestureEnabled: false, animation: 'none' as const };

enableFreeze(true);

export function AppNavigator() {
  const { ready, activeWorkout } = useWorkouts();

  if (!ready) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={activeWorkout ? 'ActiveWorkout' : 'Dashboard'}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 180,
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={rootTabOptions}
        />
        <Stack.Screen
          name="ActiveWorkout"
          component={ActiveWorkoutScreen}
          options={rootTabOptions}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={rootTabOptions}
        />
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
        <Stack.Screen name="Plans" component={PlansScreen} options={rootTabOptions} />
        <Stack.Screen
          name="RoutineEditor"
          component={RoutineEditorScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={rootTabOptions}
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
