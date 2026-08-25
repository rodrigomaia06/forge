import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Button, Icon } from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useWorkouts } from '../state/WorkoutContext';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typography } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Workout } from '../types';

interface HistoryGroup {
  key: string;
  start: Date;
  end: Date;
  workouts: Workout[];
}

export function HistoryScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'History'>) {
  const { completedWorkouts, startWorkout } = useWorkouts();
  const groups = useMemo(() => groupByWeek(completedWorkouts), [completedWorkouts]);
  const handleStart = () => {
    startWorkout();
    navigation.navigate('ActiveWorkout');
  };

  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <View style={styles.editButton} accessibilityLabel="Edit history">
            <View style={styles.editIcon}>
              <View style={styles.editIconLine} />
              <View style={styles.editIconLine} />
              <View style={styles.editIconLine} />
            </View>
            <Text style={styles.editText}>Edit</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {groups.length ? (
            groups.map((group) => (
              <View key={group.key} style={styles.group} testID={`history-group-${group.key}`}>
                <Text style={styles.groupTitle}>{formatGroupRange(group.start, group.end)}</Text>
                <View style={styles.groupCard}>
                  {group.workouts.map((workout, index) => (
                    <HistoryRow
                      key={workout.id}
                      workout={workout}
                      last={index === group.workouts.length - 1}
                    />
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No completed workouts</Text>
              <Text style={styles.emptySubtitle}>Finish a workout and it will appear here.</Text>
              <Button
                label="Start a workout"
                onPress={handleStart}
                theme={dashboardTheme}
                style={styles.emptyAction}
              />
            </View>
          )}
        </ScrollView>
        <NavigationFooter />
      </View>
    </AppScreen>
  );
}

function HistoryRow({ workout, last }: { workout: Workout; last: boolean }) {
  const typeColor = colorForWorkoutType(workout.type);
  const completedAt = workout.completedAt ?? workout.startedAt;

  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={[styles.typeBar, { backgroundColor: typeColor }]} />
      <View style={styles.rowCopy}>
        <Text style={styles.name} numberOfLines={1}>
          {workout.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {`${workout.type} · ${formatWorkoutDate(completedAt)}`}
        </Text>
      </View>
      <View style={styles.rowStats}>
        <Text style={styles.pill}>{formatDuration(workout.durationSeconds)}</Text>
        <Text style={styles.pill}>
          {`${workout.exercises.length} exercises · ${totalSets(workout)} sets`}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={dashboardTheme.slate} />
    </View>
  );
}

function groupByWeek(workouts: Workout[]): HistoryGroup[] {
  const groups = new Map<string, HistoryGroup>();

  workouts.forEach((workout) => {
    const timestamp = workout.completedAt ?? workout.startedAt;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return;

    const key = startOfWeek(date).toISOString().slice(0, 10);
    const existing = groups.get(key);
    if (existing) {
      existing.workouts.push(workout);
      if (date < existing.start) existing.start = date;
      if (date > existing.end) existing.end = date;
      return;
    }
    groups.set(key, { key, start: date, end: date, workouts: [workout] });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      workouts: [...group.workouts].sort(
        (left, right) =>
          (right.completedAt ?? right.startedAt) - (left.completedAt ?? left.startedAt),
      ),
    }))
    .sort((left, right) => right.end.getTime() - left.end.getTime());
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - daysFromMonday);
  return result;
}

function formatGroupRange(start: Date, end: Date): string {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });
  const endYear = end.getFullYear();
  if (startDay === endDay && start.getMonth() === end.getMonth()) {
    return `${startDay} ${endMonth} ${endYear}`;
  }
  const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
  const startPrefix =
    start.getMonth() === end.getMonth() ? `${startDay}` : `${startDay} ${startMonth}`;
  return `${startPrefix}–${endDay} ${endMonth} ${endYear}`;
}

function formatWorkoutDate(value: number): string {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function totalSets(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

function formatDuration(seconds = 0): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function colorForWorkoutType(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes('martial')) return '#F0444D';
  if (normalized.includes('strength')) return dashboardTheme.iconStrength || '#6F7FF2';
  if (normalized.includes('court')) return dashboardTheme.iconSport || '#62C98A';
  return dashboardTheme.iconActivity || dashboardTheme.accent || dashboardTheme.ink;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  title: {
    color: dashboardTheme.ink,
    fontFamily: typography.bold,
    fontSize: 31,
    lineHeight: 36,
  },
  editButton: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#D9DDE3',
    borderRadius: 21,
    backgroundColor: dashboardTheme.surface,
    shadowColor: '#20252D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  editIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2.5,
    borderWidth: 1,
    borderColor: dashboardTheme.slate,
    borderRadius: 9,
  },
  editIconLine: { width: 9, height: 1.5, backgroundColor: dashboardTheme.slate },
  editText: { color: dashboardTheme.ink, fontFamily: typography.medium, fontSize: 16 },
  content: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 20, gap: 20 },
  group: { gap: 9 },
  groupTitle: {
    color: dashboardTheme.slate,
    fontFamily: typography.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  groupCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCE0E6',
    borderRadius: 17,
    backgroundColor: dashboardTheme.surface,
    shadowColor: '#20252D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: dashboardTheme.divider },
  typeBar: { width: 4, height: 34, borderRadius: 4 },
  rowCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  name: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 16,
    lineHeight: 21,
  },
  meta: {
    color: dashboardTheme.slate,
    fontFamily: typography.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  rowStats: { alignItems: 'flex-end', gap: 5 },
  pill: {
    color: dashboardTheme.slate,
    fontFamily: typography.medium,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  empty: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 60, gap: 5 },
  emptyTitle: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 18 },
  emptySubtitle: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 13 },
  emptyAction: { marginTop: 14 },
});
