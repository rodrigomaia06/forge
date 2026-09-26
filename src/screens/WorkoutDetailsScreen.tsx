import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeConfirmationDialog,
  ForgeText as Text,
  ForgeBackButton,
  HeaderAction,
  HeaderActionGroup,
  HeaderEdge,
  joinedHeaderAction,
  selectionHaptic,
} from '../components/ui';
import { WorkoutSummaryCard } from '../components/WorkoutSummaryCard';
import { ReadOnlyExerciseSection } from './activeWorkout/ExerciseSection';
import { useWorkouts } from '../state/WorkoutContext';
import { exercisesWithHistoricalPrevious } from '../domain/workouts/nextSessionTargets';
import { useSettings } from '../state/SettingsContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutDetails'>;

export function WorkoutDetailsScreen({ navigation, route }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { ready, completedWorkouts, deleteCompletedWorkout } = useWorkouts();
  const { preferences } = useSettings();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const workout = completedWorkouts.find((item) => item.id === route.params.workoutId);
  // "Previous" is derived live from earlier sessions so imported/legacy workouts
  // (which never stored it) still show the prior set values in History.
  const exercises = React.useMemo(
    () => (workout ? exercisesWithHistoricalPrevious(workout, completedWorkouts) : []),
    [workout, completedWorkouts],
  );
  const returnDestination = route.params.returnTo ?? 'History';
  const returnToHistory = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: returnDestination });
  };
  if (!ready)
    return (
      <AppScreen backgroundColor={theme.background}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading workout…</Text>
        </View>
      </AppScreen>
    );
  if (!workout)
    return (
      <AppScreen backgroundColor={theme.background}>
        <View style={styles.center}>
          <Text style={styles.title}>Workout not found</Text>
          <Button
            label="Back to History"
            onPress={() => {
              selectionHaptic();
              returnToHistory();
            }}
            theme={theme}
          />
        </View>
      </AppScreen>
    );
  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ForgeBackButton
            accessibilityLabel={`Back to ${returnDestination === 'ActiveWorkout' ? 'workout' : 'History'}`}
            onPress={() => {
              returnToHistory();
            }}
          />
          {headerElevated ? <HeaderEdge /> : null}
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {workout.name}
            </Text>
          </View>
          <HeaderActionGroup>
            <HeaderAction
              accessibilityLabel="Edit workout"
              icon="note"
              iconSize={20}
              iconOnly
              variant="ghost"
              style={joinedHeaderAction}
              onPress={() => {
                selectionHaptic();
                navigation.navigate('HistoryWorkoutEditor', { mode: 'edit', workoutId: workout.id });
              }}
            />
            <HeaderAction
              accessibilityLabel="Delete workout"
              icon="trash"
              iconSize={20}
              iconOnly
              variant="ghost"
              tone="destructive"
              style={joinedHeaderAction}
              onPress={() => { selectionHaptic(); setConfirmDelete(true); }}
            />
          </HeaderActionGroup>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <WorkoutSummaryCard
            testID="workout-details-summary"
            workout={workout}
            workoutTypes={preferences.workoutTypes}
          />
          <View style={styles.exerciseList}>
            {exercises.map((exercise) => (
              <ReadOnlyExerciseSection key={exercise.id} exercise={exercise} workoutId={workout.id} />
            ))}
          </View>
        </ScrollView>
        <ForgeConfirmationDialog
          visible={confirmDelete}
          title={`Delete ${workout.name}?`}
          message="This permanently removes this workout and its sets. This can't be undone."
          cancelLabel="Cancel"
          confirmLabel="Delete"
          confirmTone="destructive"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteCompletedWorkout(workout.id);
            returnToHistory();
          }}
        />
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: import('../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    header: {
      position: 'relative',
      zIndex: 2,
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.background,
    },
    headerCopy: {
      position: 'absolute',
      top: 0,
      right: 116,
      bottom: 0,
      left: 116,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { color: theme.ink, ...typeScale.headerTitle, textAlign: 'center' },
    // Details are presented above the tab navigator, so they do not reserve
    // space for the floating primary dock.
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 32, gap: 12 },
    exerciseList: { gap: 10 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
    title: { color: theme.ink, ...typeScale.sectionTitle },
    muted: { color: theme.slate, ...typeScale.label },
  });
