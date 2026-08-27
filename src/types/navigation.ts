import type { NavigationProp } from '@react-navigation/native';

export type RootStackParamList = {
  Dashboard: { selectedDay?: number } | undefined;
  ActiveWorkout: undefined;
  History: undefined;
  WorkoutDetails: { workoutId: string };
  Plans: undefined;
  More: undefined;
};
export type RootNavigationProp = NavigationProp<RootStackParamList>;
