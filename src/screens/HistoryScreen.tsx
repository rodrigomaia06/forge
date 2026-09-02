import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  ForgeText as Text,
  HeaderEdge,
  HeaderAction,
  Icon,
  lightHaptic,
  ScreenTitle,
  selectionHaptic,
} from '../components/ui';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { animateLayout, errorHaptic, mediumHaptic } from './activeWorkout/activeWorkoutFeedback';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { RootTabScreenProps, Workout } from '../types';
import { forgeDockScrollInset } from '../components/DockChrome';

interface HistoryGroup {
  key: string;
  label: string;
  workouts: Workout[];
}

export function HistoryScreen({
  navigation,
}: RootTabScreenProps<'History'>) {
  const { completedWorkouts, deleteCompletedWorkout, startWorkout } = useWorkouts();
  const { preferences } = useSettings();
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const groups = useMemo(() => groupByPeriod(completedWorkouts), [completedWorkouts]);
  const [deleteRevealedId, setDeleteRevealedId] = useState<string | null>(null);
  return (
    <AppScreen backgroundColor={theme.background} edges={['top']}>
      <View style={styles.screen}>
        <View testID="history-header" style={styles.header}>
          <ScreenTitle testID="history-title" color={theme.textPrimary}>
            History
          </ScreenTitle>
          <HeaderAction
            accessibilityLabel="Filter"
            icon="filter"
            iconSize={20}
            onPress={() => undefined}
            iconOnly
            style={styles.filterButton}
          />
          <HeaderEdge />
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
                    workoutTypes={preferences.workoutTypes}
                    first={index === 0}
                    onPress={() => {
                      selectionHaptic();
                      navigation.navigate('WorkoutDetails', { workoutId: workout.id });
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
                  startWorkout();
                  navigation.navigate('ActiveWorkout');
                }}
                theme={theme}
                style={styles.emptyAction}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function TimelineRow({
  workout,
  workoutTypes,
  first,
  onPress,
  deleteRevealed,
  onDeleteRevealChange,
  onDelete,
}: {
  workout: Workout;
  workoutTypes: import('../types').WorkoutTypePreference[];
  first: boolean;
  onPress: () => void;
  deleteRevealed: boolean;
  onDeleteRevealChange: (revealed: boolean) => void;
  onDelete: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const deleteActionWidth = 64;
  const cardTranslateX = useSharedValue(deleteRevealed ? -deleteActionWidth : 0);
  const cardOpen = useSharedValue(deleteRevealed);
  const dragDetected = useSharedValue(false);
  const suppressNextPress = useRef(false);
  const date = new Date(workout.completedAt ?? workout.startedAt);
  const type = getWorkoutTypePresentation(workout.type, workoutTypes, theme, 0.14);

  React.useEffect(() => {
    cardOpen.value = deleteRevealed;
    cardTranslateX.value = withSpring(deleteRevealed ? -deleteActionWidth : 0, swipeSpring);
  }, [cardOpen, cardTranslateX, deleteRevealed]);

  const settleCard = (shouldOpen: boolean, dragged: boolean): void => {
    if (dragged) suppressNextPress.current = true;
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
    .onBegin(() => {
      dragDetected.value = false;
    })
    .onUpdate((gesture) => {
      if (Math.abs(gesture.translationX) > 6) dragDetected.value = true;
      if (!cardOpen.value && gesture.translationX >= 0) return;
      const base = cardOpen.value ? -deleteActionWidth : 0;
      cardTranslateX.value = Math.max(-deleteActionWidth, Math.min(0, base + gesture.translationX));
    })
    .onEnd((gesture) => {
      const offset = (cardOpen.value ? -deleteActionWidth : 0) + gesture.translationX;
      runOnJS(settleCard)(
        Math.max(-deleteActionWidth, Math.min(0, offset)) < -42,
        dragDetected.value,
      );
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
              <Icon name="trash" size={18} color={theme.textDestructive} />
              <Text style={styles.deleteActionText}>Delete</Text>
            </Pressable>
          </View>
          <Animated.View style={[styles.swipeContent, swipeContentStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${workout.name}`}
              onPress={() => {
                if (suppressNextPress.current) {
                  suppressNextPress.current = false;
                  return;
                }
                onPress();
              }}
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
                  {`${workout.exercises.length} exercises · ${countWorkoutSets(workout)} sets`}
                </Text>
              </View>
              <View style={styles.durationChip}>
                <Icon name="time-outline" size={13} color={theme.ink} />
                <Text style={styles.durationText}>{formatCompactDuration(workout.durationSeconds)}</Text>
              </View>
              <Icon name="chevron-forward" size={17} color={theme.slate} />
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

const createStyles = (theme: import('../types').ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  header: {
    position: 'relative',
    zIndex: 2,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: theme.background,
  },
  filterButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    minHeight: 46,
    paddingHorizontal: 0,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceElevated,
    shadowColor: theme.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: forgeDockScrollInset, gap: 18 },
  group: { gap: 8 },
  groupTitle: {
    marginLeft: 70,
    color: theme.slate,
    ...typeScale.supporting,
  },
  timelineRow: { minHeight: 76, flexDirection: 'row', alignItems: 'stretch' },
  dateColumn: { width: 47, alignItems: 'flex-end', paddingTop: 14, paddingRight: 5 },
  weekday: { color: theme.slate, ...typeScale.caption },
  day: { color: theme.ink, ...typeScale.metricMedium },
  month: { color: theme.slate, ...typeScale.caption },
  timelineRail: { width: 23, alignItems: 'center', position: 'relative' },
  railLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.divider,
  },
  railLineFirst: { top: 37 },
  marker: {
    zIndex: 1,
    marginTop: 33,
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: theme.divider,
    borderRadius: 7,
    backgroundColor: theme.background,
  },
  markerActive: { borderColor: theme.ink, backgroundColor: theme.ink },
  swipeContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: theme.destructiveSurface,
  },
  deleteActionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 64,
    backgroundColor: theme.destructiveSurface,
  },
  deleteAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  deleteActionPressed: { backgroundColor: theme.destructiveSurfacePressed },
  deleteActionText: { color: theme.textDestructive, ...typeScale.caption },
  swipeContent: { zIndex: 1, backgroundColor: theme.surface },
  card: {
    flex: 1,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.surface,
    shadowColor: theme.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
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
  name: { color: theme.ink, ...typeScale.cardTitle },
  stats: { color: theme.slate, ...typeScale.label },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: theme.surfaceMuted,
  },
  durationText: { color: theme.ink, ...typeScale.caption },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 5 },
  emptyTitle: { color: theme.ink, ...typeScale.sectionTitle },
  emptySubtitle: { color: theme.slate, ...typeScale.label },
  emptyAction: { marginTop: 14 },
});
