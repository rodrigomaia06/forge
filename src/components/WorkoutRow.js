import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import { colors, typography } from '../theme/tokens';

export function WorkoutRow({ workout, theme = colors }) {
  const summaryItems = workout.summary.split(' · ');
  const presentation = workout.type === 'Strength'
    ? { icon: 'fitness-outline', color: theme.iconStrength || theme.accent, background: 'rgba(111,127,242,0.14)' }
    : workout.type === 'Court sport'
      ? { icon: 'tennis-ball', color: theme.iconSport || theme.marker, background: 'rgba(98,201,138,0.14)' }
      : workout.type === 'Mobility'
        ? { icon: 'stretching', color: theme.iconActivity || theme.accent, background: 'rgba(170,124,232,0.14)' }
        : { icon: 'running', color: theme.iconActivity || theme.accent, background: 'rgba(233,154,91,0.14)' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${workout.type}, ${workout.duration}, ${workout.summary}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.divider }, pressed && styles.pressed]}
    >
      <View style={[styles.typeIcon, { backgroundColor: presentation.background }]}>
        <Icon name={presentation.icon} size={23} color={presentation.color} weight="regular" />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: theme.ink }]}>{workout.name}</Text>
        </View>
        <Text style={[styles.meta, { color: theme.ink }]}>
          {summaryItems.concat(workout.duration).join('  ·  ')}
        </Text>
      </View>
      <Icon name="chevron-forward" size={17} color={theme.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 74, paddingVertical: 14, paddingLeft: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  typeIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, marginRight: 10 },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  name: { flex: 1, color: colors.ink, fontFamily: typography.semibold, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.slate, fontFamily: typography.regular, fontSize: 13, marginTop: 7 },
  pressed: { opacity: 0.65 },
});
