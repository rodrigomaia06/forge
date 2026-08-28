import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableFreeze } from 'react-native-screens';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ActiveWorkoutScreen } from '../screens/ActiveWorkoutScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { WorkoutDetailsScreen } from '../screens/WorkoutDetailsScreen';
import { HistoryWorkoutEditorScreen } from '../screens/HistoryWorkoutEditorScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GeneralSettingsScreen } from '../screens/settings/GeneralSettingsScreen';
import { SettingsDestinationScreen } from '../screens/settings/SettingsDestinationScreen';
import { useWorkouts } from '../state/WorkoutContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

enableFreeze(true);

type PlansScreenProps = NativeStackScreenProps<RootStackParamList, 'Plans'>;

function PlansScreen({ navigation }: PlansScreenProps) {
  return (
    <PlaceholderScreen
      title="Plans"
      description="Your saved routines will appear here."
      actionLabel="Start a workout"
      onAction={() => navigation.navigate('ActiveWorkout')}
    />
  );
}
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
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="ActiveWorkout"
          component={ActiveWorkoutScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ gestureEnabled: false }}
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
        <Stack.Screen name="Plans" component={PlansScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="GeneralSettings"
          component={GeneralSettingsScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="ExerciseLibrary"
          component={SettingsDestinationScreen}
          options={{ gestureEnabled: true }}
        />
        <Stack.Screen
          name="WorkoutTypes"
          component={SettingsDestinationScreen}
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
