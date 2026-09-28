import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeActionSheet,
  ForgeConfirmationDialog,
  ForgeText as Text,
  ForgeBackButton,
  HeaderAction,
  HeaderEdge,
  selectionHaptic,
} from '../components/ui';
import { WorkoutSummaryCard } from '../components/WorkoutSummaryCard';
import { ReadOnlyExerciseSection } from './activeWorkout/ExerciseSection';
import { useWorkouts } from '../state/WorkoutContext';
import { exercisesWithHistoricalPrevious } from '../domain/workouts/nextSessionTargets';
import { useSettings } from '../state/SettingsContext';
import { shareItemFromSheet } from '../utils/shareItem';
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
  const [optionsOpen, setOptionsOpen] = useState(false);
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
          <HeaderAction
            accessibilityLabel="Workout options"
            icon="ellipsis-horizontal"
            iconSize={20}
            iconOnly
            // Match the back button's circular surface so the two header
            // controls read as peers (the borderless-dark rule drops the border
            // in Dark, exactly as it does for Back).
            style={{
              backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated,
              borderColor: theme.border,
            }}
            onPress={() => { selectionHaptic(); setOptionsOpen(true); }}
          />
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
        <ForgeActionSheet
          visible={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          accessibilityLabel="Close workout options"
          title={workout.name}
          titleNumberOfLines={1}
          actions={[
            { label: 'Share workout', icon: 'share', onPress: () => shareItemFromSheet({ kind: 'workout', id: workout.id }) },
            { label: 'Edit workout', icon: 'note', onPress: () => navigation.navigate('HistoryWorkoutEditor', { mode: 'edit', workoutId: workout.id }) },
            // Defer past the options sheet's dismissal; iOS drops a Modal
            // presented while another is still closing.
            { label: 'Delete workout', icon: 'trash', tone: 'destructive', onPress: () => setTimeout(() => setConfirmDelete(true), 280) },
          ]}
        />
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
      // A flex middle column (not an absolute overlay) so the title truncates in
      // the space between the back button and the action pill — its width scales
      // with however many actions the pill holds, instead of a fixed reservation
      // that a third action would overlap.
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 8,
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
