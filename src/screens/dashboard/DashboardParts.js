import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { DashboardHeader } from '../../components/DashboardHeader';
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
        <View style={styles.body}>{React.cloneElement(children, { header: <DashboardHeader theme={theme} variant={theme.headerVariant} /> })}</View>
        <View pointerEvents="box-none" ref={dockSlotProbe.ref} onLayout={dockSlotProbe.onLayout} testID="dashboard-dock-slot" style={styles.dockSlot}>
          <Svg pointerEvents="none" testID="dashboard-dock-vignette" style={styles.dockVignette}>
            <Defs>
              <LinearGradient id="forgeDockBottomFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.background} stopOpacity="0" />
                <Stop offset="1" stopColor={theme.background} stopOpacity="0.9" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#forgeDockBottomFade)" />
          </Svg>
          <View
            ref={dockCylinderProbe.ref}
            onLayout={dockCylinderProbe.onLayout}
            testID="dashboard-dock-cylinder"
            style={[styles.dockCylinder, { backgroundColor: theme.dockSurface, borderColor: theme.dockBorder }]}
          >
            <BlurView testID="dashboard-dock-blur" tint="light" intensity={18} style={styles.dockBlur} />
            <BottomNavigation theme={{ ...theme, surface: theme.surface }} />
          </View>
          <View
            testID="dashboard-dock-home-indicator"
            accessibilityLabel="Home indicator"
            style={[styles.dockHomeIndicator, { backgroundColor: theme.ink }]}
          />
        </View>
      </View>
    </AppScreen>
  );
}

export function DashboardCalendar({ selectedDay, setSelectedDay, theme, style }) {
  return (
    <View style={[styles.calendarCard, { backgroundColor: 'transparent', borderRadius: theme.cardRadius }, style]}>
      <Calendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} theme={theme} />
    </View>
  );
}

export function DashboardWorkoutCard({ selectedDay, selectedWorkouts, theme, rail = false, compact = false }) {
  return (
    <View style={[styles.dayCard, compact && styles.compactDayCard, { backgroundColor: theme.calendarSurface || theme.surface, borderRadius: theme.cardRadius }, rail && { borderLeftColor: theme.accent, borderLeftWidth: 3 }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.selectedDate, { color: theme.ink }]}>August {selectedDay}, 2026</Text>
        <Text style={[styles.dayCount, { color: theme.ink }]}>{selectedWorkouts.length} {selectedWorkouts.length === 1 ? 'workout' : 'workouts'}</Text>
      </View>
      {selectedWorkouts.length > 0 ? (
        <View style={[styles.workoutList, compact && styles.compactWorkoutList, { borderTopColor: theme.divider }]}>
          {selectedWorkouts.map((workout) => <WorkoutRow key={`${selectedDay}-${workout.name}`} workout={workout} theme={theme} />)}
        </View>
      ) : (
        <View style={[styles.emptyDay, { borderTopColor: theme.divider }]}>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>No workouts recorded</Text>
          <Text style={[styles.emptyCopy, { color: theme.muted }]}>Add a workout from this date to keep your archive complete.</Text>
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
              <Text style={[styles.contextLabel, compact && styles.compactContextLabel, { color: theme.muted }]}>{label}</Text>
            </View>
            {index < metrics.length - 1 && <View style={[styles.contextDivider, { backgroundColor: theme.divider }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export function DashboardScroll({ children, style, header }) {
  const scrollProbe = useLayoutProbe('dashboard-scroll');
  return <ScrollView ref={scrollProbe.ref} onLayout={scrollProbe.onLayout} testID="dashboard-scroll" style={styles.scrollView} contentContainerStyle={[styles.scrollContent, style]} showsVerticalScrollIndicator={false}>
    {header && React.cloneElement(header, { style: styles.scrollHeader })}
    {children}
  </ScrollView>;
}

const styles = StyleSheet.create({
  appShell: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: 0, paddingBottom: 132, gap: 14 },
  scrollHeader: { marginHorizontal: -spacing.screen },
  calendarCard: { position: 'relative', zIndex: 10, marginHorizontal: 0, paddingHorizontal: 0, borderWidth: 0, overflow: 'visible' },
  dayCard: { borderWidth: 0, overflow: 'hidden' },
  compactDayCard: { borderRadius: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  selectedDate: { flex: 1, fontFamily: typography.bold, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
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
  metricIcon: { marginBottom: 8, opacity: 0.72 },
  compactMetricIcon: { marginBottom: 2 },
  contextValue: { fontFamily: typography.bold, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  compactContextValue: { fontSize: 18 },
  contextLabel: { fontFamily: typography.medium, fontSize: 11.5, marginTop: 4, maxWidth: 86, lineHeight: 16 },
  compactContextLabel: { fontSize: 11, marginTop: 2, lineHeight: 14 },
  contextDivider: { width: 1, marginHorizontal: 12 },
  dockSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    zIndex: 10,
  },
  dockVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 20,
    zIndex: 0,
  },
  dockHomeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 88,
    height: 4,
    borderRadius: 1000,
    opacity: 0.72,
    zIndex: 12,
  },
  dockCylinder: {
    width: '88%',
    maxWidth: 390,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 1000,
    borderWidth: 1,
    paddingHorizontal: 6,
    shadowColor: '#172431',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  dockBlur: { ...StyleSheet.absoluteFillObject, borderRadius: 1000, opacity: 0 },
});
