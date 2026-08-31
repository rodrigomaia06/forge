import type { NavigationProp } from '@react-navigation/native';

export type RootStackParamList = {
  Dashboard: { selectedDay?: number } | undefined;
  ActiveWorkout: undefined;
  History: undefined;
  WorkoutDetails: { workoutId: string };
  HistoryWorkoutEditor: { workoutId: string };
  Plans: { openCreation?: boolean } | undefined;
  RoutineEditor: { routineId: string };
  Settings: undefined;
  GeneralSettings: undefined;
  ExerciseLibrary: undefined;
  ExerciseBrowser: { workoutTypeId?: string; custom?: boolean } | undefined;
  WorkoutTypes: undefined;
  WorkoutTypeEditor:
    | { workoutTypeId: string }
    | { mode: 'create'; draftId: string; initialColor: string };
  BackupExport: undefined;
  Logs: undefined;
  About: undefined;
};
export type RootNavigationProp = NavigationProp<RootStackParamList>;
