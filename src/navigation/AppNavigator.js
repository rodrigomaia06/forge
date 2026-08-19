import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ActiveWorkoutScreen } from '../screens/ActiveWorkoutScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

const Stack = createNativeStackNavigator();

function PlansScreen({ navigation }) {
  return <PlaceholderScreen title="Plans" description="Your saved routines will appear here." actionLabel="Start a workout" onAction={() => navigation.navigate('ActiveWorkout')} />;
}
function MoreScreen({ navigation }) {
  return <PlaceholderScreen title="More" description="Settings and tools will appear here." actionLabel="Back to Dashboard" onAction={() => navigation.navigate('Dashboard')} />;
}

export function AppNavigator() {
  return <NavigationContainer><Stack.Navigator initialRouteName="Dashboard" screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 140 }}><Stack.Screen name="Dashboard" component={DashboardScreen} /><Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} /><Stack.Screen name="History" component={HistoryScreen} /><Stack.Screen name="Plans" component={PlansScreen} /><Stack.Screen name="More" component={MoreScreen} /></Stack.Navigator></NavigationContainer>;
}
