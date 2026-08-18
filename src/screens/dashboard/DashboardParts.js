import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomNavigation } from '../../components/BottomNavigation';
import { Calendar } from '../../components/Calendar';
import { WorkoutRow } from '../../components/WorkoutRow';
import { AppScreen, Button, Icon, SectionHeader } from '../../components/ui';
import { typography, spacing } from '../../theme/tokens';

export function DashboardShell({ children, theme, floatingDock = false }) {
  return (
    <AppScreen backgroundColor={theme.background}>
      <View style={styles.appShell}>
        <View style={[styles.topBarShell, { backgroundColor: `${theme.background}E8` }, theme.topBar && styles.blurredTopBar]}>
          <View style={styles.topBar}>
            <Text style={[styles.screenTitle, { color: theme.ink }]}>Dashboard</Text>
            <Button label="Start" accessibilityLabel="Start workout" icon="add" onPress={() => {}} theme={theme} />
          </View>
        </View>
        {children}
        <View style={floatingDock ? styles.floatingDock : null}>
          <BottomNavigation theme={theme} />
        </View>
      </View>
    </AppScreen>
  );
}

export function DashboardCalendar({ selectedDay, setSelectedDay, theme, style }) {
  return (
    <View style={[styles.calendarCard, { backgroundColor: theme.surface, borderColor: theme.divider, borderRadius: theme.cardRadius }, style]}>
      <Calendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} />
    </View>
  );
}

export function DashboardWorkoutCard({ selectedDay, selectedWorkouts, theme, rail = false, compact = false, icon = false }) {
  return (
    <View style={[styles.dayCard, compact && styles.compactDayCard, { backgroundColor: theme.surface, borderColor: theme.divider, borderRadius: theme.cardRadius }, rail && { borderLeftColor: theme.accent, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        {icon && <Icon name="calendar-clear-outline" size={19} color={theme.iconCalendar} />}
        <Text style={[styles.selectedDate, { color: theme.ink }, icon && styles.headerWithIcon]}>August {selectedDay}, 2026</Text>
        <Text style={[styles.dayCount, { color: theme.slate }]}>{selectedWorkouts.length} {selectedWorkouts.length === 1 ? 'workout' : 'workouts'}</Text>
      </View>
      {selectedWorkouts.length > 0 ? (
        <View style={[styles.workoutList, compact && styles.compactWorkoutList, { borderTopColor: theme.divider }]}>
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
  );
}

export function DashboardContextCard({ theme, icons = false, inline = false }) {
  const metrics = [
    ['3', 'workouts this week', theme.iconCalendar, 'calendar-outline'],
    ['8', 'workouts this month', theme.iconStrength, 'fitness-outline'],
    ['8 h 06', 'training time', theme.iconTime, 'stopwatch-outline'],
  ];

  return (
    <View style={[styles.contextCard, inline && styles.inlineContextCard, { backgroundColor: theme.surfaceMuted, borderRadius: theme.cardRadius }]}>
      <SectionHeader title="Recent context" meta="This month" theme={theme} />
      <View style={[styles.contextRow, { borderColor: theme.divider }]}>
        {metrics.map(([value, label, iconColor, iconName], index) => (
          <React.Fragment key={label}>
            <View style={styles.metric}>
              {icons && <Icon name={iconName} size={19} color={iconColor} style={styles.metricIcon} />}
              <Text style={[styles.contextValue, { color: theme.ink }]}>{value}</Text>
              <Text style={[styles.contextLabel, { color: theme.slate }]}>{label}</Text>
            </View>
            {index < metrics.length - 1 && <View style={[styles.contextDivider, { backgroundColor: theme.divider }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export function DashboardScroll({ children, style }) {
  return <ScrollView contentContainerStyle={[styles.scrollContent, style]} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  appShell: { flex: 1 },
  topBarShell: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  blurredTopBar: Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {},
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingTop: 10, paddingBottom: 12 },
  screenTitle: { fontFamily: typography.bold, fontSize: 29, fontWeight: '700', letterSpacing: -0.9 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: 64, paddingBottom: 24, gap: 14 },
  calendarCard: { paddingHorizontal: 14, borderWidth: 1, overflow: 'hidden' },
  dayCard: { borderWidth: 1, overflow: 'hidden' },
  compactDayCard: { borderRadius: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  selectedDate: { flex: 1, fontFamily: typography.bold, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  headerWithIcon: { flex: 1 },
  dayCount: { fontFamily: typography.regular, fontSize: 12, paddingBottom: 2 },
  workoutList: { borderTopWidth: 1, paddingHorizontal: 16 },
  compactWorkoutList: { paddingHorizontal: 12 },
  emptyDay: { padding: 16, borderTopWidth: 1 },
  emptyTitle: { fontFamily: typography.semibold, fontSize: 15, fontWeight: '600' },
  emptyCopy: { fontFamily: typography.regular, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  secondaryAction: { alignSelf: 'flex-start', marginTop: 14 },
  contextCard: { padding: 16 },
  inlineContextCard: { paddingVertical: 13 },
  contextRow: { flexDirection: 'row', alignItems: 'stretch', paddingTop: 14, borderTopWidth: 1 },
  metric: { flex: 1 },
  metricIcon: { marginBottom: 8 },
  contextValue: { fontFamily: typography.bold, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  contextLabel: { fontFamily: typography.regular, fontSize: 11, marginTop: 4, maxWidth: 80, lineHeight: 15 },
  contextDivider: { width: 1, marginHorizontal: 12 },
  floatingDock: { marginHorizontal: 12, marginBottom: 10, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#DCE2E6' },
});
