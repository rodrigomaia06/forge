import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ForgeText as Text, Icon } from './ui';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { useSettings } from '../state/SettingsContext';
import { colors, typeScale } from '../theme/tokens';
import type { ForgeTheme, WorkoutSummary } from '../types';

export function WorkoutRow({
  workout,
  theme = colors,
}: {
  workout: WorkoutSummary;
  theme?: ForgeTheme;
}) {
  const { preferences } = useSettings();
  const summary =
    workout.summary ||
    `${workout.exercises?.length || 0} exercises · ${workout.exercises?.reduce((total, exercise) => total + exercise.sets.length, 0) || 0} sets`;
  const summaryItems = summary.split(' · ');
  const duration = workout.duration || formatDuration(workout.durationSeconds);
  const presentation = getWorkoutTypePresentation(workout.type, preferences.workoutTypes, theme, 0.14);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${workout.type}, ${duration}, ${summary}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.typeIcon, { backgroundColor: presentation.background }]}>
        <Icon name={presentation.icon} size={23} color={presentation.color} weight="regular" />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: theme.ink }]}>{workout.name}</Text>
        </View>
        <Text style={[styles.meta, { color: theme.ink }]}>
          {summaryItems.concat(duration).join('  ·  ')}
        </Text>
      </View>
      <Icon name="chevron-forward" size={17} color={theme.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 6,
    paddingLeft: 4,
  },
  typeIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginRight: 10,
  },
  copy: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  name: { flex: 1, color: colors.ink, ...typeScale.cardTitle },
  meta: { color: colors.slate, ...typeScale.label, marginTop: 0 },
  pressed: { opacity: 0.65 },
});

function formatDuration(seconds = 0) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
    : `${minutes} min`;
}
