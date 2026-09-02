import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeText as Text,
  HeaderAction,
  HeaderEdge,
  Icon,
  selectionHaptic,
} from '../components/ui';
import {
  countWorkoutSets,
  formatCompactDuration,
  getWorkoutTypePresentation,
} from '../domain/workouts/presentation';
import { ReadOnlyExerciseSection } from './activeWorkout/ExerciseSection';
import { WorkoutOptionsSheet } from './activeWorkout/WorkoutSheets';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { RootStackParamList, Workout } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutDetails'>;

export function WorkoutDetailsScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { ready, completedWorkouts, deleteCompletedWorkout } = useWorkouts();
  const { preferences } = useSettings();
  const [optionsOpen, setOptionsOpen] = useState(false);
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
    <AppScreen backgroundColor={theme.background}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <HeaderAction
            accessibilityLabel="Back to History"
            icon="chevron-back"
            label="Back"
            iconOnly
            onPress={() => {
              returnToHistory();
            }}
          />
          <HeaderEdge />
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <WorkoutSummaryCard workout={workout} workoutTypes={preferences.workoutTypes} />
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
            navigation.navigate('HistoryWorkoutEditor', { workoutId: workout.id });
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

function WorkoutSummaryCard({
  workout,
  workoutTypes,
}: {
  workout: Workout;
  workoutTypes: import('../types').WorkoutTypePreference[];
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const type = getWorkoutTypePresentation(workout.type, workoutTypes, theme, 0.16);
  const duration = formatCompactDuration(workout.durationSeconds ?? 0);
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
            <Stop offset="0" stopColor={theme.summaryGradientStart} />
            <Stop offset="1" stopColor={theme.summaryGradientEnd} />
          </LinearGradient>
        </Defs>
        <Rect width={cardSize.width} height={cardSize.height} fill="url(#workoutSummaryGradient)" />
        <Circle
          cx={cardSize.width * 0.94}
          cy={cardSize.height * 0.22}
          r={Math.max(cardSize.width, cardSize.height) * 0.52}
          fill={theme.summaryGlow}
          opacity={0.2}
        />
      </Svg>
      <View style={styles.summaryTop}>
        <View style={[styles.summaryIcon, { backgroundColor: type.background }]}>
          <Icon name={type.icon} size={30} color={type.color} />
        </View>
        <View style={styles.timingMetrics}>
          <TimingMetric icon="time-outline" label="Duration" value={duration} color={theme.slate} />
          <TimingMetric
            icon="time-outline"
            label="Avg rest / set"
            value={
              workout.averageRestSeconds === undefined
                ? '—'
                : formatRest(workout.averageRestSeconds)
            }
            color={theme.slate}
          />
        </View>
      </View>
      <View style={styles.summaryMain}>
        <View style={styles.summaryDateRow}>
          <Icon name="calendar" size={16} color={theme.slate} />
          <Text style={styles.summaryDate}>
            {formatDateTime(workout.completedAt ?? workout.startedAt)}
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        {metric('Exercises', String(workout.exercises.length))}
        {metric('Sets', String(countWorkoutSets(workout)))}
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
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
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
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metadataItem}>
      <Icon name={icon} size={21} color={theme.slate} />
      <View style={styles.metadataCopy}>
        <Text style={styles.metadataLabel}>{label}</Text>
        <Text style={styles.metadataValue}>{value}</Text>
      </View>
    </View>
  );
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
function formatRest(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  return rounded < 60 ? `${rounded}s` : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
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
    content: { padding: 16, paddingBottom: 32, gap: 12 },
    summaryCard: {
      overflow: 'hidden',
      padding: 16,
      borderWidth: 1,
      borderColor: theme.summaryBorder,
      borderRadius: 20,
      gap: 14,
      shadowColor: theme.shadow,
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
      borderColor: theme.border,
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
    timingValue: { color: theme.ink, ...typeScale.cardTitle },
    timingLabel: { color: theme.slate, ...typeScale.caption },
    summaryMain: { minHeight: 24, justifyContent: 'center' },
    summaryDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 2,
    },
    summaryDate: { flex: 1, color: theme.slate, ...typeScale.caption },
    metrics: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      paddingTop: 12,
      justifyContent: 'center',
    },
    metric: { flex: 1, alignItems: 'center', gap: 3 },
    metricLabel: { color: theme.slate, ...typeScale.caption, textAlign: 'center' },
    metricValue: { color: theme.ink, ...typeScale.metricMedium, textAlign: 'center' },
    metadata: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      paddingTop: 12,
    },
    metadataItem: { flex: 1, minWidth: 90, flexDirection: 'row', gap: 8 },
    metadataCopy: { flex: 1 },
    metadataLabel: { color: theme.slate, ...typeScale.caption },
    metadataValue: { color: theme.ink, ...typeScale.supporting },
    exerciseList: { gap: 10 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
    title: { color: theme.ink, ...typeScale.sectionTitle },
    muted: { color: theme.slate, ...typeScale.label },
  });
