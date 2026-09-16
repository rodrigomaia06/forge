import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  AppScreen,
  Button,
  ForgeBackButton,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeDateTimePicker,
  ForgeFloatingCta,
  ForgeSearchField,
  ForgeSheetHeader,
  ForgeText as Text,
  HeaderEdge,
  HeaderAction,
  Icon,
  lightHaptic,
  ScreenTitle,
  selectionHaptic,
} from '../components/ui';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { useWorkouts } from '../state/WorkoutContext';
import { usePlans } from '../state/PlansContext';
import { useSettings } from '../state/SettingsContext';
import { animateLayout, errorHaptic, mediumHaptic } from './activeWorkout/activeWorkoutFeedback';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../theme/motion';
import type { RootTabScreenProps, Workout } from '../types';
import { useForgeDockScrollInset } from '../components/DockChrome';

interface HistoryGroup {
  key: string;
  label: string;
  workouts: Workout[];
}

type HistoryDateMode = 'all' | 'month' | 'dates';
type HistoryFilterState = {
  types: string[];
  dateMode: HistoryDateMode;
  month: number;
  from: number;
  to: number;
};

function emptyHistoryFilters(now = new Date()): HistoryFilterState {
  const month = startOfMonth(now);
  return { types: [], dateMode: 'all', month: month.getTime(), from: startOfDay(now).getTime(), to: startOfDay(now).getTime() };
}

const keyExtractor = (group: HistoryGroup): string => group.key;

/**
 * One virtualized item is a full week block: its rail, period bridge, label, and
 * rows. Rendering the week as the virtualization unit keeps the continuous date
 * rail and cross-period connector geometry intact while the archive off-screen
 * stays unmounted.
 */
const HistoryGroupBlock = React.memo(function HistoryGroupBlock({
  group,
  groupIndex,
  previousLastWorkout,
  historyTitles,
  workoutTypes,
  deleteRevealedId,
  onRowPress,
  onRowDelete,
  onRowDeleteRevealChange,
}: {
  group: HistoryGroup;
  groupIndex: number;
  previousLastWorkout: Workout | undefined;
  historyTitles: Map<string, string>;
  workoutTypes: import('../types').WorkoutTypePreference[];
  deleteRevealedId: string | null;
  onRowPress: (workout: Workout) => void;
  onRowDelete: (workoutId: string) => void;
  onRowDeleteRevealChange: (workoutId: string, revealed: boolean) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const previousTail = previousLastWorkout && hasWorkoutExerciseSummary(previousLastWorkout)
    ? styles.periodRailConnectorDetailed
    : styles.periodRailConnectorCompact;
  const groupTail = hasWorkoutExerciseSummary(group.workouts.at(-1)!)
    ? styles.groupRailDetailed
    : styles.groupRailCompact;
  return (
    <View testID={`history-group-${group.key}`} style={styles.group}>
      <View pointerEvents="none" style={[styles.groupRail, groupTail]} />
      {groupIndex > 0 ? (
        <View testID={`history-period-connector-${group.key}`} pointerEvents="none" style={[styles.periodRailConnector, previousTail]}>
          <Svg width={1} height="100%">
            <Defs>
              <LinearGradient id={`history-period-rail-${group.key}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.divider} stopOpacity={0.48} />
                <Stop offset="0.28" stopColor={theme.divider} stopOpacity={0.28} />
                <Stop offset="0.5" stopColor={theme.divider} stopOpacity={0.08} />
                <Stop offset="0.72" stopColor={theme.divider} stopOpacity={0.28} />
                <Stop offset="1" stopColor={theme.divider} stopOpacity={0.48} />
              </LinearGradient>
            </Defs>
            <Rect width="1" height="100%" fill={`url(#history-period-rail-${group.key})`} />
          </Svg>
        </View>
      ) : null}
      <Text style={styles.groupTitle}>{group.label}</Text>
      {group.workouts.map((workout, index) => (
        <TimelineRow
          key={workout.id}
          workout={workout}
          displayName={historyTitles.get(workout.id) ?? workout.name}
          workoutTypes={workoutTypes}
          first={groupIndex === 0 && index === 0}
          onPress={onRowPress}
          deleteRevealed={deleteRevealedId === workout.id}
          onDeleteRevealChange={onRowDeleteRevealChange}
          onDelete={onRowDelete}
        />
      ))}
    </View>
  );
});

export function HistoryScreen({
  navigation,
}: RootTabScreenProps<'History'>) {
  const { completedWorkouts, deleteCompletedWorkout, startWorkout } = useWorkouts();
  const { plans } = usePlans();
  const { preferences } = useSettings();
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const styles = useThemedStyles(createStyles);
  const dockScrollInset = useForgeDockScrollInset();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(emptyHistoryFilters);
  // This tab is warmed at app start (it mounts eagerly, then freezes off-screen),
  // so its projection is computed once up front and the timeline is virtualized —
  // there is no per-open deferral to make the first visit feel slow.
  const historyTypeOptions = useMemo(() => {
    const presentTypes = new Set(completedWorkouts.map((workout) => workout.type));
    return [...presentTypes]
      .sort((left, right) => left.localeCompare(right))
      .map((type) => ({ value: type, label: type }));
  }, [completedWorkouts]);
  const filteredWorkouts = useMemo(() => completedWorkouts.filter((workout) => {
    if (filters.types.length && !filters.types.includes(workout.type)) return false;
    const completedAt = workout.completedAt ?? workout.startedAt;
    if (filters.dateMode === 'all') return true;
    if (filters.dateMode === 'month') {
      const start = new Date(filters.month);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime();
      return completedAt >= start.getTime() && completedAt < end;
    }
    return completedAt >= startOfDay(new Date(filters.from)).getTime()
      && completedAt < startOfNextDay(new Date(filters.to)).getTime();
  }), [completedWorkouts, filters]);
  const groups = useMemo(() => groupByPeriod(filteredWorkouts), [filteredWorkouts]);
  // A recorded title is normally the durable snapshot. Imported legacy rows
  // occasionally retained just the routine title beside their source IDs; use
  // that intact pair only for this narrow legacy repair, so later plan edits
  // never rename a modern completed workout in History.
  const historyTitles = useMemo(() => {
    const titles = new Map<string, string>();
    for (const workout of completedWorkouts) {
      const plan = workout.planId ? plans.find((item) => item.id === workout.planId) : undefined;
      const routine = plan && workout.routineId
        ? plan.routines.find((item) => item.id === workout.routineId)
        : undefined;
      const needsLegacySourceTitle = Boolean(
        plan && routine && workout.name.trim() === routine.name.trim(),
      );
      titles.set(
        workout.id,
        needsLegacySourceTitle && plan && routine ? `${plan.name} - ${routine.name}` : workout.name,
      );
    }
    return titles;
  }, [completedWorkouts, plans]);
  const activeFilterCount = filters.types.length + (filters.dateMode === 'all' ? 0 : 1);
  const [deleteRevealedId, setDeleteRevealedId] = useState<string | null>(null);
  const [headerElevated, setHeaderElevated] = useState(false);
  // Stable list callbacks so a header-elevation change or a single row swipe
  // never rebuilds the timeline: memoized rows only compare these references.
  const handleRowPress = useCallback((workout: Workout) => {
    selectionHaptic();
    navigation.navigate('WorkoutDetails', { workoutId: workout.id });
  }, [navigation]);
  const handleRowDelete = useCallback((workoutId: string) => {
    animateLayout(reducedMotion);
    errorHaptic();
    deleteCompletedWorkout(workoutId);
    setDeleteRevealedId(null);
  }, [deleteCompletedWorkout, reducedMotion]);
  const handleRowDeleteRevealChange = useCallback((workoutId: string, revealed: boolean) => {
    setDeleteRevealedId((current) => (revealed ? workoutId : current === workoutId ? null : current));
  }, []);
  const renderGroup = useCallback(({ item, index }: { item: HistoryGroup; index: number }) => (
    <HistoryGroupBlock
      group={item}
      groupIndex={index}
      previousLastWorkout={index > 0 ? groups[index - 1]?.workouts.at(-1) : undefined}
      historyTitles={historyTitles}
      workoutTypes={preferences.workoutTypes}
      deleteRevealedId={deleteRevealedId}
      onRowPress={handleRowPress}
      onRowDelete={handleRowDelete}
      onRowDeleteRevealChange={handleRowDeleteRevealChange}
    />
  ), [deleteRevealedId, groups, handleRowDelete, handleRowDeleteRevealChange, handleRowPress, historyTitles, preferences.workoutTypes]);
  return (
    <AppScreen backgroundColor={theme.background} edges={['top']}>
      <View style={styles.screen}>
        <View testID="history-header" style={styles.header}>
          <ScreenTitle testID="history-title" color={theme.textPrimary}>
            History
          </ScreenTitle>
          <HeaderAction
            accessibilityLabel="Filter"
            icon="filter"
            iconSize={20}
            onPress={() => setFiltersOpen(true)}
            iconOnly
            variant={theme.colorScheme === 'dark' ? 'ghost' : 'outline'}
            style={theme.colorScheme === 'dark' ? styles.darkHeaderAction : undefined}
          />
          {headerElevated ? <HeaderEdge /> : null}
        </View>
        <FlatList
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: dockScrollInset }, !groups.length && styles.contentEmpty]}
            data={groups}
            keyExtractor={keyExtractor}
            renderItem={renderGroup}
            extraData={renderGroup}
            showsVerticalScrollIndicator={false}
            onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
            scrollEventThrottle={16}
            initialNumToRender={6}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={50}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== 'web'}
            ListEmptyComponent={(
              <View style={styles.empty}>
                <Image
                  testID="history-empty-illustration"
                  source={require('../../assets/illustrations/empty-history.png')}
                  style={styles.emptyIllustration}
                  tintColor={theme.muted}
                  resizeMode="contain"
                  accessible={false}
                />
                <Text style={styles.emptyTitle}>
                  {activeFilterCount ? 'No matching workouts' : 'No completed workouts'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeFilterCount
                    ? 'Try changing or clearing the filter.'
                    : 'Finish a workout and it will appear here.'}
                </Text>
                {activeFilterCount ? (
                  <Button
                    label="Clear filters"
                    variant="secondary"
                    onPress={() => setFilters(emptyHistoryFilters())}
                    theme={theme}
                    style={styles.emptyAction}
                  />
                ) : (
                  <Button
                    label="Start a workout"
                    onPress={() => {
                      startWorkout();
                      navigation.navigate('ActiveWorkout');
                    }}
                    theme={theme}
                    style={styles.emptyAction}
                  />
                )}
              </View>
            )}
          />
        <HistoryFilterSheet
          testID="history-filter-sheet"
          visible={filtersOpen}
          filters={filters}
          typeOptions={historyTypeOptions}
          onApply={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      </View>
    </AppScreen>
  );
}

function HistoryFilterSheet({
  visible,
  filters,
  typeOptions,
  onApply,
  onClose,
  testID,
}: {
  visible: boolean;
  filters: HistoryFilterState;
  typeOptions: { value: string; label: string }[];
  onApply: (filters: HistoryFilterState) => void;
  onClose: () => void;
  testID: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const [draft, setDraft] = useState(filters);
  const [view, setView] = useState<'summary' | 'types' | 'dates' | 'from' | 'to'>('summary');
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!visible) return;
    setDraft(filters);
    setQuery('');
    setView('summary');
  }, [filters, visible]);
  const filterCount = draft.types.length + (draft.dateMode === 'all' ? 0 : 1);
  const changed = !sameHistoryFilters(draft, filters);
  const visibleTypes = typeOptions.filter((type) => type.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const setDateMode = (dateMode: HistoryDateMode): void => {
    selectionHaptic();
    setDraft((current) => ({ ...current, dateMode }));
  };
  const updateDate = (key: 'from' | 'to', value: Date): void => {
    setDraft((current) => {
      const timestamp = startOfDay(value).getTime();
      if (key === 'from') return { ...current, from: timestamp, to: Math.max(timestamp, current.to) };
      return { ...current, to: timestamp, from: Math.min(timestamp, current.from) };
    });
  };
  const title = view === 'types' ? 'Workout type' : view === 'dates' ? 'Date range' : view === 'from' ? 'From date' : view === 'to' ? 'To date' : 'Filter history';
  const goBack = (): void => {
    setQuery('');
    setView(view === 'from' || view === 'to' ? 'dates' : 'summary');
  };
  return (
    <ForgeBottomSheet
      testID={testID}
      surfaceTestID={`${testID}-surface`}
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Close history filters"
      initialOffset={620}
      closeDistance={620}
      dismissThreshold={220}
    >
      {(close) => (
        <View style={[styles.historyFilterSheet, (view === 'types' || view === 'from' || view === 'to') && styles.historyFilterSheetTall]}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={title}
            onClose={close}
            closeAccessibilityLabel="Cancel history filters"
            leading={view === 'summary'
              ? filterCount ? <Button label="Clear" variant="outline" tone="destructive" onPress={() => setDraft(emptyHistoryFilters())} style={styles.historyFilterClear} /> : undefined
              : <ForgeBackButton accessibilityLabel={view === 'from' || view === 'to' ? 'Back to date range' : 'Back to filters'} onPress={goBack} />}
          />
          {view === 'summary' ? (
            <HistoryFilterSummary
              filters={draft}
              onOpenTypes={() => { selectionHaptic(); setView('types'); }}
              onOpenDates={() => { selectionHaptic(); setView('dates'); }}
            />
          ) : view === 'types' ? (
            <ScrollView style={styles.historyFilterScroll} contentContainerStyle={styles.historyFilterContent} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <ForgeSearchField value={query} onChangeText={setQuery} accessibilityLabel="Search workout type filters" placeholder="Search workout type" autoFocus />
              <View style={[styles.historyFilterCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
                {visibleTypes.map((type, index) => {
                  const selected = draft.types.includes(type.value);
                  return <Pressable key={type.value} accessibilityRole="checkbox" accessibilityLabel={`Filter Workout type: ${type.label}`} accessibilityState={{ checked: selected }} unstable_pressDelay={80} onPress={() => {
                    selectionHaptic();
                    setDraft((current) => ({ ...current, types: selected ? current.types.filter((value) => value !== type.value) : [...current.types, type.value] }));
                  }} style={({ pressed }) => [styles.historyFilterChoice, selected && { backgroundColor: theme.successSurface }, pressed && styles.pressed]}>
                    <Text style={styles.historyFilterChoiceText}>{type.label}</Text>
                    {selected ? <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" /> : null}
                    {index < visibleTypes.length - 1 ? <View style={[styles.historyFilterDivider, { backgroundColor: theme.divider }]} /> : null}
                  </Pressable>;
                })}
                {!visibleTypes.length ? <Text style={styles.historyFilterEmpty}>No matching workout types.</Text> : null}
              </View>
            </ScrollView>
          ) : view === 'dates' ? (
            <HistoryDateRangeControls
              filters={draft}
              onSetMode={setDateMode}
              onPreviousMonth={() => setDraft((current) => ({ ...current, month: new Date(new Date(current.month).getFullYear(), new Date(current.month).getMonth() - 1, 1).getTime() }))}
              onNextMonth={() => setDraft((current) => ({ ...current, month: new Date(new Date(current.month).getFullYear(), new Date(current.month).getMonth() + 1, 1).getTime() }))}
              onOpenFrom={() => setView('from')}
              onOpenTo={() => setView('to')}
            />
          ) : (
            <ScrollView style={styles.historyFilterScroll} contentContainerStyle={styles.historyDatePickerContent} showsVerticalScrollIndicator={false}>
              <ForgeDateTimePicker
                mode="date"
                value={new Date(view === 'from' ? draft.from : draft.to)}
                onChange={(value) => updateDate(view, value)}
                weekStartsOn={preferences.weekStartsOn}
                testID={`history-filter-${view}-picker`}
              />
            </ScrollView>
          )}
          {view === 'summary' ? (
            <ForgeFloatingCta label={filterCount ? `Apply (${filterCount})` : 'Apply'} accessibilityLabel={filterCount ? `Apply (${filterCount})` : 'Apply filters'} disabled={!changed} tone="success" onPress={() => { onApply(draft); close(); }} />
          ) : null}
        </View>
      )}
    </ForgeBottomSheet>
  );
}

function HistoryFilterSummary({ filters, onOpenTypes, onOpenDates }: { filters: HistoryFilterState; onOpenTypes: () => void; onOpenDates: () => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return <ScrollView testID="history-filter-summary" contentContainerStyle={styles.historyFilterSummary} showsVerticalScrollIndicator={false}>
    <View style={[styles.historyFilterCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <HistoryFilterRow icon="layers" title="Workout type" summary={filters.types.length ? (filters.types.length === 1 ? filters.types[0] : `${filters.types.length} selected`) : 'Any'} onPress={onOpenTypes} />
      <View style={[styles.historyFilterDivider, styles.historyFilterSummaryDivider, { backgroundColor: theme.divider }]} />
      <HistoryFilterRow icon="calendar" title="Date range" summary={historyDateSummary(filters)} onPress={onOpenDates} />
    </View>
  </ScrollView>;
}

function HistoryFilterRow({ icon, title, summary, onPress }: { icon: import('../types').IconName; title: string; summary: string; onPress: () => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title} filter, ${summary}`} onPress={onPress} unstable_pressDelay={80} style={({ pressed }) => [styles.historyFilterRow, pressed && styles.pressed]}>
    <View style={[styles.historyFilterIcon, { backgroundColor: theme.surfaceMuted }]}><Icon name={icon} size={19} color={theme.textPrimary} /></View>
    <View style={styles.historyFilterCopy}><Text style={styles.historyFilterTitle}>{title}</Text><Text style={styles.historyFilterSummaryText}>{summary}</Text></View>
    <Icon name="chevron-forward" size={19} color={theme.textSecondary} />
  </Pressable>;
}

function HistoryDateRangeControls({ filters, onSetMode, onPreviousMonth, onNextMonth, onOpenFrom, onOpenTo }: { filters: HistoryFilterState; onSetMode: (mode: HistoryDateMode) => void; onPreviousMonth: () => void; onNextMonth: () => void; onOpenFrom: () => void; onOpenTo: () => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const modes: { value: HistoryDateMode; label: string; description: string }[] = [
    { value: 'all', label: 'All dates', description: 'Show the full timeline' },
    { value: 'month', label: 'Month', description: 'Choose one calendar month' },
    { value: 'dates', label: 'Custom dates', description: 'Choose a start and end date' },
  ];
  return <ScrollView contentContainerStyle={styles.historyDateControls} showsVerticalScrollIndicator={false}>
    <View testID="history-filter-date-mode" style={[styles.historyFilterCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      {modes.map((mode, index) => {
        const selected = filters.dateMode === mode.value;
        return <Pressable key={mode.value} accessibilityRole="radio" accessibilityLabel={mode.label} accessibilityState={{ checked: selected }} onPress={() => onSetMode(mode.value)} style={({ pressed }) => [styles.historyDateModeRow, selected && { backgroundColor: theme.successSurface }, pressed && styles.pressed]}>
          <View style={styles.historyFilterCopy}><Text style={styles.historyFilterTitle}>{mode.label}</Text><Text style={styles.historyFilterSummaryText}>{mode.description}</Text></View>
          {selected ? <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" /> : null}
          {index < modes.length - 1 ? <View style={[styles.historyFilterDivider, { backgroundColor: theme.divider }]} /> : null}
        </Pressable>;
      })}
    </View>
    {filters.dateMode === 'month' ? <View testID="history-filter-month" style={[styles.historyMonthCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <HeaderAction accessibilityLabel="Previous filter month" icon="chevron-back" iconOnly variant={theme.colorScheme === 'dark' ? 'ghost' : 'outline'} onPress={onPreviousMonth} style={theme.colorScheme === 'dark' ? { backgroundColor: theme.surfaceMuted } : undefined} />
      <View style={styles.historyMonthCopy}><Text style={styles.historyFilterTitle}>{new Date(filters.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Text style={styles.historyFilterSummaryText}>{historyDateSummary(filters)}</Text></View>
      <HeaderAction accessibilityLabel="Next filter month" icon="chevron-forward" iconOnly variant={theme.colorScheme === 'dark' ? 'ghost' : 'outline'} onPress={onNextMonth} style={theme.colorScheme === 'dark' ? { backgroundColor: theme.surfaceMuted } : undefined} />
    </View> : null}
    {filters.dateMode === 'dates' ? <View style={[styles.historyFilterCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <HistoryFilterRow icon="calendar" title="From" summary={formatHistoryDate(filters.from)} onPress={onOpenFrom} />
      <View style={[styles.historyFilterDivider, styles.historyFilterSummaryDivider, { backgroundColor: theme.divider }]} />
      <HistoryFilterRow icon="calendar" title="To" summary={formatHistoryDate(filters.to)} onPress={onOpenTo} />
    </View> : null}
  </ScrollView>;
}

const TimelineRow = React.memo(function TimelineRow({
  workout,
  displayName,
  workoutTypes,
  first,
  onPress,
  deleteRevealed,
  onDeleteRevealChange,
  onDelete,
}: {
  workout: Workout;
  displayName: string;
  workoutTypes: import('../types').WorkoutTypePreference[];
  first: boolean;
  onPress: (workout: Workout) => void;
  deleteRevealed: boolean;
  onDeleteRevealChange: (workoutId: string, revealed: boolean) => void;
  onDelete: (workoutId: string) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const suppressNextPress = useRef(false);
  const date = new Date(workout.completedAt ?? workout.startedAt);
  const type = getWorkoutTypePresentation(workout.type, workoutTypes, theme, 0.14);
  const setCount = countWorkoutSets(workout);
  const hasExerciseSummary = hasWorkoutExerciseSummary(workout);

  React.useEffect(() => {
    if (!deleteRevealed) swipeableRef.current?.close();
  }, [deleteRevealed]);

  return (
    <View
      testID={`history-timeline-${workout.id}`}
      accessibilityLabel="History timeline"
      style={[styles.timelineRow, !hasExerciseSummary && styles.timelineRowCompact]}
    >
      <View style={styles.dateColumn}>
        <Text style={styles.weekday}>{date.toLocaleDateString('en-GB', { weekday: 'short' })}</Text>
        <Text style={styles.day}>{date.getDate()}</Text>
        <Text style={styles.month}>{date.toLocaleDateString('en-GB', { month: 'short' })}</Text>
      </View>
      <View style={styles.timelineRail}>
        <View testID={`history-marker-${workout.id}`} style={[styles.marker, !hasExerciseSummary && styles.markerCompact, first && styles.markerActive]} />
      </View>
      <View testID={`history-swipe-${workout.id}`} style={styles.swipeShell}>
        <ReanimatedSwipeable
          ref={swipeableRef}
          containerStyle={styles.swipeContainer}
          childrenContainerStyle={styles.swipeContent}
          friction={1.35}
          rightThreshold={32}
          overshootRight={false}
          animationOptions={reducedMotion ? { duration: 0 } : swipeSpring}
          onSwipeableOpenStartDrag={() => {
            suppressNextPress.current = true;
          }}
          onSwipeableWillOpen={() => {
            mediumHaptic();
          }}
          onSwipeableOpen={() => onDeleteRevealChange(workout.id, true)}
          onSwipeableClose={() => onDeleteRevealChange(workout.id, false)}
          renderRightActions={() => (
            <View style={styles.deleteActionLayer}>
              <Pressable
                testID={`history-delete-${workout.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${displayName}`}
                onPress={() => onDelete(workout.id)}
                style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}
              >
                <Icon name="trash" size={18} color={theme.textDestructive} />
                <Text style={styles.deleteActionText}>Delete</Text>
              </Pressable>
            </View>
          )}
        >
          <Pressable
            testID={`history-card-${workout.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Open ${displayName}`}
            unstable_pressDelay={80}
            onPress={() => {
              if (suppressNextPress.current) {
                suppressNextPress.current = false;
                return;
              }
              onPress(workout);
            }}
            style={({ pressed }) => [
              styles.card,
              !hasExerciseSummary && styles.cardCompact,
              pressed && styles.pressed,
            ]}
          >
            <View
              testID={`history-type-icon-${workout.id}`}
              style={[styles.typeIcon, { backgroundColor: type.background }]}
            >
              <Icon name={type.icon} size={22} color={type.color} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              {hasExerciseSummary && (
                <Text style={styles.stats} numberOfLines={1}>
                  {`${workout.exercises.length} exercises, ${setCount} sets`}
                </Text>
              )}
            </View>
            <View style={styles.durationChip}>
              <Icon name="time-outline" size={13} color={theme.ink} />
              <Text style={styles.durationText}>{formatCompactDuration(workout.durationSeconds)}</Text>
            </View>
            <Icon name="chevron-forward" size={17} color={theme.slate} />
          </Pressable>
        </ReanimatedSwipeable>
        <View style={[styles.cardLeadingOutline, { pointerEvents: 'none' }]} />
      </View>
    </View>
  );
});

const swipeSpring = forgeMotion.swipeSpring;
const historyCardRadius = 16;
const historyRailCenter = 58.5;
const historyGroupRailTop = 61;
const historyGroupGap = 14;

function hasWorkoutExerciseSummary(workout: Workout): boolean {
  return workout.exercises.length > 0 && countWorkoutSets(workout) > 0;
}

function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfNextDay(value: Date): Date {
  const result = startOfDay(value);
  result.setDate(result.getDate() + 1);
  return result;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function sameHistoryFilters(left: HistoryFilterState, right: HistoryFilterState): boolean {
  return left.dateMode === right.dateMode
    && left.month === right.month
    && left.from === right.from
    && left.to === right.to
    && left.types.length === right.types.length
    && left.types.every((type) => right.types.includes(type));
}

function formatHistoryDate(value: number): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function historyDateSummary(filters: HistoryFilterState): string {
  if (filters.dateMode === 'all') return 'All dates';
  if (filters.dateMode === 'month') return new Date(filters.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return `${formatHistoryDate(filters.from)} to ${formatHistoryDate(filters.to)}`;
}

function groupByPeriod(workouts: Workout[]): HistoryGroup[] {
  const current = startOfWeek(new Date());
  const groups = new Map<string, HistoryGroup>();
  [...workouts]
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
    .forEach((workout) => {
      const date = new Date(workout.completedAt ?? workout.startedAt);
      if (Number.isNaN(date.getTime())) return;
      const week = startOfWeek(date);
      const key = week.toISOString().slice(0, 10);
      if (!groups.has(key))
        groups.set(key, { key, label: periodLabel(week, current), workouts: [] });
      groups.get(key)?.workouts.push(workout);
    });
  return [...groups.values()];
}
function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}
function periodLabel(week: Date, current: Date): string {
  const days = Math.round((current.getTime() - week.getTime()) / 86400000);
  if (days <= 0) return 'This week';
  if (days <= 7) return 'Last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

const createStyles = (theme: import('../types').ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  header: {
    position: 'relative',
    zIndex: 2,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: theme.background,
  },
  // Dark Forge headers use a calm filled action surface rather than an
  // outlined ring, which reads as visual noise against the dark background.
  darkHeaderAction: { backgroundColor: theme.surfaceMuted },
  historyFilterSheet: { alignSelf: 'stretch', flexShrink: 1, maxHeight: 620 },
  historyFilterSheetTall: { alignSelf: 'stretch', height: 620 },
  historyFilterClear: { minHeight: 38, paddingHorizontal: 12, borderRadius: 14 },
  historyFilterScroll: { flex: 1, minHeight: 0 },
  historyFilterContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 10 },
  historyDatePickerContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  historyFilterSummary: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 96 },
  historyDateControls: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 12 },
  historyFilterCard: { overflow: 'hidden', borderRadius: 20, borderWidth: 1 },
  historyFilterRow: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyFilterIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyFilterCopy: { flex: 1, minWidth: 0 },
  historyFilterTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
  historyFilterSummaryText: { marginTop: 1, color: theme.textSecondary, ...typeScale.supporting },
  historyFilterDivider: { position: 'absolute', right: 16, bottom: 0, left: 16, height: StyleSheet.hairlineWidth, pointerEvents: 'none' },
  historyFilterSummaryDivider: { left: 64 },
  historyFilterChoice: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyFilterChoiceText: { flex: 1, color: theme.textPrimary, ...typeScale.cardTitle },
  historyFilterEmpty: { padding: 20, color: theme.textSecondary, ...typeScale.supporting },
  historyDateModeRow: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyMonthCard: { minHeight: 72, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyMonthCopy: { flex: 1, alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  contentEmpty: { flexGrow: 1 },
  group: { gap: 6, position: 'relative' },
  // One solid rail lives behind all rows in its week, crossing row gaps. The
  // gradient bridge across a period label reads as chronology without making
  // the week boundary feel like a hard break.
  groupRail: {
    position: 'absolute',
    zIndex: 0,
    top: historyGroupRailTop,
    left: historyRailCenter - 0.5,
    width: 1,
    backgroundColor: theme.divider,
    opacity: 0.78,
  },
  groupRailDetailed: { bottom: 35 },
  groupRailCompact: { bottom: 30 },
  periodRailConnector: {
    position: 'absolute',
    zIndex: 0,
    left: historyRailCenter - 0.5,
    width: 1,
    height: historyGroupRailTop + historyGroupGap,
    overflow: 'hidden',
  },
  periodRailConnectorDetailed: { top: -(35 + historyGroupGap), height: historyGroupRailTop + 35 + historyGroupGap },
  periodRailConnectorCompact: { top: -(30 + historyGroupGap), height: historyGroupRailTop + 30 + historyGroupGap },
  groupTitle: {
    marginLeft: 70,
    color: theme.slate,
    ...typeScale.supporting,
  },
  timelineRow: { minHeight: 70, flexDirection: 'row', alignItems: 'stretch' },
  // ReanimatedSwipeable measures its child before applying flex constraints on
  // web. Give compact rows an explicit height so the sparse card cannot inherit
  // the detailed row's 70pt measurement.
  timelineRowCompact: { minHeight: 60, height: 60 },
  dateColumn: { width: 47, alignItems: 'flex-end', paddingTop: 10, paddingRight: 5 },
  weekday: { color: theme.slate, ...typeScale.caption },
  day: { color: theme.ink, ...typeScale.metricMedium },
  month: { color: theme.slate, ...typeScale.caption },
  timelineRail: { width: 23, alignItems: 'center', position: 'relative' },
  marker: {
    zIndex: 1,
    marginTop: 28,
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: theme.divider,
    borderRadius: 7,
    backgroundColor: theme.background,
  },
  markerCompact: { marginTop: 23 },
  markerActive: { borderColor: theme.ink, backgroundColor: theme.ink },
  swipeShell: { flex: 1, minWidth: 0, alignSelf: 'stretch' },
  swipeContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: historyCardRadius,
    alignSelf: 'stretch',
  },
  deleteActionLayer: {
    // The action overlaps the card radius beneath the translated card so its
    // red surface fills the full trailing curve instead of leaving a gap.
    width: 64 + historyCardRadius,
    marginLeft: -historyCardRadius,
    paddingLeft: historyCardRadius,
    alignSelf: 'stretch',
    backgroundColor: theme.destructiveSurface,
  },
  deleteAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  deleteActionPressed: { backgroundColor: theme.destructiveSurfacePressed },
  deleteActionText: { color: theme.textDestructive, ...typeScale.caption },
  // The card is the moving surface. Its border and curve travel with it while
  // the red delete layer remains behind the exposed trailing edge.
  swipeContent: { zIndex: 1, flex: 1, alignSelf: 'stretch' },
  card: {
    flex: 1,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: historyCardRadius,
    backgroundColor: theme.surface,
    shadowColor: theme.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardCompact: { minHeight: 60, height: 60 },
  pressed: { shadowOpacity: 0.08 },
  cardLeadingOutline: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: historyCardRadius,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: theme.border,
    borderTopLeftRadius: historyCardRadius,
    borderBottomLeftRadius: historyCardRadius,
  },
  typeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  cardCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  name: { color: theme.ink, ...typeScale.cardTitle },
  stats: { color: theme.slate, ...typeScale.label },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.surfaceMuted,
  },
  durationText: { color: theme.ink, ...typeScale.caption },
  empty: { alignItems: 'center', paddingVertical: 52, gap: 8 },
  emptyIllustration: { width: 250, height: 179, marginBottom: -18, opacity: 0.78 },
  emptyTitle: { color: theme.ink, ...typeScale.sectionTitle },
  emptySubtitle: {
    ...typeScale.body,
    color: theme.slate,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyAction: { marginTop: 14 },
});
