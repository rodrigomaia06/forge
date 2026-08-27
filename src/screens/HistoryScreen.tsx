import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  AppScreen,
  Button,
  Icon,
  lightHaptic,
  ScreenTitle,
  selectionHaptic,
} from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useWorkouts } from '../state/WorkoutContext';
import { animateLayout, errorHaptic, mediumHaptic } from './activeWorkout/activeWorkoutFeedback';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typography } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Workout } from '../types';

interface HistoryGroup {
  key: string;
  label: string;
  workouts: Workout[];
}

export function HistoryScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'History'>) {
  const { completedWorkouts, deleteCompletedWorkout, startWorkout } = useWorkouts();
  const groups = useMemo(() => groupByPeriod(completedWorkouts), [completedWorkouts]);
  const [deleteRevealedId, setDeleteRevealedId] = useState<string | null>(null);
  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        <View testID="history-header" style={styles.header}>
          <ScreenTitle testID="history-title" color={dashboardTheme.ink}>
            History
          </ScreenTitle>
          <Button
            accessibilityLabel="Filter"
            icon="filter"
            iconSize={20}
            variant="secondary"
            onPress={() => undefined}
            theme={dashboardTheme}
            style={styles.filterButton}
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {groups.length ? (
            groups.map((group) => (
              <View key={group.key} testID={`history-group-${group.key}`} style={styles.group}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                {group.workouts.map((workout, index) => (
                  <TimelineRow
                    key={workout.id}
                    workout={workout}
                    first={index === 0}
                    onPress={() => {
                      selectionHaptic();
                      navigation.replace('WorkoutDetails', { workoutId: workout.id });
                    }}
                    deleteRevealed={deleteRevealedId === workout.id}
                    onDeleteRevealChange={(revealed) =>
                      setDeleteRevealedId(revealed ? workout.id : null)
                    }
                    onDelete={() => {
                      animateLayout();
                      errorHaptic();
                      deleteCompletedWorkout(workout.id);
                      setDeleteRevealedId(null);
                    }}
                  />
                ))}
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No completed workouts</Text>
              <Text style={styles.emptySubtitle}>Finish a workout and it will appear here.</Text>
              <Button
                label="Start a workout"
                onPress={() => {
                  lightHaptic();
                  startWorkout();
                  navigation.navigate('ActiveWorkout');
                }}
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

function TimelineRow({
  workout,
  first,
  onPress,
  deleteRevealed,
  onDeleteRevealChange,
  onDelete,
}: {
  workout: Workout;
  first: boolean;
  onPress: () => void;
  deleteRevealed: boolean;
  onDeleteRevealChange: (revealed: boolean) => void;
  onDelete: () => void;
}) {
  const deleteActionWidth = 64;
  const cardTranslateX = useSharedValue(deleteRevealed ? -deleteActionWidth : 0);
  const cardOpen = useSharedValue(deleteRevealed);
  const date = new Date(workout.completedAt ?? workout.startedAt);
  const type = workoutTypePresentation(workout.type);

  React.useEffect(() => {
    cardOpen.value = deleteRevealed;
    cardTranslateX.value = withSpring(deleteRevealed ? -deleteActionWidth : 0, swipeSpring);
  }, [cardOpen, cardTranslateX, deleteRevealed]);

  const settleCard = (shouldOpen: boolean): void => {
    if (shouldOpen !== deleteRevealed) {
      mediumHaptic();
      onDeleteRevealChange(shouldOpen);
      return;
    }
    cardTranslateX.value = withSpring(shouldOpen ? -deleteActionWidth : 0, swipeSpring);
  };
  const cardGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((gesture) => {
      if (!cardOpen.value && gesture.translationX >= 0) return;
      const base = cardOpen.value ? -deleteActionWidth : 0;
      cardTranslateX.value = Math.max(-deleteActionWidth, Math.min(0, base + gesture.translationX));
    })
    .onEnd((gesture) => {
      const offset = (cardOpen.value ? -deleteActionWidth : 0) + gesture.translationX;
      runOnJS(settleCard)(Math.max(-deleteActionWidth, Math.min(0, offset)) < -42);
    });
  const swipeContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardTranslateX.value }],
  }));

  return (
    <View
      testID={`history-timeline-${workout.id}`}
      accessibilityLabel="History timeline"
      style={styles.timelineRow}
    >
      <View style={styles.dateColumn}>
        <Text style={styles.weekday}>{date.toLocaleDateString('en-GB', { weekday: 'short' })}</Text>
        <Text style={styles.day}>{date.getDate()}</Text>
        <Text style={styles.month}>{date.toLocaleDateString('en-GB', { month: 'short' })}</Text>
      </View>
      <View style={styles.timelineRail}>
        <View style={[styles.railLine, first && styles.railLineFirst]} />
        <View style={[styles.marker, first && styles.markerActive]} />
      </View>
      <GestureDetector gesture={cardGesture}>
        <View testID={`history-swipe-${workout.id}`} style={styles.swipeContainer}>
          <View pointerEvents={deleteRevealed ? 'auto' : 'none'} style={styles.deleteActionLayer}>
            <Pressable
              testID={`history-delete-${workout.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${workout.name}`}
              onPress={onDelete}
              style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}
            >
              <Icon name="trash" size={18} color="#D64848" />
              <Text style={styles.deleteActionText}>Delete</Text>
            </Pressable>
          </View>
          <Animated.View style={[styles.swipeContent, swipeContentStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${workout.name}`}
              onPress={onPress}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={[styles.typeIcon, { backgroundColor: type.background }]}>
                <Icon name={type.icon} size={19} color={type.color} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.name} numberOfLines={1}>
                  {workout.name}
                </Text>
                <Text style={styles.stats} numberOfLines={1}>
                  {`${workout.exercises.length} exercises · ${totalSets(workout)} sets`}
                </Text>
              </View>
              <View style={styles.durationChip}>
                <Icon name="time-outline" size={13} color={dashboardTheme.ink} />
                <Text style={styles.durationText}>{formatDuration(workout.durationSeconds)}</Text>
              </View>
              <Icon name="chevron-forward" size={17} color={dashboardTheme.slate} />
            </Pressable>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const swipeSpring = { damping: 22, stiffness: 280, mass: 0.65, overshootClamping: true };

function groupByPeriod(workouts: Workout[]): HistoryGroup[] {
  const current = startOfWeek(new Date());
  const groups = new Map<string, HistoryGroup>();
  [...workouts]
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
    .forEach((workout) => {
      const date = new Date(workout.completedAt ?? workout.startedAt);
      if (Number.isNaN(date.getTime())) return;
      const week = startOfWeek(date);
      const key = week.toISOString().slice(0, 10);
      if (!groups.has(key))
        groups.set(key, { key, label: periodLabel(week, current), workouts: [] });
      groups.get(key)?.workouts.push(workout);
    });
  return [...groups.values()];
}
function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}
function periodLabel(week: Date, current: Date): string {
  const days = Math.round((current.getTime() - week.getTime()) / 86400000);
  if (days <= 0) return 'This week';
  if (days <= 7) return 'Last week';
  return `${Math.floor(days / 7)} weeks ago`;
}
function totalSets(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}
function formatDuration(seconds = 0): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}
function workoutTypePresentation(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes('mobility'))
    return { icon: 'stretching' as const, color: '#AA7CE8', background: 'rgba(170,124,232,0.14)' };
  if (normalized.includes('court'))
    return {
      icon: 'tennis-ball' as const,
      color: dashboardTheme.iconSport || '#62C98A',
      background: 'rgba(98,201,138,0.14)',
    };
  if (normalized.includes('cardio'))
    return {
      icon: 'running' as const,
      color: dashboardTheme.iconActivity || '#E99A5B',
      background: 'rgba(233,154,91,0.14)',
    };
  return {
    icon: 'fitness-outline' as const,
    color: dashboardTheme.iconStrength || '#6F7FF2',
    background: 'rgba(111,127,242,0.14)',
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: dashboardTheme.background,
  },
  filterButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    minHeight: 46,
    paddingHorizontal: 0,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 108, gap: 18 },
  group: { gap: 8 },
  groupTitle: {
    marginLeft: 70,
    color: dashboardTheme.slate,
    fontFamily: typography.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  timelineRow: { minHeight: 76, flexDirection: 'row', alignItems: 'stretch' },
  dateColumn: { width: 47, alignItems: 'flex-end', paddingTop: 14, paddingRight: 5 },
  weekday: {
    color: dashboardTheme.slate,
    fontFamily: typography.medium,
    fontSize: 12,
    lineHeight: 15,
  },
  day: { color: dashboardTheme.ink, fontFamily: typography.bold, fontSize: 22, lineHeight: 24 },
  month: {
    color: dashboardTheme.slate,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 15,
  },
  timelineRail: { width: 23, alignItems: 'center', position: 'relative' },
  railLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: dashboardTheme.divider,
  },
  railLineFirst: { top: 37 },
  marker: {
    zIndex: 1,
    marginTop: 33,
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: dashboardTheme.divider,
    borderRadius: 7,
    backgroundColor: dashboardTheme.background,
  },
  markerActive: { borderColor: dashboardTheme.ink, backgroundColor: dashboardTheme.ink },
  swipeContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#F6DCDD',
  },
  deleteActionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 64,
    backgroundColor: '#F6DCDD',
  },
  deleteAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  deleteActionPressed: { backgroundColor: '#F1CED0' },
  deleteActionText: { color: '#D64848', fontFamily: typography.semibold, fontSize: 11 },
  swipeContent: { zIndex: 1, backgroundColor: dashboardTheme.surface },
  card: {
    flex: 1,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 0,
    backgroundColor: dashboardTheme.surface,
    shadowColor: dashboardTheme.ink,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { opacity: 0.72 },
  typeIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  cardCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  name: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 16,
    lineHeight: 20,
  },
  stats: {
    color: dashboardTheme.slate,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  durationText: {
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 5 },
  emptyTitle: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 18 },
  emptySubtitle: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 13 },
  emptyAction: { marginTop: 14 },
});
