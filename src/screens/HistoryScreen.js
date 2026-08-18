import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Button } from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { useWorkouts } from '../state/WorkoutContext';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typography } from '../theme/tokens';

export function HistoryScreen({ navigation }) {
  const { completedWorkouts, startWorkout } = useWorkouts();
  const handleStart = () => {
    startWorkout();
    navigation.navigate('ActiveWorkout');
  };
  return <AppScreen backgroundColor={dashboardTheme.background}><View style={styles.screen}><View style={styles.header}><Text style={styles.title}>History</Text><Text style={styles.subtitle}>{completedWorkouts.length} workouts</Text></View><ScrollView contentContainerStyle={styles.content}>{completedWorkouts.length ? completedWorkouts.map((workout) => <View key={workout.id} style={styles.card}><View style={styles.cardTop}><Text style={styles.name}>{workout.name}</Text><Text style={styles.date}>{formatDate(workout.completedAt)}</Text></View><Text style={styles.meta}>{workout.type} · {workout.exercises.length} exercises · {totalSets(workout)} sets · {formatDuration(workout.durationSeconds)}</Text></View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No completed workouts</Text><Text style={styles.subtitle}>Finish a workout and it will appear here.</Text><Button label="Start a workout" onPress={handleStart} theme={dashboardTheme} style={styles.emptyAction} /></View>}</ScrollView><NavigationFooter /></View></AppScreen>;
}

function totalSets(workout) { return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0); }
function formatDate(value) { return value ? new Date(value).toLocaleDateString() : ''; }
function formatDuration(seconds = 0) { const minutes = Math.max(1, Math.round(seconds / 60)); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes} min`; }

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: dashboardTheme.divider },
  title: { color: dashboardTheme.ink, fontFamily: typography.bold, fontSize: 30, fontWeight: '700' },
  subtitle: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 13, marginTop: 4 },
  content: { padding: 16, gap: 12 },
  card: { padding: 16, backgroundColor: dashboardTheme.calendarSurface, borderRadius: dashboardTheme.cardRadius },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 17, fontWeight: '600' },
  date: { color: dashboardTheme.slate, fontFamily: typography.medium, fontSize: 12 },
  meta: { color: dashboardTheme.ink, fontFamily: typography.regular, fontSize: 13, marginTop: 8 },
  empty: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 60, gap: 5 },
  emptyTitle: { color: dashboardTheme.ink, fontFamily: typography.semibold, fontSize: 18, fontWeight: '600' },
  emptyAction: { marginTop: 14 },
});
