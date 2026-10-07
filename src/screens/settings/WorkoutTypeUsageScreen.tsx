import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, ForgeCard, ForgeText, Icon } from '../../components/ui';
import { useSettings } from '../../state/SettingsContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { usePlans } from '../../state/PlansContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { spacing, typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import type { RootStackParamList } from '../../types';
import { workoutTypeIcon, workoutTypeUsage } from '../../domain/workouts/workoutTypeMetadata';
import { countWorkoutSets } from '../../domain/workouts/presentation';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow } from './SettingsRow';
import { dateFormatter } from '../../utils/dateFormatters';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutTypeUsage'>;
type UsageRow = { id: string; name: string; subtitle: string };

export function WorkoutTypeUsageScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const { bottom } = useSafeAreaInsets();
  const { preferences } = useSettings();
  const { completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const [elevated, setElevated] = useState(false);
  const type = preferences.workoutTypes.find((type) => type.id === route.params.workoutTypeId);
  const workouts = route.params.kind === 'workouts';
  const dates = dateFormatter({ day: 'numeric', month: 'short', year: 'numeric' });
  const rows = useMemo<UsageRow[]>(() => {
    if (!type) return [];
    const usage = workoutTypeUsage(type, completedWorkouts, plans, standaloneRoutines);
    return workouts
      ? usage.workouts.map((workout) => ({
          id: workout.id,
          name: workout.name,
          subtitle: `${dates.format(workout.completedAt ?? workout.startedAt)} · ${countWorkoutSets(workout)} ${countWorkoutSets(workout) === 1 ? 'set' : 'sets'}`,
        }))
      : usage.routines.map(({ routine, planName }) => ({
          id: routine.id,
          name: routine.name,
          subtitle: `${planName ?? 'Standalone routine'} · ${routine.exercises.length} ${routine.exercises.length === 1 ? 'exercise' : 'exercises'}`,
        }));
  }, [type, completedWorkouts, plans, standaloneRoutines, workouts, dates]);
  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader
          title={workouts ? 'Saved workouts' : 'Routines'}
          navigation={navigation}
          backAccessibilityLabel="Back to workout type"
          elevated={elevated}
        />
        <FlatList
          testID="workout-type-usage-list"
          data={rows}
          keyExtractor={(row) => row.id}
          initialNumToRender={10}
          contentContainerStyle={[styles.content, { paddingBottom: scaleUI(40) + bottom }]}
          onScroll={(event) => setElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
          ListHeaderComponent={
            type ? (
              <ForgeText style={[typeScale.sectionTitle, { color: theme.textPrimary }]}>
                {type.name}
              </ForgeText>
            ) : null
          }
          renderItem={({ item }) => (
            <ForgeCard>
              <SettingsRow
                title={item.name}
                subtitle={item.subtitle}
                disclosure
                leading={
                  <Icon
                    name={type ? workoutTypeIcon(type) : 'fitness-outline'}
                    size={26}
                    color={type?.color ?? theme.textSecondary}
                  />
                }
                accessibilityLabel={`Open ${workouts ? 'workout' : 'routine'} ${item.name}`}
                onPress={() =>
                  workouts
                    ? navigation.navigate('WorkoutDetails', {
                        workoutId: item.id,
                        backAccessibilityLabel: 'Back to type workouts',
                      })
                    : navigation.navigate('RoutineEditor', { mode: 'view', routineId: item.id })
                }
              />
            </ForgeCard>
          )}
          ListEmptyComponent={
            <ForgeText style={[typeScale.body, { color: theme.textSecondary }]}>
              {type
                ? `No ${workouts ? 'saved workouts' : 'routines'} use this type.`
                : 'This workout type is no longer available.'}
            </ForgeText>
          }
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.screen, gap: scaleUI(14) },
});
