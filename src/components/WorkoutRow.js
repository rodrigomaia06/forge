import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import { colors, typography } from '../theme/tokens';

export function WorkoutRow({ workout, theme = colors }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${workout.duration}, ${workout.summary}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.divider }, pressed && styles.pressed]}
    >
      <View style={[styles.mark, { backgroundColor: theme.accent }]} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: theme.ink }]}>{workout.name}</Text>
          <Text style={[styles.duration, { color: theme.slate }]}>{workout.duration}</Text>
        </View>
        <Text style={[styles.meta, { color: theme.slate }]}>{workout.type} · {workout.summary}</Text>
      </View>
      <Icon name="chevron-forward" size={17} color={theme.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 74, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  mark: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkInteractive, marginRight: 13 },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  name: { flex: 1, color: colors.ink, fontFamily: typography.semibold, fontSize: 16, fontWeight: '600' },
  duration: { color: colors.slate, fontFamily: typography.regular, fontSize: 12 },
  meta: { color: colors.slate, fontFamily: typography.regular, fontSize: 13, marginTop: 6 },
  pressed: { opacity: 0.65 },
});
