import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardHeader } from '../../components/DashboardHeader';
import { Calendar, type CalendarMenuState } from '../../components/Calendar';
import { WorkoutRow } from '../../components/WorkoutRow';
import {
  AppScreen,
  Button,
  ForgeActionSheet,
  ForgeBackButton,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeSheetHeader,
  ForgeText as Text,
  Icon,
  lightHaptic,
  pressedFeedbackSubtle,
  selectionHaptic,
} from '../../components/ui';
import { useLayoutProbe } from '../../debug/layoutProbe';
import { useForgeDockScrollInset } from '../../components/DockChrome';
import { useSettings } from '../../state/SettingsContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { routineExercisesWithNextSessionTargets } from '../../domain/workouts/nextSessionTargets';
import { usePlans } from '../../state/PlansContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { ReactElement, ReactNode } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ScrollView as ScrollViewType, StyleProp, ViewStyle } from 'react-native';
import type { ForgeTheme, RootNavigationProp, WorkoutMap, WorkoutSummary } from '../../types';
import { styles } from './dashboardStyles';
import { summarizeWorkoutTypes } from './dashboardMetrics';
import { calendarDateKey } from '../../domain/workouts/calendarDate';
import { workoutTypeIcon } from '../settings/workoutTypeIcon';

type DashboardRoutineSourceStep = 'routine-list' | { planId: string } | null;

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
  const { startWorkout, completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const [workoutSourceOpen, setWorkoutSourceOpen] = React.useState(false);
  const [routineSourceStep, setRoutineSourceStep] = React.useState<DashboardRoutineSourceStep>(null);
  const openWorkout = () => {
    lightHaptic();
    setWorkoutSourceOpen(true);
  };
  const startBlankWorkout = () => {
    startWorkout();
    // The destination mounts the picker as visible, so it still makes its
    // normal bottom-sheet entrance instead of flashing an empty workout.
    navigation.navigate('ActiveWorkout', { openAddExercises: 'open' });
  };
  const startRoutineWorkout = (routine: import('../../types').WorkoutRoutine, plan?: import('../../types').WorkoutPlan) => {
    selectionHaptic();
    startWorkout({
      name: plan ? `${plan.name} - ${routine.name}` : routine.name,
      type: routine.type,
      note: routine.note,
      attributes: routine.attributes
        ? Object.fromEntries(Object.keys(routine.attributes).map((label) => [label, '']))
        : undefined,
      attributeIcons: routine.attributeIcons,
      routineId: routine.id,
      planId: plan?.id ?? routine.planId,
      exercises: routineExercisesWithNextSessionTargets(routine, completedWorkouts),
    });
    setRoutineSourceStep(null);
    navigation.navigate('ActiveWorkout');
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
        <ForgeActionSheet
          visible={workoutSourceOpen}
          onClose={() => setWorkoutSourceOpen(false)}
          accessibilityLabel="Dismiss workout source chooser"
          title="Start workout"
          testID="dashboard-workout-source-chooser"
          waitForContentLayoutBeforeEnter
          actions={[
            {
              label: 'Blank workout',
              description: 'Choose exercises for a new session',
              icon: 'fitness',
              onPress: startBlankWorkout,
            },
            {
              label: 'From routine or plan',
              description: 'Use one of your saved templates',
              icon: 'book',
              onPress: () => {
                setWorkoutSourceOpen(false);
                setRoutineSourceStep('routine-list');
              },
            },
          ]}
        />
        <DashboardRoutineSourceSheet
          step={routineSourceStep}
          plans={plans}
          standaloneRoutines={standaloneRoutines}
          onClose={() => {
            setRoutineSourceStep(null);
            setWorkoutSourceOpen(true);
          }}
          onBack={() => setRoutineSourceStep('routine-list')}
          onChoosePlan={(planId) => setRoutineSourceStep({ planId })}
          onSelectRoutine={startRoutineWorkout}
        />
      </View>
    </AppScreen>
  );
}

function DashboardRoutineSourceSheet({
  step,
  plans,
  standaloneRoutines,
  onClose,
  onBack,
  onChoosePlan,
  onSelectRoutine,
}: {
  step: DashboardRoutineSourceStep;
  plans: import('../../types').WorkoutPlan[];
  standaloneRoutines: import('../../types').WorkoutRoutine[];
  onClose: () => void;
  onBack: () => void;
  onChoosePlan: (planId: string) => void;
  onSelectRoutine: (routine: import('../../types').WorkoutRoutine, plan?: import('../../types').WorkoutPlan) => void;
}) {
  const theme = useForgeTheme();
  const sourceStyles = useThemedStyles(createRoutineSourceStyles);
  const selectedPlan = step && typeof step === 'object' ? plans.find((plan) => plan.id === step.planId) : undefined;
  return (
    <ForgeBottomSheet
      visible={step !== null}
      onClose={onClose}
      accessibilityLabel="Close routine chooser"
      initialOffset={440}
      closeDistance={480}
      dragEnabled={false}
      style={sourceStyles.sheet}
    >
      {() => (
        <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={selectedPlan ? selectedPlan.name : 'Choose routine'}
            onClose={onClose}
            leading={selectedPlan ? <ForgeBackButton accessibilityLabel="Back to routines" onPress={onBack} /> : undefined}
          />
          <ScrollView contentContainerStyle={sourceStyles.content} showsVerticalScrollIndicator={false}>
            {selectedPlan ? (
              selectedPlan.routines.length ? (
                <DashboardRoutineChoiceCard routines={selectedPlan.routines} onPress={(routine) => onSelectRoutine(routine, selectedPlan)} />
              ) : <Text style={sourceStyles.empty}>This plan has no routines yet.</Text>
            ) : (
              <>
                {standaloneRoutines.length ? <View style={sourceStyles.group}>
                  <Text style={sourceStyles.label}>Standalone routines</Text>
                  <DashboardRoutineChoiceCard routines={standaloneRoutines} onPress={(routine) => onSelectRoutine(routine)} />
                </View> : null}
                {plans.length ? <View style={sourceStyles.group}>
                  <Text style={sourceStyles.label}>Plans</Text>
                  <ForgeCard variant="nested" size="compact">
                    {plans.map((plan, index) => (
                      <Pressable
                        key={plan.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Choose routine from ${plan.name}`}
                        onPress={() => {
                          lightHaptic();
                          onChoosePlan(plan.id);
                        }}
                        style={({ pressed }) => [sourceStyles.row, index > 0 && sourceStyles.divider, pressed && pressedFeedbackSubtle]}
                      >
                        <Icon name="layers" size={21} color={theme.ink} />
                        <View style={sourceStyles.rowText}>
                          <Text style={sourceStyles.rowLabel}>{plan.name}</Text>
                          <Text style={sourceStyles.rowDetail}>{plan.routines.length === 1 ? '1 routine' : `${plan.routines.length} routines`}</Text>
                        </View>
                        <Icon name="chevron-forward" size={20} color={theme.slate} />
                      </Pressable>
                    ))}
                  </ForgeCard>
                </View> : null}
                {!standaloneRoutines.length && !plans.length ? <Text style={sourceStyles.empty}>Create a routine first, then start it from here.</Text> : null}
              </>
            )}
          </ScrollView>
        </>
      )}
    </ForgeBottomSheet>
  );
}

function DashboardRoutineChoiceCard({
  routines,
  onPress,
}: {
  routines: import('../../types').WorkoutRoutine[];
  onPress: (routine: import('../../types').WorkoutRoutine) => void;
}) {
  const theme = useForgeTheme();
  const sourceStyles = useThemedStyles(createRoutineSourceStyles);
  const { preferences } = useSettings();
  return (
    <ForgeCard variant="nested" size="compact">
      {routines.map((routine, index) => {
        const type = preferences.workoutTypes.find((item) => item.name === routine.type)
          ?? { id: 'retained-routine-type', name: routine.type, color: theme.ink, source: 'custom' as const, hidden: true };
        return <Pressable key={routine.id} accessibilityRole="button" accessibilityLabel={`Use ${routine.name} routine`} onPress={() => onPress(routine)} style={({ pressed }) => [sourceStyles.row, index > 0 && sourceStyles.divider, pressed && pressedFeedbackSubtle]}>
          <Icon name={workoutTypeIcon(type)} size={21} color={theme.ink} />
          <View style={sourceStyles.rowText}>
            <Text style={sourceStyles.rowLabel}>{routine.name}</Text>
            <Text style={sourceStyles.rowDetail}>{routine.type}</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={theme.slate} />
        </Pressable>;
      })}
    </ForgeCard>
  );
}

const createRoutineSourceStyles = (theme: ForgeTheme) => StyleSheet.create({
  sheet: { maxHeight: '84%', paddingHorizontal: 20, paddingBottom: 24 },
  content: { paddingTop: 14, paddingBottom: 20, gap: 18 },
  group: { gap: 8 },
  label: { color: theme.slate, ...typeScale.label },
  row: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: theme.ink, ...typeScale.label },
  rowDetail: { color: theme.slate, ...typeScale.caption },
  empty: { paddingHorizontal: 4, color: theme.slate, ...typeScale.supporting },
});

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
          {selectedWorkouts.map((workout) => {
            const workoutId = workout.id;
            return (
              <WorkoutRow
                key={`${calendarDateKey(selectedDate)}-${workoutId}`}
                workout={workout}
                theme={theme}
                onPress={workoutId ? () => {
                  lightHaptic();
                  navigation.navigate('MainTabs', { screen: 'History' });
                  requestAnimationFrame(() => navigation.navigate('WorkoutDetails', { workoutId }));
                } : undefined}
              />
            );
          })}
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
  const dockScrollInset = useForgeDockScrollInset();
  return (
    <ScrollView
      ref={scrollProbe.ref}
      onLayout={scrollProbe.onLayout}
      testID="dashboard-scroll"
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: dockScrollInset }, style]}
      showsVerticalScrollIndicator={false}
    >
      {header && React.cloneElement(header, { style: styles.scrollHeader })}
      {children}
    </ScrollView>
  );
}
