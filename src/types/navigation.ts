import type { NavigationProp } from '@react-navigation/native';

export type RootStackParamList = {
  Dashboard: { selectedDay?: number } | undefined;
  ActiveWorkout: undefined;
  History: undefined;
  WorkoutDetails: { workoutId: string };
  HistoryWorkoutEditor: { workoutId: string };
  Plans: undefined;
  Settings: undefined;
  GeneralSettings: undefined;
  ExerciseLibrary: undefined;
  WorkoutTypes: undefined;
  BackupExport: undefined;
  Logs: undefined;
  About: undefined;
};
export type RootNavigationProp = NavigationProp<RootStackParamList>;
