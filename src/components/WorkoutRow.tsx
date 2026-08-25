import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import { colors, typography } from '../theme/tokens';
import type { ForgeTheme, IconName, WorkoutSummary } from '../types';

export function WorkoutRow({
  workout,
  theme = colors,
}: {
  workout: WorkoutSummary;
  theme?: ForgeTheme;
}) {
  const summary =
    workout.summary ||
    `${workout.exercises?.length || 0} exercises · ${workout.exercises?.reduce((total, exercise) => total + exercise.sets.length, 0) || 0} sets`;
  const summaryItems = summary.split(' · ');
  const duration = workout.duration || formatDuration(workout.durationSeconds);
  const presentation =
    workout.type === 'Strength'
      ? {
          icon: 'fitness-outline' as IconName,
          color: theme.iconStrength || theme.accent,
          background: 'rgba(111,127,242,0.14)',
        }
      : workout.type === 'Court sport'
        ? {
            icon: 'tennis-ball' as IconName,
            color: theme.iconSport || theme.marker,
            background: 'rgba(98,201,138,0.14)',
          }
        : workout.type === 'Mobility'
          ? {
              icon: 'stretching' as IconName,
              color: theme.iconActivity || theme.accent,
              background: 'rgba(170,124,232,0.14)',
            }
          : {
              icon: 'running' as IconName,
              color: theme.iconActivity || theme.accent,
              background: 'rgba(233,154,91,0.14)',
            };
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
  name: {
    flex: 1,
    color: colors.ink,
    fontFamily: typography.semibold,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: colors.slate,
    fontFamily: typography.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 0,
  },
  pressed: { opacity: 0.65 },
});

function formatDuration(seconds = 0) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
    : `${minutes} min`;
}
