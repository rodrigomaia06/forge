import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  errorHaptic,
  HeaderAction,
  Icon,
  selectionHaptic,
} from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { ReadOnlyExerciseSection } from './activeWorkout/ExerciseSection';
import { WorkoutOptionsSheet } from './activeWorkout/WorkoutSheets';
import { useWorkouts } from '../state/WorkoutContext';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typography } from '../theme/tokens';
import type { RootStackParamList, Workout } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutDetails'>;

export function WorkoutDetailsScreen({ navigation, route }: Props) {
  const { ready, completedWorkouts, deleteCompletedWorkout } = useWorkouts();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const workout = completedWorkouts.find((item) => item.id === route.params.workoutId);
  if (!ready)
    return (
      <AppScreen backgroundColor={dashboardTheme.background}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading workout…</Text>
        </View>
      </AppScreen>
    );
  if (!workout)
    return (
      <AppScreen backgroundColor={dashboardTheme.background}>
        <View style={styles.center}>
          <Text style={styles.title}>Workout not found</Text>
          <Button
            label="Back to History"
            onPress={() => {
              selectionHaptic();
              navigation.navigate('History');
            }}
            theme={dashboardTheme}
          />
        </View>
      </AppScreen>
    );
  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <HeaderAction
            accessibilityLabel="Back to History"
            icon="chevron-back"
            label="Back"
            onPress={() => {
              selectionHaptic();
              navigation.navigate('History');
            }}
          />
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
              selectionHaptic();
              setOptionsOpen(true);
            }}
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <WorkoutSummaryCard workout={workout} />
          <View style={styles.exerciseList}>
            {workout.exercises.map((exercise) => (
              <ReadOnlyExerciseSection key={exercise.id} exercise={exercise} />
            ))}
          </View>
        </ScrollView>
        <NavigationFooter />
        <WorkoutOptionsSheet
          visible={optionsOpen}
          workoutName={workout.name}
          onClose={() => setOptionsOpen(false)}
          onDelete={() => {
            errorHaptic();
            deleteCompletedWorkout(workout.id);
            setOptionsOpen(false);
            navigation.navigate('History');
          }}
        />
      </View>
    </AppScreen>
  );
}

function WorkoutSummaryCard({ workout }: { workout: Workout }) {
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const type = workoutTypePresentation(workout.type);
  const duration = formatDuration(workout.durationSeconds ?? 0);
  const metadata = [
    workout.location && { icon: 'measure' as const, label: 'Location', value: workout.location },
    workout.mood && { icon: 'info' as const, label: 'Mood', value: workout.mood },
    workout.note?.trim() && { icon: 'note' as const, label: 'Notes', value: workout.note.trim() },
  ].filter(Boolean) as { icon: 'measure' | 'info' | 'note'; label: string; value: string }[];

  const updateCardSize = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setCardSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  return (
    <View testID="workout-details-summary" onLayout={updateCardSize} style={styles.summaryCard}>
      <Svg
        pointerEvents="none"
        width={cardSize.width}
        height={cardSize.height}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id="workoutSummaryGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={dashboardTheme.summaryGradientStart} />
            <Stop offset="1" stopColor={dashboardTheme.summaryGradientEnd} />
          </LinearGradient>
        </Defs>
        <Rect width={cardSize.width} height={cardSize.height} fill="url(#workoutSummaryGradient)" />
        <Circle
          cx={cardSize.width * 0.94}
          cy={cardSize.height * 0.22}
          r={Math.max(cardSize.width, cardSize.height) * 0.52}
          fill={dashboardTheme.summaryGlow}
          opacity={0.2}
        />
        <Circle
          cx={cardSize.width * 0.84}
          cy={cardSize.height * 0.92}
          r={Math.max(cardSize.width, cardSize.height) * 0.42}
          fill={type.color}
          opacity={0.045}
        />
      </Svg>
      <View style={styles.summaryTop}>
        <View style={[styles.summaryIcon, { backgroundColor: type.background }]}>
          <Icon name={type.icon} size={30} color={type.color} />
        </View>
        <View style={styles.timingMetrics}>
          <TimingMetric icon="time-outline" label="Duration" value={duration} color={type.color} />
          <TimingMetric
            icon="time-outline"
            label="Avg rest / set"
            value={
              workout.averageRestSeconds === undefined
                ? '—'
                : formatRest(workout.averageRestSeconds)
            }
            color={dashboardTheme.iconStrength || dashboardTheme.accent || dashboardTheme.ink}
          />
        </View>
      </View>
      <View style={styles.summaryMain}>
        <View style={styles.summaryDateRow}>
          <Icon name="calendar" size={16} color={dashboardTheme.slate} />
          <Text style={styles.summaryDate}>
            {formatDateTime(workout.completedAt ?? workout.startedAt)}
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        {metric('Exercises', String(workout.exercises.length))}
        {metric('Sets', String(totalSets(workout)))}
      </View>
      {metadata.length > 0 && (
        <View style={styles.metadata}>
          {metadata.map((item) => (
            <MetadataItem key={item.label} {...item} />
          ))}
        </View>
      )}
    </View>
  );
}

function metric(label: string, value: string) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}
function TimingMetric({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.timingMetric}>
      <View style={styles.timingValueRow}>
        <Icon name={icon} size={17} color={color} />
        <Text style={styles.timingValue}>{value}</Text>
      </View>
      <Text style={styles.timingLabel}>{label}</Text>
    </View>
  );
}
function MetadataItem({
  icon,
  label,
  value,
}: {
  icon: 'measure' | 'info' | 'note';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metadataItem}>
      <Icon name={icon} size={21} color={dashboardTheme.iconStrength} />
      <View style={styles.metadataCopy}>
        <Text style={styles.metadataLabel}>{label}</Text>
        <Text style={styles.metadataValue}>{value}</Text>
      </View>
    </View>
  );
}

function totalSets(workout: Workout) {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}
function formatDateTime(value: number) {
  return (
    new Date(value).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) +
    ' · ' +
    new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}
function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}
function formatRest(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  return rounded < 60 ? `${rounded}s` : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}
function workoutTypePresentation(type: string) {
  const value = type.toLowerCase();
  if (value.includes('mobility'))
    return { icon: 'stretching' as const, color: '#AA7CE8', background: 'rgba(170,124,232,0.16)' };
  if (value.includes('court'))
    return {
      icon: 'tennis-ball' as const,
      color: dashboardTheme.iconSport || '#62C98A',
      background: 'rgba(98,201,138,0.16)',
    };
  if (value.includes('cardio'))
    return {
      icon: 'running' as const,
      color: dashboardTheme.iconActivity || '#E99A5B',
      background: 'rgba(233,154,91,0.16)',
    };
  return {
    icon: 'fitness-outline' as const,
    color: dashboardTheme.iconStrength || '#6F7FF2',
    background: 'rgba(111,127,242,0.16)',
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: dashboardTheme.background,
  },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: { padding: 16, paddingBottom: 116, gap: 12 },
  summaryCard: {
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1,
    borderColor: dashboardTheme.summaryBorder,
    borderRadius: 20,
    gap: 14,
    shadowColor: dashboardTheme.ink,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(111,127,242,0.18)',
    borderRadius: 23,
  },
  timingMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  timingMetric: { alignItems: 'flex-end', gap: 2 },
  timingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timingValue: { color: dashboardTheme.ink, fontFamily: typography.bold, fontSize: 17 },
  timingLabel: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 11 },
  summaryMain: { minHeight: 24, justifyContent: 'center' },
  summaryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  summaryDate: {
    flex: 1,
    color: dashboardTheme.slate,
    fontFamily: typography.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  metrics: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(111,127,242,0.18)',
    paddingTop: 12,
    justifyContent: 'center',
  },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricLabel: {
    color: dashboardTheme.slate,
    fontFamily: typography.medium,
    fontSize: 12,
    textAlign: 'center',
  },
  metricValue: {
    color: dashboardTheme.ink,
    fontFamily: typography.bold,
    fontSize: 19,
    textAlign: 'center',
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(111,127,242,0.18)',
    paddingTop: 12,
  },
  metadataItem: { flex: 1, minWidth: 90, flexDirection: 'row', gap: 8 },
  metadataCopy: { flex: 1 },
  metadataLabel: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 12 },
  metadataValue: {
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseList: { gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 20 },
  muted: { color: dashboardTheme.slate, fontFamily: typography.regular, fontSize: 13 },
});
