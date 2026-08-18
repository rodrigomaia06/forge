import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from './IconButton';
import { monthDays, workoutsByDate } from '../data/mockWorkouts';
import { colors, radii } from '../theme/tokens';

export function Calendar({ selectedDay, setSelectedDay }) {
  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <View>
          <Text style={styles.monthTitle}>August 2026</Text>
          <Text style={styles.monthSubtitle}>7 workout days · 8 workouts</Text>
        </View>
        <View style={styles.monthControls}>
          <IconButton name="chevron-back" label="Previous month" />
          <IconButton name="chevron-forward" label="Next month" />
        </View>
      </View>
      <View style={styles.weekHeader}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekLabel}>{day}</Text>)}
      </View>
      <View style={styles.grid}>
        {monthDays.map((day) => {
          const dayWorkouts = workoutsByDate[day];
          const isSelected = day === selectedDay;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${day} August 2026${dayWorkouts ? ', workout recorded' : ''}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedDay(day)}
              style={({ pressed }) => [styles.dayCell, isSelected && styles.selectedDay, pressed && styles.pressed]}
            >
              <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{day}</Text>
              {dayWorkouts && <View style={styles.markers}>{dayWorkouts.slice(0, 2).map((_, markerIndex) => <View key={markerIndex} style={[styles.marker, isSelected && styles.selectedMarker]} />)}</View>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { paddingTop: 20, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.divider },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  monthTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  monthSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  monthControls: { flexDirection: 'row', gap: 8 },
  weekHeader: { flexDirection: 'row', marginBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: radii.selectedDay, position: 'relative' },
  selectedDay: { backgroundColor: colors.ink },
  dayText: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  selectedDayText: { color: colors.surface, fontWeight: '700' },
  markers: { position: 'absolute', bottom: 5, flexDirection: 'row', gap: 3 },
  marker: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.inkInteractive },
  selectedMarker: { backgroundColor: colors.surface },
  pressed: { opacity: 0.65 },
});
