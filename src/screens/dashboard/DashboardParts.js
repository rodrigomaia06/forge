import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomNavigation } from '../../components/BottomNavigation';
import { Calendar } from '../../components/Calendar';
import { WorkoutRow } from '../../components/WorkoutRow';
import { AppScreen, Button, Icon, SectionHeader } from '../../components/ui';
import { typography, spacing } from '../../theme/tokens';
import { useLayoutProbe } from '../../debug/layoutProbe';

export function DashboardShell({ children, theme }) {
  const shellProbe = useLayoutProbe('dashboard-shell', { background: theme.background });
  const dockSlotProbe = useLayoutProbe('dashboard-dock-slot', { background: 'transparent' });
  const dockCylinderProbe = useLayoutProbe('dashboard-dock-cylinder', { background: theme.dockSurface });

  return (
    <AppScreen testID="dashboard-app-screen" backgroundColor={theme.background}>
      <View ref={shellProbe.ref} onLayout={shellProbe.onLayout} testID="dashboard-shell" style={styles.appShell}>
        <View style={[styles.topBar, { backgroundColor: theme.background }]}>
          <View style={styles.titleGroup}>
            <Icon name="calendar-outline" size={22} color={theme.accent} />
            <Text style={[styles.screenTitle, { color: theme.ink }]}>Dashboard</Text>
          </View>
          <Button label="Start" accessibilityLabel="Start workout" icon="add" onPress={() => {}} theme={theme} />
        </View>
        <View style={styles.body}>{children}</View>
        <View pointerEvents="box-none" ref={dockSlotProbe.ref} onLayout={dockSlotProbe.onLayout} testID="dashboard-dock-slot" style={styles.dockSlot}>
          <View
            ref={dockCylinderProbe.ref}
            onLayout={dockCylinderProbe.onLayout}
            testID="dashboard-dock-cylinder"
            style={[styles.dockCylinder, { backgroundColor: theme.dockSurface, borderColor: theme.dockBorder }]}
          >
            <BlurView testID="dashboard-dock-blur" tint="light" intensity={62} style={styles.dockBlur} />
            <BottomNavigation theme={{ ...theme, surface: theme.surface }} />
          </View>
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

export function DashboardContextCard({ theme, icons = false, inline = false, compact = false }) {
  const contextProbe = useLayoutProbe('dashboard-context-card', { background: theme.surfaceMuted });
  const metrics = [
    ['3', 'workouts this week', theme.iconCalendar, 'calendar-outline'],
    ['8', 'workouts this month', theme.iconStrength, 'fitness-outline'],
    ['8 h 06', 'training time', theme.iconTime, 'stopwatch-outline'],
  ];

  return (
    <View
      ref={contextProbe.ref}
      onLayout={contextProbe.onLayout}
      testID="dashboard-context-card"
      style={[styles.contextCard, compact && styles.compactContextCard, inline && styles.inlineContextCard, { backgroundColor: theme.surfaceMuted, borderRadius: theme.cardRadius }]}
    >
      <SectionHeader title="Recent context" meta="This month" theme={theme} />
      <View
        style={[styles.contextRow, compact && styles.compactContextRow, { borderColor: theme.divider }]}
      >
        {metrics.map(([value, label, iconColor, iconName], index) => (
          <React.Fragment key={label}>
            <View style={styles.metric}>
              {icons && <Icon name={iconName} size={compact ? 16 : 19} color={iconColor} style={[styles.metricIcon, compact && styles.compactMetricIcon]} />}
              <Text style={[styles.contextValue, compact && styles.compactContextValue, { color: theme.ink }]}>{value}</Text>
              <Text style={[styles.contextLabel, compact && styles.compactContextLabel, { color: theme.slate }]}>{label}</Text>
            </View>
            {index < metrics.length - 1 && <View style={[styles.contextDivider, { backgroundColor: theme.divider }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export function DashboardScroll({ children, style }) {
  const scrollProbe = useLayoutProbe('dashboard-scroll');
  return <ScrollView ref={scrollProbe.ref} onLayout={scrollProbe.onLayout} testID="dashboard-scroll" style={styles.scrollView} contentContainerStyle={[styles.scrollContent, style]} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  appShell: { flex: 1 },
  topBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  screenTitle: { fontFamily: typography.bold, fontSize: 29, fontWeight: '700', letterSpacing: -0.9 },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: 16, paddingBottom: 132, gap: 14 },
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
  compactContextCard: { padding: 8 },
  inlineContextCard: { paddingVertical: 13 },
  contextRow: { flexDirection: 'row', alignItems: 'stretch', paddingTop: 14, borderTopWidth: 1 },
  compactContextRow: { paddingTop: 6 },
  metric: { flex: 1 },
  metricIcon: { marginBottom: 8 },
  compactMetricIcon: { marginBottom: 2 },
  contextValue: { fontFamily: typography.bold, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  compactContextValue: { fontSize: 18 },
  contextLabel: { fontFamily: typography.regular, fontSize: 11, marginTop: 4, maxWidth: 80, lineHeight: 15 },
  compactContextLabel: { fontSize: 10, marginTop: 2, lineHeight: 13 },
  contextDivider: { width: 1, marginHorizontal: 12 },
  dockSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dockCylinder: {
    width: '90%',
    maxWidth: 390,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 1000,
    borderWidth: 1,
    paddingHorizontal: 8,
    shadowColor: '#172431',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  dockBlur: { ...StyleSheet.absoluteFillObject, borderRadius: 1000 },
});
