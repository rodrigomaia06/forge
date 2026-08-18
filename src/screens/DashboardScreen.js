import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNavigation } from '../components/BottomNavigation';
import { Calendar } from '../components/Calendar';
import { WorkoutRow } from '../components/WorkoutRow';
import { AppScreen, Button, SectionHeader } from '../components/ui';
import { workoutsByDate } from '../data/mockWorkouts';
import { dashboardTheme } from '../theme/dashboardTheme';
import { spacing, typography } from '../theme/tokens';

export function DashboardScreen() {
  const theme = dashboardTheme;
  const [selectedDay, setSelectedDay] = useState(24);
  const selectedWorkouts = workoutsByDate[selectedDay] || [];

  return (
    <AppScreen backgroundColor={theme.background}>
      <View style={styles.appShell}>
        <View style={[styles.topBarShell, { backgroundColor: `${theme.background}E8` }, theme.topBar && styles.blurredTopBar]}>
          <View style={styles.topBar}>
            <Text style={[styles.screenTitle, { color: theme.ink }]}>Dashboard</Text>
            <Button label="Start" accessibilityLabel="Start workout" icon="add" onPress={() => {}} theme={theme} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={[styles.calendarCard, { backgroundColor: theme.surface, borderColor: theme.divider, borderRadius: theme.cardRadius }]}>
            <Calendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} />
          </View>

          <View style={[styles.dayCard, { backgroundColor: theme.surface, borderColor: theme.divider, borderRadius: theme.cardRadius }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.selectedDate, { color: theme.ink }]}>August {selectedDay}, 2026</Text>
              <Text style={[styles.dayCount, { color: theme.slate }]}>{selectedWorkouts.length} {selectedWorkouts.length === 1 ? 'workout' : 'workouts'}</Text>
            </View>
            {selectedWorkouts.length > 0 ? (
              <View style={[styles.workoutList, { borderTopColor: theme.divider }]}>
                {selectedWorkouts.map((workout) => <WorkoutRow key={`${selectedDay}-${workout.name}`} workout={workout} theme={theme} />)}
              </View>
            ) : (
              <View style={[styles.emptyDay, { borderTopColor: theme.divider }]}>
                <Text style={[styles.emptyTitle, { color: theme.ink }]}>No workouts recorded</Text>
                <Text style={[styles.emptyCopy, { color: theme.slate }]}>Add a workout from this date to keep your archive complete.</Text>
                <Button label="Add historical workout" variant="secondary" onPress={() => {}} style={styles.secondaryAction} theme={theme} />
              </View>
            )}
          </View>

          <View style={[styles.contextCard, { backgroundColor: theme.surfaceMuted, borderRadius: theme.cardRadius }]}>
            <SectionHeader title="Recent context" meta="This month" theme={theme} />
            <View style={[styles.contextRow, { borderColor: theme.divider }]}>
              <Metric value="3" label="workouts this week" theme={theme} />
              <View style={[styles.contextDivider, { backgroundColor: theme.divider }]} />
              <Metric value="8" label="workouts this month" theme={theme} />
              <View style={[styles.contextDivider, { backgroundColor: theme.divider }]} />
              <Metric value="8 h 06" label="training time" theme={theme} />
            </View>
          </View>
        </ScrollView>
        <BottomNavigation theme={theme} />
      </View>
    </AppScreen>
  );
}

function Metric({ value, label, theme }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.contextValue, { color: theme.ink }]}>{value}</Text>
      <Text style={[styles.contextLabel, { color: theme.slate }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: 64, paddingBottom: 24, gap: 14 },
  topBarShell: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  blurredTopBar: Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {},
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingTop: 10, paddingBottom: 12 },
  screenTitle: { fontFamily: typography.bold, fontSize: 29, fontWeight: '700', letterSpacing: -0.9 },
  calendarCard: { paddingHorizontal: 14, borderWidth: 1, overflow: 'hidden' },
  dayCard: { borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  selectedDate: { fontFamily: typography.bold, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  dayCount: { fontFamily: typography.regular, fontSize: 12, paddingBottom: 2 },
  workoutList: { borderTopWidth: 1, paddingHorizontal: 16 },
  emptyDay: { padding: 16, borderTopWidth: 1 },
  emptyTitle: { fontFamily: typography.semibold, fontSize: 15, fontWeight: '600' },
  emptyCopy: { fontFamily: typography.regular, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  secondaryAction: { alignSelf: 'flex-start', marginTop: 14 },
  contextCard: { padding: 16 },
  contextRow: { flexDirection: 'row', alignItems: 'stretch', paddingTop: 14, borderTopWidth: 1 },
  metric: { flex: 1 },
  contextValue: { fontFamily: typography.bold, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  contextLabel: { fontFamily: typography.regular, fontSize: 11, marginTop: 4, maxWidth: 80, lineHeight: 15 },
  contextDivider: { width: 1, marginHorizontal: 12 },
});
