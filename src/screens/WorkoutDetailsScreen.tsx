import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeText as Text,
  ForgeBackButton,
  HeaderAction,
  HeaderEdge,
  selectionHaptic,
} from '../components/ui';
import { WorkoutSummaryCard } from '../components/WorkoutSummaryCard';
import { ReadOnlyExerciseSection } from './activeWorkout/ExerciseSection';
import { WorkoutOptionsSheet } from './activeWorkout/WorkoutSheets';
import { useWorkouts } from '../state/WorkoutContext';
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const workout = completedWorkouts.find((item) => item.id === route.params.workoutId);
  const returnToHistory = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'History' });
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
            accessibilityLabel="Back to History"
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
            label="More"
            onPress={() => {
              setOptionsOpen(true);
            }}
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
            {workout.exercises.map((exercise) => (
              <ReadOnlyExerciseSection key={exercise.id} exercise={exercise} />
            ))}
          </View>
        </ScrollView>
        <WorkoutOptionsSheet
          visible={optionsOpen}
          workoutName={workout.name}
          onClose={() => setOptionsOpen(false)}
          onEdit={() => {
            navigation.navigate('HistoryWorkoutEditor', { mode: 'edit', workoutId: workout.id });
          }}
          onDelete={() => {
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
