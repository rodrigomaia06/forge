import type { WorkoutExercise } from './workout';
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
  ExerciseInfo: {
    exercise: WorkoutExercise;
    initialTab?: 'info' | 'progress' | 'history';
    excludeWorkoutId?: string;
    readOnly?: boolean;
    fromLibrary?: boolean;
  };
  WorkoutDetails: {
    workoutId: string;
    returnTo?: 'History' | 'ActiveWorkout';
    returnContext?: 'previous-sessions';
    backAccessibilityLabel?: string;
  };
  HistoryWorkoutEditor:
    | { mode: 'edit'; workoutId: string }
    | { mode: 'create'; selectedDate: string }
    | { mode: 'active' };
  RoutineEditor:
    | { mode: 'create'; planId?: string }
    | { mode: 'edit'; routineId: string }
    | { mode: 'view'; routineId: string };
  GeneralSettings: undefined;
  DailyMeasurements: { metricId?: string } | undefined;
  ExerciseLibrary: undefined;
  ExerciseBrowser: { workoutTypeId?: string; custom?: boolean; editExerciseId?: string } | undefined;
  WorkoutTypes: undefined;
  WorkoutTypeUsage: { workoutTypeId: string; kind: 'workouts' | 'routines' };
  WorkoutTypeEditor:
    | { workoutTypeId: string }
    | { mode: 'create'; draftId: string; initialColor: string };
  BackupExport: undefined;
  ImportSelection: undefined;
  CsvImport: undefined;
  ImportConflict: undefined;
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
