import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNavigation } from '../components/BottomNavigation';
import { Calendar } from '../components/Calendar';
import { IconButton } from '../components/IconButton';
import { WorkoutRow } from '../components/WorkoutRow';
import { workoutsByDate } from '../data/mockWorkouts';
import { colors, radii, spacing } from '../theme/tokens';

export function DashboardScreen() {
  const [selectedDay, setSelectedDay] = useState(24);
  const selectedWorkouts = workoutsByDate[selectedDay] || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appShell}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Text style={styles.screenTitle}>Dashboard</Text>
            <IconButton name="add" label="Start workout" title="Start" filled />
          </View>
          <Calendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} />
          <View style={styles.selectedDayHeader}>
            <Text style={styles.selectedDate}>August {selectedDay}, 2026</Text>
            <Text style={styles.dayCount}>{selectedWorkouts.length} {selectedWorkouts.length === 1 ? 'workout' : 'workouts'}</Text>
          </View>
          {selectedWorkouts.length > 0 ? (
            <View style={styles.workoutList}>{selectedWorkouts.map((workout) => <WorkoutRow key={`${selectedDay}-${workout.name}`} workout={workout} />)}</View>
          ) : (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyTitle}>No workouts recorded</Text>
              <Text style={styles.emptyCopy}>Add a workout from this date to keep your archive complete.</Text>
              <Pressable style={styles.secondaryAction} accessibilityRole="button"><Text style={styles.secondaryActionText}>Add historical workout</Text></Pressable>
            </View>
          )}
          <View style={styles.contextSection}>
            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Recent context</Text><Text style={styles.sectionMeta}>This month</Text></View>
            <View style={styles.contextRow}>
              <View><Text style={styles.contextValue}>3</Text><Text style={styles.contextLabel}>workouts this week</Text></View>
              <View style={styles.contextDivider} />
              <View><Text style={styles.contextValue}>8</Text><Text style={styles.contextLabel}>workouts this month</Text></View>
              <View style={styles.contextDivider} />
              <View><Text style={styles.contextValue}>8 h 06</Text><Text style={styles.contextLabel}>training time</Text></View>
            </View>
          </View>
        </ScrollView>
        <BottomNavigation />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  appShell: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 24 },
  screenTitle: { color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  selectedDayHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 12 },
  selectedDate: { color: colors.ink, fontSize: 19, fontWeight: '600', letterSpacing: -0.2 },
  dayCount: { color: colors.slate, fontSize: 13, paddingBottom: 2 },
  workoutList: { borderTopWidth: 1, borderTopColor: colors.divider },
  emptyDay: { paddingVertical: 21, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: colors.divider },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  emptyCopy: { color: colors.slate, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  secondaryAction: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.divider, borderRadius: radii.secondaryAction },
  secondaryActionText: { color: colors.inkInteractive, fontSize: 13, fontWeight: '600' },
  contextSection: { paddingTop: spacing.section, paddingBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  sectionMeta: { color: colors.muted, fontSize: 12 },
  contextRow: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider },
  contextValue: { color: colors.ink, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  contextLabel: { color: colors.slate, fontSize: 11, marginTop: 4, maxWidth: 80, lineHeight: 15 },
  contextDivider: { width: 1, backgroundColor: colors.divider, marginHorizontal: 14 },
});
