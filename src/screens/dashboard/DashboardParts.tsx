import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardHeader } from '../../components/DashboardHeader';
import { Calendar, type CalendarMenuState } from '../../components/Calendar';
import { WorkoutRow } from '../../components/WorkoutRow';
import { AppScreen, Button, ForgeText as Text, lightHaptic } from '../../components/ui';
import { useLayoutProbe } from '../../debug/layoutProbe';
import { useSettings } from '../../state/SettingsContext';
import { useWorkouts } from '../../state/WorkoutContext';
import type { ReactElement, ReactNode } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ScrollView as ScrollViewType, StyleProp, ViewStyle } from 'react-native';
import type { ForgeTheme, RootNavigationProp, WorkoutMap, WorkoutSummary } from '../../types';
import { styles } from './dashboardStyles';
import { summarizeWorkoutTypes } from './dashboardMetrics';
import { calendarDateKey } from '../../domain/workouts/calendarDate';

export function DashboardShell({
  children,
  theme,
  calendarMenu,
  onCalendarMenuDismiss,
}: {
  children: ReactElement<{ header?: ReactNode }>;
  theme: ForgeTheme;
  calendarMenu?: CalendarMenuState | null;
  onCalendarMenuDismiss?: () => void;
}) {
  const navigation = useNavigation<RootNavigationProp>();
  const openWorkout = () => {
    lightHaptic();
    navigation.navigate('Plans', { openCreation: true });
  };
  return (
    <AppScreen testID="dashboard-app-screen" backgroundColor={theme.background} edges={['top']}>
      <View
        testID="dashboard-shell"
        style={styles.appShell}
      >
        <View style={styles.body}>
          {React.cloneElement(children, {
            header: (
              <DashboardHeader theme={theme} variant={theme.headerVariant} onStart={openWorkout} />
            ),
          })}
        </View>
        {calendarMenu && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close calendar view menu"
              onPress={() => {
                lightHaptic();
                onCalendarMenuDismiss?.();
              }}
              style={styles.calendarMenuDismiss}
            />
            <View
              style={[
                styles.calendarMenuPortal,
                { top: calendarMenu.top, right: calendarMenu.right, pointerEvents: 'box-none' },
              ]}
            >
              {calendarMenu.content}
            </View>
          </>
        )}
      </View>
    </AppScreen>
  );
}

export function DashboardCalendar({
  selectedDate,
  setSelectedDate,
  theme,
  workoutMap,
  viewMenuOpen,
  onViewMenuOpenChange,
  onMenuStateChange,
}: {
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  theme: ForgeTheme;
  workoutMap: WorkoutMap;
  viewMenuOpen?: boolean;
  onViewMenuOpenChange?: (open: boolean) => void;
  onMenuStateChange?: (state: CalendarMenuState | null) => void;
}) {
  const { preferences } = useSettings();
  return (
    <View
      style={[
        styles.calendarCard,
        { backgroundColor: 'transparent', borderRadius: theme.cardRadius },
      ]}
    >
      <Calendar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        theme={theme}
        workoutMap={workoutMap}
        workoutTypes={preferences.workoutTypes}
        viewMenuOpen={viewMenuOpen}
        onViewMenuOpenChange={onViewMenuOpenChange}
        onMenuStateChange={onMenuStateChange}
        weekStartsOn={preferences.weekStartsOn}
      />
    </View>
  );
}

export function DashboardWorkoutCard({
  selectedDate,
  selectedWorkouts,
  theme,
}: {
  selectedDate: Date;
  selectedWorkouts: WorkoutSummary[];
  theme: ForgeTheme;
}) {
  const navigation = useNavigation<RootNavigationProp>();
  return (
    <View
      style={[
        styles.dayCard,
        { backgroundColor: theme.calendarSurface || theme.surface, borderRadius: theme.cardRadius },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.selectedDate, { color: theme.ink }]}>
          {selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
        <Text style={[styles.dayCount, { color: theme.ink }]}>
          {selectedWorkouts.length} {selectedWorkouts.length === 1 ? 'workout' : 'workouts'}
        </Text>
      </View>
      {selectedWorkouts.length > 0 ? (
        <View style={[styles.workoutList, { borderTopColor: theme.divider }]}>
          {selectedWorkouts.map((workout) => (
            <WorkoutRow key={`${calendarDateKey(selectedDate)}-${workout.id}`} workout={workout} theme={theme} />
          ))}
        </View>
      ) : (
        <View style={[styles.emptyDay, { borderTopColor: theme.divider }]}>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>No workouts recorded</Text>
          <Text style={[styles.emptyCopy, { color: theme.muted }]}>
            Add a workout from this date to keep your archive complete.
          </Text>
          <Button
            label="Add historical workout"
            variant="secondary"
            onPress={() => navigation.navigate('HistoryWorkoutEditor', { mode: 'create', selectedDate: calendarDateKey(selectedDate) })}
            style={styles.secondaryAction}
            theme={theme}
          />
        </View>
      )}
    </View>
  );
}

export function DashboardContextCard({
  theme,
  compact = false,
  icons: _icons = false,
}: {
  theme: ForgeTheme;
  compact?: boolean;
  icons?: boolean;
}) {
  const { preferences } = useSettings();
  const { completedWorkouts } = useWorkouts();
  const contextProbe = useLayoutProbe('dashboard-context-card', {
    background: theme.calendarSurface,
  });
  const typeSummary = summarizeWorkoutTypes(preferences.workoutTypes, theme, completedWorkouts);
  const metrics = [
    [String(completedWorkouts.length), 'completed workouts'],
    [String(typeSummary.length), 'workout types'],
    [formatTotalDuration(completedWorkouts), 'training time'],
  ];

  return (
    <View
      ref={contextProbe.ref}
      onLayout={contextProbe.onLayout}
      testID="dashboard-context-card"
      style={[
        styles.contextCard,
        compact && styles.compactContextCard,
        { backgroundColor: theme.calendarSurface || theme.surface, borderRadius: theme.cardRadius },
      ]}
    >
      <Text style={[styles.contextTitle, { color: theme.ink }]}>Recent context</Text>
      <View
        style={[
          styles.contextRow,
          compact && styles.compactContextRow,
          { borderColor: theme.divider },
        ]}
      >
        {metrics.map(([value, label], index) => (
          <React.Fragment key={label}>
            <View style={styles.metric}>
              <Text
                style={[
                  styles.contextValue,
                  compact && styles.compactContextValue,
                  { color: theme.ink },
                ]}
              >
                {value}
              </Text>
              <Text
                style={[
                  styles.contextLabel,
                  compact && styles.compactContextLabel,
                  { color: theme.ink },
                ]}
              >
                {label}
              </Text>
            </View>
            {index < metrics.length - 1 && (
              <View style={[styles.contextDivider, { backgroundColor: theme.divider }]} />
            )}
          </React.Fragment>
        ))}
      </View>
      <View style={[styles.typeSection, { borderTopColor: theme.divider }]}>
        <Text style={[styles.typeTitle, { color: theme.ink }]}>By type</Text>
        <View style={styles.typeBar}>
          {typeSummary.map((item) => (
            <View
              key={item.type}
              style={[styles.typeBarSegment, { backgroundColor: item.color, flex: item.count }]}
            />
          ))}
        </View>
        {typeSummary.map((item) => (
          <View key={item.type} style={styles.typeRow}>
            <View style={styles.typeLabelWrap}>
              <View style={[styles.typeDot, { backgroundColor: item.color }]} />
              <Text style={[styles.typeLabel, { color: theme.ink }]}>{item.type}</Text>
            </View>
            <Text style={[styles.typeValue, { color: theme.ink }]}>
              {item.count} · {item.duration}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatTotalDuration(workouts: import('../../types').Workout[]): string {
  const minutes = Math.round(workouts.reduce((total, workout) => total + (workout.durationSeconds ?? 0), 0) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}` : `${minutes}m`;
}

export function DashboardScroll({
  children,
  style,
  header,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  header?: ReactElement<{ style?: StyleProp<ViewStyle> }>;
}) {
  const scrollProbe = useLayoutProbe<ScrollViewType>('dashboard-scroll');
  return (
    <ScrollView
      ref={scrollProbe.ref}
      onLayout={scrollProbe.onLayout}
      testID="dashboard-scroll"
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, style]}
      showsVerticalScrollIndicator={false}
    >
      {header && React.cloneElement(header, { style: styles.scrollHeader })}
      {children}
    </ScrollView>
  );
}
