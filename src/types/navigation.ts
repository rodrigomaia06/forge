import type {
  CompositeNavigationProp,
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootTabParamList = {
  Dashboard: { selectedDate?: string } | undefined;
  ActiveWorkout: { openRestTimer?: 'open'; openAddExercises?: 'open' } | undefined;
  History: undefined;
  Plans: { openCreation?: boolean } | undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  WorkoutDetails: { workoutId: string; returnTo?: 'History' | 'ActiveWorkout'; returnContext?: 'previous-sessions' };
  HistoryWorkoutEditor:
    | { mode: 'edit'; workoutId: string }
    | { mode: 'create'; selectedDate: string }
    | { mode: 'active' };
  RoutineEditor:
    | { mode: 'create'; planId?: string }
    | { mode: 'edit'; routineId: string }
    | { mode: 'view'; routineId: string };
  GeneralSettings: undefined;
  DailyMeasurements: undefined;
  ExerciseLibrary: undefined;
  ExerciseBrowser: { workoutTypeId?: string; custom?: boolean } | undefined;
  WorkoutTypes: undefined;
  WorkoutTypeEditor:
    | { workoutTypeId: string }
    | { mode: 'create'; draftId: string; initialColor: string };
  BackupExport: undefined;
  Logs: undefined;
  About: undefined;
  MuscleHeatmapDetail: undefined;
  Calendar: undefined;
};

export type RootNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type RootTabScreenProps<Screen extends keyof RootTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, Screen>,
  NativeStackScreenProps<RootStackParamList>
>;
