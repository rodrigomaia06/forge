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
import { useWorkouts } from '../state/WorkoutContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

enableFreeze(true);

type PlansScreenProps = NativeStackScreenProps<RootStackParamList, 'Plans'>;
type MoreScreenProps = NativeStackScreenProps<RootStackParamList, 'More'>;

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
function MoreScreen({ navigation }: MoreScreenProps) {
  return (
    <PlaceholderScreen
      title="More"
      description="Settings and tools will appear here."
      actionLabel="Back to Dashboard"
      onAction={() => navigation.navigate('Dashboard')}
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
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
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
        <Stack.Screen name="Plans" component={PlansScreen} />
        <Stack.Screen name="More" component={MoreScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
