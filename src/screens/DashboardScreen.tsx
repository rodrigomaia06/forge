import React, { useMemo, useState } from 'react';
import { InteractionManager, LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import {
  AnchoredMenuActions,
  AppScreen,
  ForgeAnchoredMenu,
  ForgeCard,
  ForgeText as Text,
  HeaderEdge,
  Icon,
  lightHaptic,
  mediumHaptic,
  pressedFeedback,
  selectionHaptic,
  useAnchoredMenu,
} from '../components/ui';
import { forgeMotion, useForgeReducedMotion } from '../theme/motion';
import { DashboardHeader } from '../components/DashboardHeader';
import {
  DashboardLastWorkoutTile,
  DashboardStartCard,
  DashboardTrainingTimeCard,
  DashboardWeekCard,
} from './dashboard/DashboardSummaryParts';
import {
  DashboardCalendarTile,
  DashboardConsistencyTile,
  DashboardMeasurementTile,
  DashboardMeasurementsTile,
  DashboardMuscleBalanceTile,
  DashboardMuscleHeatmapTile,
  DashboardNoteTile,
  DashboardRestStatsTile,
  DashboardStreakTile,
  DashboardVolumeChartTile,
} from './dashboard/DashboardWidgetTiles';
import { DashboardTileSettingsSheet } from './dashboard/DashboardTileSettingsSheet';
import {
  consistency as consistencyMetric,
  measurementSeries,
  muscleBalance,
  muscleBalanceByMuscle,
  muscleHeatBySlug,
  restStats,
  streakStats,
  volumeSeries,
} from '../domain/dashboard/widgetMetrics';
import { useWorkoutStarter } from './dashboard/workoutStarter';
import { TileChromeContext } from './dashboard/tileChrome';
import {
  lastCompletedWorkout,
  trainingTimeThisWeek,
  weekStrip,
  weekVolume,
} from './dashboard/dashboardSummary';
import { suggestNextWorkout } from '../domain/workouts/suggestNextWorkout';
import { calendarDateKey } from '../domain/workouts/calendarDate';
import type { WeekStripDay } from './dashboard/dashboardSummary';
import {
  DASHBOARD_TILE_DEFAULT_SETTINGS,
  DASHBOARD_TILE_DEFAULT_TITLE,
  newMeasurementsTileId,
  OPTIONAL_SINGLETON_KINDS,
  tileHasSettings,
  tileSettings,
  useDashboardLayout,
  type DashboardTileConfig,
  type DashboardTileKind,
  type DashboardTileSettings,
} from '../state/dashboardLayout';
import { useWorkouts } from '../state/WorkoutContext';
import { usePlans } from '../state/PlansContext';
import { useSettings } from '../state/SettingsContext';
import { useForgeDockScrollInset } from '../components/DockChrome';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { ForgeTheme, RootNavigationProp } from '../types';

const TILE_TEST_ID: Record<DashboardTileKind, string> = {
  start: 'dashboard-start-card',
  week: 'dashboard-week-card',
  'training-time': 'dashboard-training-time',
  'last-workout': 'dashboard-last-workout',
  volume: 'dashboard-volume',
  'rest-stats': 'dashboard-rest-stats',
  'muscle-balance': 'dashboard-muscle-balance',
  consistency: 'dashboard-consistency',
  streak: 'dashboard-streak',
  'muscle-heatmap': 'dashboard-muscle-heatmap',
  measurement: 'dashboard-measurement',
  measurements: 'dashboard-measurements',
  note: 'dashboard-note',
  calendar: 'dashboard-calendar',
};

function tileTestId(config: DashboardTileConfig): string {
  if (config.kind === 'measurement') return `dashboard-measurement-${config.settings?.measurementId ?? 'x'}`;
  if (config.kind === 'measurements') return `dashboard-measurements-${config.id}`;
  return TILE_TEST_ID[config.kind];
}
function tileName(config: DashboardTileConfig): string {
  return config.title ?? DASHBOARD_TILE_DEFAULT_TITLE[config.kind];
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DashboardScreen() {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<RootNavigationProp>();
  const dockScrollInset = useForgeDockScrollInset();
  const { completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const { preferences, updatePreferences } = useSettings();
  const starter = useWorkoutStarter();
  const { layout, setLayout } = useDashboardLayout();
  const [editing, setEditing] = useState(false);
  const addTileMenu = useAnchoredMenu();
  const [settingsTileId, setSettingsTileId] = useState<string | null>(null);
  const [headerElevated, setHeaderElevated] = useState(false);
  const reducedMotion = useForgeReducedMotion();
  // Smoothly reflow the tile list when a tile is added/removed or edit mode
  // reveals its affordances, instead of letting the remaining tiles jump.
  const reflowTiles = () => {
    if (reducedMotion || Platform.OS === 'web') return;
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
      UIManager.setLayoutAnimationEnabledExperimental(true);
    LayoutAnimation.configureNext(
      LayoutAnimation.create(forgeMotion.transition, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
  };

  const measurementDefById = useMemo(
    () => new Map(preferences.dailyMeasurementDefinitions.map((def) => [def.id, def])),
    [preferences.dailyMeasurementDefinitions],
  );

  // The workout-derived metric each tile needs, computed once per data change
  // (not on every render). Toggling edit mode no longer recomputes them, so the
  // charts they feed neither stutter nor rebuild.
  const dashboardNow = useMemo(() => new Date(), []);
  const tileData = useMemo(() => {
    const map: Record<string, unknown> = {};
    for (const tile of layout) {
      if (!tile.visible) continue;
      const s = tileSettings(tile);
      switch (tile.kind) {
        case 'volume':
          map[tile.id] = volumeSeries(completedWorkouts, s.windowWeeks ?? 12, dashboardNow, preferences.weekStartsOn);
          break;
        case 'rest-stats':
          map[tile.id] = restStats(completedWorkouts, s.windowDays ?? 30, dashboardNow);
          break;
        case 'muscle-balance': {
          const weeks = s.windowWeeks ?? 4;
          const filter = s.muscleFilter ?? [];
          map[tile.id] = filter.length
            ? muscleBalanceByMuscle(completedWorkouts, weeks, dashboardNow, filter)
            : muscleBalance(completedWorkouts, weeks, dashboardNow);
          break;
        }
        case 'consistency':
          map[tile.id] = consistencyMetric(completedWorkouts, s.windowWeeks ?? 16, dashboardNow, preferences.weekStartsOn);
          break;
        case 'streak':
          map[tile.id] = streakStats(completedWorkouts, s.weeklyTargetDefault ?? 3, s.weeklyTargets ?? {}, dashboardNow, preferences.weekStartsOn);
          break;
        case 'muscle-heatmap':
          map[tile.id] = muscleHeatBySlug(completedWorkouts, s.windowDays ?? 30, dashboardNow);
          break;
      }
    }
    return map;
  }, [layout, completedWorkouts, preferences, dashboardNow]);

  const logMeasurement = (definitionId: string, value: number) => {
    const date = localDateKey();
    const entries = preferences.dailyMeasurementEntries;
    const existing = entries.find((entry) => entry.definitionId === definitionId && entry.date === date);
    updatePreferences({
      dailyMeasurementEntries: existing
        ? entries.map((entry) => (entry.id === existing.id ? { ...entry, value } : entry))
        : [...entries, { id: `measurement-${Date.now()}`, definitionId, date, value }],
    });
  };

  const summary = useMemo(() => {
    const now = new Date();
    const { days, workoutCount } = weekStrip(completedWorkouts, now, preferences.weekStartsOn);
    const { totalSeconds, perDaySeconds } = trainingTimeThisWeek(completedWorkouts, now, preferences.weekStartsOn);
    const { thisWeekKg, lastWeekKg, deltaPct } = weekVolume(completedWorkouts, now, preferences.weekStartsOn);
    const suggestion = suggestNextWorkout({ completedWorkouts, plans, standaloneRoutines, now });
    return {
      days,
      workoutCount,
      totalSeconds,
      perDaySeconds,
      thisWeekKg,
      lastWeekKg,
      deltaPct,
      suggestion,
      lastWorkout: lastCompletedWorkout(completedWorkouts),
    };
  }, [completedWorkouts, plans, standaloneRoutines, preferences.weekStartsOn]);

  const startSuggested = () => {
    if (summary.suggestion) starter.startRoutine(summary.suggestion.routine, summary.suggestion.plan);
    else starter.openChooser();
  };

  const openDayWorkout = (day: WeekStripDay) => {
    const key = calendarDateKey(day.date);
    const dayWorkouts = completedWorkouts.filter(
      (workout) => calendarDateKey(workout.completedAt ?? workout.startedAt) === key,
    );
    if (!dayWorkouts.length) return;
    // Open the most recent session logged that day.
    const target = dayWorkouts.reduce((latest, workout) =>
      (workout.completedAt ?? workout.startedAt) > (latest.completedAt ?? latest.startedAt) ? workout : latest,
    );
    navigation.navigate('WorkoutDetails', { workoutId: target.id });
  };

  const visibleTiles = layout.filter((tile) => tile.visible);
  const hiddenTiles = layout.filter((tile) => !tile.visible);

  const persistOrder = (nextVisible: DashboardTileConfig[]) =>
    setLayout([...nextVisible, ...layout.filter((tile) => !tile.visible)]);
  const hideTile = (id: string) => {
    selectionHaptic();
    reflowTiles();
    setLayout(layout.map((tile) => (tile.id === id ? { ...tile, visible: false } : tile)));
  };
  // Upserts a tile by id: re-shows a hidden one, or appends a brand-new one
  // (e.g. a measurement tile that has no prior layout entry).
  const addTile = (config: DashboardTileConfig) => {
    selectionHaptic();
    reflowTiles();
    setLayout([
      ...layout.filter((tile) => tile.id !== config.id),
      { ...config, visible: true },
    ]);
    addTileMenu.close();
    // A fresh measurement card opens its settings so you can pick the metric(s)
    // and window straight away, rather than staring at an empty tile. Wait for
    // the add-tile sheet to finish closing first — opening a second bottom sheet
    // in the same frame deadlocks the overlay/gesture layer on native.
    if (tileHasSettings(config.kind)) {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => setSettingsTileId(config.id), 320);
      });
    }
  };

  const updateTileSettings = (id: string, settings: DashboardTileSettings) =>
    setLayout(layout.map((tile) => (tile.id === id ? { ...tile, settings } : tile)));

  // Tiles you can add: any hidden built-in, plus the singleton cards
  // (Measurements, Note). Individual metrics aren't listed here — you add the
  // Measurements card and choose which metrics it shows in its settings.
  const measurementsCardCount = layout.filter((tile) => tile.kind === 'measurements' && tile.visible).length;
  const canAddMeasurements = preferences.dailyMeasurementDefinitions.length > measurementsCardCount;
  const addableTiles: { key: string; label: string; onPress: () => void }[] = [
    ...hiddenTiles
      .filter((tile) => tile.kind !== 'measurement' && tile.kind !== 'measurements')
      .map((tile) => ({
        key: tile.id,
        label: tileName(tile),
        onPress: () => addTile({ ...tile, visible: true }),
      })),
    // A Measurements card — addable more than once, capped at how many metrics
    // exist so you never stack more empty cards than you have data for.
    ...(canAddMeasurements
      ? [{
          key: 'add-measurements',
          label: DASHBOARD_TILE_DEFAULT_TITLE.measurements,
          onPress: () => addTile({ id: newMeasurementsTileId(), kind: 'measurements' as const, visible: true, settings: { ...DASHBOARD_TILE_DEFAULT_SETTINGS.measurements } }),
        }]
      : []),
    // Singleton cards (Note), each if not already placed.
    ...OPTIONAL_SINGLETON_KINDS.filter((kind) => !layout.some((tile) => tile.id === kind)).map((kind) => ({
      key: kind,
      label: DASHBOARD_TILE_DEFAULT_TITLE[kind],
      onPress: () => addTile({ id: kind, kind, visible: true, settings: { ...DASHBOARD_TILE_DEFAULT_SETTINGS[kind] } }),
    })),
  ];

  const renderTileContent = (config: DashboardTileConfig) => {
    const kind = config.kind;
    const s = tileSettings(config);
    switch (kind) {
      case 'start':
        return (
          <DashboardStartCard
            suggestion={summary.suggestion}
            workoutTypes={preferences.workoutTypes}
            onStart={startSuggested}
          />
        );
      case 'week':
        return (
          <DashboardWeekCard
            days={summary.days}
            workoutCount={summary.workoutCount}
            workoutTypes={preferences.workoutTypes}
            onSelectDay={editing ? undefined : openDayWorkout}
          />
        );
      case 'training-time':
        return (
          <DashboardTrainingTimeCard
            totalSeconds={summary.totalSeconds}
            perDaySeconds={summary.perDaySeconds}
            days={summary.days}
          />
        );
      case 'last-workout':
        return (
          <DashboardLastWorkoutTile
            lastWorkout={summary.lastWorkout}
            workoutTypes={preferences.workoutTypes}
            onOpen={(workoutId) => navigation.navigate('WorkoutDetails', { workoutId })}
          />
        );
      case 'volume':
        return <DashboardVolumeChartTile series={tileData[config.id] as ReturnType<typeof volumeSeries>} windowWeeks={s.windowWeeks ?? 12} />;
      case 'rest-stats':
        return <DashboardRestStatsTile stats={tileData[config.id] as ReturnType<typeof restStats>} windowDays={s.windowDays ?? 30} />;
      case 'muscle-balance':
        return <DashboardMuscleBalanceTile data={tileData[config.id] as ReturnType<typeof muscleBalance>} windowWeeks={s.windowWeeks ?? 4} />;
      case 'consistency':
        return <DashboardConsistencyTile data={tileData[config.id] as ReturnType<typeof consistencyMetric>} />;
      case 'streak':
        return <DashboardStreakTile stats={tileData[config.id] as ReturnType<typeof streakStats>} />;
      case 'muscle-heatmap':
        return (
          <DashboardMuscleHeatmapTile
            heat={tileData[config.id] as ReturnType<typeof muscleHeatBySlug>}
            windowDays={s.windowDays ?? 30}
            gender={s.gender ?? 'male'}
            onOpen={editing ? undefined : () => navigation.navigate('MuscleHeatmapDetail')}
          />
        );
      case 'measurement': {
        const definition = s.measurementId ? measurementDefById.get(s.measurementId) : undefined;
        if (!definition) return <Text style={styles.tileMissing}>This measurement was removed</Text>;
        const windowDays = s.windowDays ?? 90;
        return (
          <DashboardMeasurementTile
            definition={definition}
            series={measurementSeries(preferences.dailyMeasurementEntries, definition.id, windowDays, new Date())}
            windowDays={windowDays}
            onLog={(value) => logMeasurement(definition.id, value)}
          />
        );
      }
      case 'calendar':
        return (
          <DashboardCalendarTile
            workouts={completedWorkouts}
            workoutTypes={preferences.workoutTypes}
            weekStart={preferences.weekStartsOn}
            onOpen={editing ? undefined : () => navigation.navigate('Calendar')}
          />
        );
      case 'note':
        return (
          <DashboardNoteTile
            text={s.noteText ?? ''}
            onChange={(next) => updateTileSettings(config.id, { ...(config.settings ?? {}), noteText: next })}
          />
        );
      case 'measurements': {
        const windowDays = s.windowDays ?? 90;
        const chosen = (s.measurementIds ?? [])
          .map((id) => measurementDefById.get(id))
          .filter((def): def is NonNullable<typeof def> => Boolean(def));
        return (
          <DashboardMeasurementsTile
            definitions={chosen}
            entries={preferences.dailyMeasurementEntries}
            windowDays={windowDays}
            onOpen={editing ? undefined : (metricId) => navigation.navigate('DailyMeasurements', metricId ? { metricId } : undefined)}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <AppScreen testID="dashboard-app-screen" backgroundColor={theme.background} edges={['top']}>
      <View testID="dashboard-shell" style={styles.appShell}>
        <View style={styles.headerWrap}>
          <DashboardHeader
            theme={theme}
            variant={theme.headerVariant}
            onStart={starter.openChooser}
            editing={editing}
            onToggleEdit={() => {
              lightHaptic();
              reflowTiles();
              setEditing((current) => !current);
            }}
          />
          {headerElevated ? <HeaderEdge /> : null}
        </View>
        <DraggableFlatList
          testID="dashboard-scroll"
          data={visibleTiles}
          keyExtractor={(tile) => tile.id}
          extraData={{ summary, editing }}
          activationDistance={editing ? 12 : 100000}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          contentInset={{ bottom: dockScrollInset }}
          onScrollOffsetChange={(offset) => setHeaderElevated(offset > 1)}
          ListFooterComponent={
            <View style={{ paddingBottom: dockScrollInset }}>
              {editing && addableTiles.length ? (
                <View ref={addTileMenu.ref} collapsable={false}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add tile"
                    onPress={() => {
                      lightHaptic();
                      addTileMenu.open();
                    }}
                    style={({ pressed }) => [styles.addTileRow, pressed && pressedFeedback]}
                  >
                    <Icon name="add" size={20} color={theme.ink} />
                    <Text style={styles.addTileLabel}>Add tile</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
          onDragEnd={({ data }) => persistOrder(data)}
          renderItem={({ item, drag, isActive }) => (
            <DashboardTileFrame
              testID={tileTestId(item)}
              name={tileName(item)}
              editing={editing}
              isActive={isActive}
              onDrag={drag}
              onRemove={() => hideTile(item.id)}
              onOpenSettings={tileHasSettings(item.kind) ? () => { selectionHaptic(); setSettingsTileId(item.id); } : undefined}
            >
              {renderTileContent(item)}
            </DashboardTileFrame>
          )}
        />
        {starter.sheet}
        <ForgeAnchoredMenu
          visible={addTileMenu.visible}
          anchor={addTileMenu.anchor}
          onClose={addTileMenu.close}
          align="stretch"
          testID="add-tile-menu"
        >
          <AnchoredMenuActions
            onClose={addTileMenu.close}
            actions={addableTiles.map((tile) => ({
              label: tile.label,
              icon: 'add' as const,
              onPress: tile.onPress,
            }))}
          />
        </ForgeAnchoredMenu>
        <DashboardTileSettingsSheet
          config={settingsTileId ? (layout.find((tile) => tile.id === settingsTileId) ?? null) : null}
          workoutTypes={preferences.workoutTypes}
          measurements={preferences.dailyMeasurementDefinitions}
          onChange={(next) => settingsTileId && updateTileSettings(settingsTileId, next)}
          onClose={() => setSettingsTileId(null)}
        />
      </View>
    </AppScreen>
  );
}

function DashboardTileFrame({
  testID,
  name,
  editing,
  isActive,
  onDrag,
  onRemove,
  onOpenSettings,
  children,
}: {
  testID: string;
  name: string;
  editing: boolean;
  isActive: boolean;
  onDrag: () => void;
  onRemove: () => void;
  onOpenSettings?: () => void;
  children: React.ReactNode;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const translateX = useSharedValue(0);
  const open = useSharedValue(false);
  const [revealed, setRevealed] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const deleteLayerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translateX.value / TILE_DELETE_WIDTH)),
  }));

  const chrome = { editing, hasSettings: Boolean(onOpenSettings) };

  const remove = (): void => {
    mediumHaptic();
    onRemove();
  };
  const settle = (shouldOpen: boolean): void => {
    setRevealed(shouldOpen);
    open.value = shouldOpen;
    translateX.value = reducedMotion
      ? (shouldOpen ? -TILE_DELETE_WIDTH : 0)
      : withSpring(shouldOpen ? -TILE_DELETE_WIDTH : 0, forgeMotion.swipeSpring);
  };
  // A single structure across both modes so the tile body (and its charts) stays
  // mounted when edit mode toggles — the reorder/swipe chrome only enables and
  // fades in, it never re-creates the content. Whichever axis clears 16 pt first
  // wins, so a horizontal slide is not mistaken for a scroll.
  const swipe = Gesture.Pan()
    .enabled(editing)
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onUpdate((gesture) => {
      if (!open.value && gesture.translationX >= 0) return;
      const base = open.value ? -TILE_DELETE_WIDTH : 0;
      translateX.value = Math.max(-TILE_DELETE_WIDTH, Math.min(0, base + gesture.translationX));
    })
    .onEnd((gesture) => {
      const offset = (open.value ? -TILE_DELETE_WIDTH : 0) + gesture.translationX;
      const shouldOpen = Math.max(-TILE_DELETE_WIDTH, Math.min(0, offset)) < -TILE_DELETE_WIDTH * 0.5;
      runOnJS(settle)(shouldOpen);
    });

  return (
    <View style={styles.tileWrap}>
      <GestureDetector gesture={swipe}>
        <View style={[styles.tileSwipeRow, editing && deletePressed && { backgroundColor: theme.destructiveSurfacePressed }]}>
          <Animated.View
            style={[
              styles.tileDeleteLayer,
              deleteLayerStyle,
              { backgroundColor: deletePressed ? theme.destructiveSurfacePressed : theme.destructiveSurface, pointerEvents: revealed && editing ? 'auto' : 'none' },
            ]}
          >
            {editing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${name} tile`}
                onPress={remove}
                onPressIn={() => setDeletePressed(true)}
                onPressOut={() => setDeletePressed(false)}
                style={styles.tileDeleteAction}
              >
                <Icon name="trash" size={20} color={theme.textDestructive} />
                <Text style={styles.tileDeleteText}>Delete</Text>
              </Pressable>
            ) : null}
          </Animated.View>
          <Animated.View
            style={[styles.tileSwipeContent, cardStyle]}
            accessibilityActions={editing ? [{ name: 'delete', label: `Delete ${name} tile` }] : []}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'delete') remove();
            }}
          >
            <ForgeCard testID={testID} style={[styles.tileCard, isActive && styles.tileCardActive]}>
              {/* A generous left rail is the drag zone — hidden and inert until edit
                  mode, so its show/hide never remounts the body beside it. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reorder ${name} tile`}
                accessibilityElementsHidden={!editing}
                importantForAccessibility={editing ? 'auto' : 'no-hide-descendants'}
                onLongPress={editing ? onDrag : undefined}
                delayLongPress={140}
                style={[styles.dragRail, { opacity: editing ? 1 : 0, pointerEvents: editing ? 'auto' : 'none' }]}
              >
                <Icon name="drag" size={18} color={theme.muted} />
              </Pressable>
              <View style={[styles.tileBody, { paddingLeft: editing ? DRAG_RAIL_WIDTH : 16 }]}>
                <TileChromeContext.Provider value={chrome}>{children}</TileChromeContext.Provider>
              </View>
              {onOpenSettings ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${name} tile settings`}
                  accessibilityElementsHidden={!editing}
                  importantForAccessibility={editing ? 'auto' : 'no-hide-descendants'}
                  onPress={onOpenSettings}
                  hitSlop={8}
                  style={({ pressed }) => [styles.settingsButton, { opacity: editing ? 1 : 0, pointerEvents: editing ? 'auto' : 'none' }, pressed && styles.settingsButtonPressed]}
                >
                  <Icon name="settings" size={16} color={theme.slate} />
                </Pressable>
              ) : null}
            </ForgeCard>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const DRAG_RAIL_WIDTH = 40;
const TILE_DELETE_WIDTH = 64;

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  appShell: { flex: 1, minHeight: 0 },
  headerWrap: { position: 'relative', zIndex: 2 },
  // Horizontal padding lives on the items (and the header owns its own), so the
  // header title lines up with the other tabs' titles at the screen inset.
  listContent: { paddingTop: 0 },
  tileWrap: { marginBottom: 14, paddingHorizontal: 20 },
  tileCard: { position: 'relative' },
  tileCardActive: { opacity: 0.97 },
  dragRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAG_RAIL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // Content is inset past the rail on the left and clear of the X on the right.
  tileBody: {
    paddingLeft: DRAG_RAIL_WIDTH,
    paddingRight: 16,
    paddingVertical: 16,
    minHeight: 44,
  },
  // Swipe-to-delete, matching the live-workout set/exercise cards: the rounded
  // row is destructive-red, and the card slides left to reveal the trash action.
  tileSwipeRow: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: theme.destructiveSurface,
  },
  tileSwipeContent: { zIndex: 1 },
  tileDeleteLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: TILE_DELETE_WIDTH,
    backgroundColor: theme.destructiveSurface,
  },
  tileDeleteAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tileDeleteText: { color: theme.textDestructive, ...typeScale.caption },
  settingsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    backgroundColor: theme.surfaceMuted,
  },
  settingsButtonPressed: { backgroundColor: theme.pressed },
  addTileRow: {
    marginTop: 2,
    marginBottom: 14,
    marginHorizontal: 20,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  addTileLabel: { color: theme.ink, ...typeScale.controlLabel },
  tileMissing: { color: theme.muted, ...typeScale.body },
});
