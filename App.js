import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  background: '#F6F7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F3',
  ink: '#172431',
  inkInteractive: '#284C68',
  slate: '#62717D',
  muted: '#8A969E',
  divider: '#DCE2E6',
  success: '#39745E',
};

const workoutsByDate = {
  3: [
    { name: 'Upper strength', type: 'Strength', duration: '58 min', summary: '5 exercises · 18 sets' },
  ],
  6: [
    { name: 'Lower strength', type: 'Strength', duration: '1 h 04 min', summary: '6 exercises · 21 sets' },
  ],
  10: [
    { name: 'Upper strength', type: 'Strength', duration: '52 min', summary: '5 exercises · 16 sets' },
    { name: 'Court session', type: 'Court sport', duration: '1 h 12 min', summary: 'Duration-based · 1 session' },
  ],
  13: [
    { name: 'Pull + posterior', type: 'Strength', duration: '47 min', summary: '5 exercises · 15 sets' },
  ],
  17: [
    { name: 'Lower strength', type: 'Strength', duration: '1 h 01 min', summary: '6 exercises · 20 sets' },
  ],
  20: [
    { name: 'Upper strength', type: 'Strength', duration: '55 min', summary: '5 exercises · 17 sets' },
  ],
  24: [
    { name: 'Full body', type: 'Strength', duration: '1 h 09 min', summary: '7 exercises · 23 sets' },
  ],
};

const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
const leadingEmptyDays = 0;

function IconButton({ name, label, onPress, filled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, filled && styles.iconButtonFilled, pressed && styles.pressed]}
    >
      <Ionicons name={name} size={20} color={filled ? colors.surface : colors.ink} />
    </Pressable>
  );
}

function WorkoutRow({ workout }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${workout.duration}, ${workout.summary}`}
      style={({ pressed }) => [styles.workoutRow, pressed && styles.pressed]}
    >
      <View style={styles.workoutMark} />
      <View style={styles.workoutCopy}>
        <View style={styles.workoutTitleRow}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          <Text style={styles.workoutDuration}>{workout.duration}</Text>
        </View>
        <Text style={styles.workoutMeta}>{workout.type} · {workout.summary}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>
  );
}

function Calendar({ selectedDay, setSelectedDay }) {
  const cells = useMemo(() => [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...monthDays,
  ], []);

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.monthTitle}>August 2026</Text>
          <Text style={styles.monthSubtitle}>Training archive</Text>
        </View>
        <View style={styles.monthControls}>
          <IconButton name="chevron-back" label="Previous month" />
          <IconButton name="chevron-forward" label="Next month" />
        </View>
      </View>

      <View style={styles.weekHeader}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.weekLabel}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((day, index) => {
          const hasWorkout = Boolean(day && workoutsByDate[day]);
          const isSelected = day === selectedDay;
          return (
            <Pressable
              key={`${day || 'empty'}-${index}`}
              disabled={!day}
              accessibilityRole="button"
              accessibilityLabel={day ? `${day} August 2026${hasWorkout ? ', workout recorded' : ''}` : undefined}
              accessibilityState={{ selected: isSelected }}
              onPress={() => day && setSelectedDay(day)}
              style={({ pressed }) => [
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                pressed && styles.pressed,
              ]}
            >
              {day && <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>}
              {hasWorkout && (
                <View style={styles.dayMarkers}>
                  {workoutsByDate[day].slice(0, 2).map((_, markerIndex) => (
                    <View key={markerIndex} style={[styles.dayMarker, isSelected && styles.dayMarkerSelected]} />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BottomNavigation() {
  const items = [
    ['calendar-outline', 'Dashboard', true],
    ['layers-outline', 'Plans', false],
    ['time-outline', 'History', false],
    ['ellipsis-horizontal', 'More', false],
  ];

  return (
    <View style={styles.navigation}>
      {items.map(([icon, label, active]) => (
        <Pressable key={label} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} style={styles.navItem}>
          <Ionicons name={active ? icon.replace('-outline', '') : icon} size={22} color={active ? colors.inkInteractive : colors.slate} />
          <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function App() {
  const [selectedDay, setSelectedDay] = useState(24);
  const selectedWorkouts = workoutsByDate[selectedDay] || [];
  const selectedDateLabel = `Monday, August ${selectedDay}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appShell}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.eyebrow}>YOUR TRAINING</Text>
              <Text style={styles.screenTitle}>Dashboard</Text>
            </View>
            <IconButton name="add" label="Start or add workout" filled />
          </View>

          <View style={styles.archiveSummary}>
            <View>
              <Text style={styles.archiveKicker}>AUGUST AT A GLANCE</Text>
              <Text style={styles.archiveTitle}>7 training days</Text>
            </View>
            <Text style={styles.archiveDetail}>8 workouts recorded</Text>
          </View>

          <Calendar selectedDay={selectedDay} setSelectedDay={setSelectedDay} />

          <View style={styles.selectedDayHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>SELECTED DAY</Text>
              <Text style={styles.selectedDate}>{selectedDateLabel}</Text>
            </View>
            <Text style={styles.dayCount}>{selectedWorkouts.length} {selectedWorkouts.length === 1 ? 'workout' : 'workouts'}</Text>
          </View>

          {selectedWorkouts.length > 0 ? (
            <View style={styles.workoutList}>
              {selectedWorkouts.map((workout) => <WorkoutRow key={`${selectedDay}-${workout.name}`} workout={workout} />)}
            </View>
          ) : (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyTitle}>No workouts recorded</Text>
              <Text style={styles.emptyCopy}>Add a workout from this date to keep your archive complete.</Text>
              <Pressable style={styles.secondaryAction} accessibilityRole="button">
                <Text style={styles.secondaryActionText}>Add historical workout</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.contextSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent context</Text>
              <Text style={styles.sectionMeta}>This month</Text>
            </View>
            <View style={styles.contextRow}>
              <View>
                <Text style={styles.contextValue}>3</Text>
                <Text style={styles.contextLabel}>workouts this week</Text>
              </View>
              <View style={styles.contextDivider} />
              <View>
                <Text style={styles.contextValue}>8</Text>
                <Text style={styles.contextLabel}>workouts this month</Text>
              </View>
              <View style={styles.contextDivider} />
              <View>
                <Text style={styles.contextValue}>8 h 06</Text>
                <Text style={styles.contextLabel}>training time</Text>
              </View>
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 24 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 5 },
  screenTitle: { color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  iconButton: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  iconButtonFilled: { backgroundColor: colors.inkInteractive },
  pressed: { opacity: 0.65 },
  archiveSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: colors.divider },
  archiveKicker: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginBottom: 5 },
  archiveTitle: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  archiveDetail: { color: colors.slate, fontSize: 13, paddingBottom: 1 },
  calendar: { paddingTop: 20, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.divider },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  monthTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  monthSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  monthControls: { flexDirection: 'row', gap: 8 },
  weekHeader: { flexDirection: 'row', marginBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 13, position: 'relative' },
  dayCellSelected: { backgroundColor: colors.ink },
  dayText: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  dayTextSelected: { color: colors.surface, fontWeight: '700' },
  dayMarkers: { position: 'absolute', bottom: 5, flexDirection: 'row', gap: 3 },
  dayMarker: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.inkInteractive },
  dayMarkerSelected: { backgroundColor: colors.surface },
  selectedDayHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 12 },
  sectionEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginBottom: 5 },
  selectedDate: { color: colors.ink, fontSize: 19, fontWeight: '600', letterSpacing: -0.2 },
  dayCount: { color: colors.slate, fontSize: 13, paddingBottom: 2 },
  workoutList: { borderTopWidth: 1, borderTopColor: colors.divider },
  workoutRow: { flexDirection: 'row', alignItems: 'center', minHeight: 74, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  workoutMark: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkInteractive, marginRight: 13 },
  workoutCopy: { flex: 1 },
  workoutTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  workoutName: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '600' },
  workoutDuration: { color: colors.slate, fontSize: 12 },
  workoutMeta: { color: colors.slate, fontSize: 12, marginTop: 6 },
  emptyDay: { paddingVertical: 21, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: colors.divider },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  emptyCopy: { color: colors.slate, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  secondaryAction: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.divider, borderRadius: 10 },
  secondaryActionText: { color: colors.inkInteractive, fontSize: 13, fontWeight: '600' },
  contextSection: { paddingTop: 28, paddingBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  sectionMeta: { color: colors.muted, fontSize: 12 },
  contextRow: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 16, paddingHorizontal: 15, backgroundColor: colors.surface, borderRadius: 15 },
  contextValue: { color: colors.ink, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  contextLabel: { color: colors.slate, fontSize: 11, marginTop: 4, maxWidth: 80, lineHeight: 15 },
  contextDivider: { width: 1, backgroundColor: colors.divider, marginHorizontal: 14 },
  navigation: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', minHeight: 76, paddingBottom: 7, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 64, minHeight: 48, gap: 4 },
  navLabel: { color: colors.slate, fontSize: 11, fontWeight: '500' },
  navLabelActive: { color: colors.inkInteractive, fontWeight: '700' },
});
