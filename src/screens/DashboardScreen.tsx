import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import {
  AppScreen,
  ForgeActionSheet,
  ForgeCard,
  ForgeText as Text,
  Icon,
  lightHaptic,
  mediumHaptic,
  pressedFeedback,
  selectionHaptic,
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
  DashboardConsistencyTile,
  DashboardMeasurementTile,
  DashboardMuscleBalanceTile,
  DashboardMuscleHeatmapTile,
  DashboardRestStatsTile,
  DashboardStreakTile,
  DashboardVolumeChartTile,
} from './dashboard/DashboardWidgetTiles';
import { DashboardTileSettingsSheet } from './dashboard/DashboardTileSettingsSheet';
import {
  consistency as consistencyMetric,
  measurementSeries,
  muscleBalance,
  muscleHeat,
  restStats,
  streakStats,
  volumeSeries,
} from '../domain/dashboard/widgetMetrics';
import { useWorkoutStarter } from './dashboard/workoutStarter';
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
  DASHBOARD_TILE_DEFAULT_TITLE,
  measurementTileId,
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
};

function tileTestId(config: DashboardTileConfig): string {
  if (config.kind === 'measurement') return `dashboard-measurement-${config.settings?.measurementId ?? 'x'}`;
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
  const [addTileOpen, setAddTileOpen] = useState(false);
  const [settingsTileId, setSettingsTileId] = useState<string | null>(null);

  const measurementDefById = useMemo(
    () => new Map(preferences.dailyMeasurementDefinitions.map((def) => [def.id, def])),
    [preferences.dailyMeasurementDefinitions],
  );

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
    setLayout(layout.map((tile) => (tile.id === id ? { ...tile, visible: false } : tile)));
  };
  // Upserts a tile by id: re-shows a hidden one, or appends a brand-new one
  // (e.g. a measurement tile that has no prior layout entry).
  const addTile = (config: DashboardTileConfig) => {
    selectionHaptic();
    setLayout([
      ...layout.filter((tile) => tile.id !== config.id),
      { ...config, visible: true },
    ]);
    setAddTileOpen(false);
  };

  const updateTileSettings = (id: string, settings: DashboardTileSettings) =>
    setLayout(layout.map((tile) => (tile.id === id ? { ...tile, settings } : tile)));

  // Tiles you can add: hidden built-ins/measurements, plus any tracked
  // measurement that has no tile yet.
  const addableTiles: { key: string; label: string; onPress: () => void }[] = [
    ...hiddenTiles.map((tile) => ({
      key: tile.id,
      label: tile.kind === 'measurement'
        ? measurementDefById.get(tile.settings?.measurementId ?? '')?.name ?? tileName(tile)
        : tileName(tile),
      onPress: () => addTile({ ...tile, visible: true }),
    })),
    ...preferences.dailyMeasurementDefinitions
      .filter((def) => !layout.some((tile) => tile.id === measurementTileId(def.id)))
      .map((def) => ({
        key: measurementTileId(def.id),
        label: def.name,
        onPress: () =>
          addTile({
            id: measurementTileId(def.id),
            kind: 'measurement',
            visible: true,
            title: def.name,
            settings: { measurementId: def.id, windowDays: 90 },
          }),
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
      case 'volume': {
        const weeks = s.windowWeeks ?? 12;
        return <DashboardVolumeChartTile series={volumeSeries(completedWorkouts, weeks, new Date(), preferences.weekStartsOn)} windowWeeks={weeks} />;
      }
      case 'rest-stats':
        return <DashboardRestStatsTile stats={restStats(completedWorkouts, s.windowDays ?? 30, new Date())} windowDays={s.windowDays ?? 30} />;
      case 'muscle-balance':
        return <DashboardMuscleBalanceTile data={muscleBalance(completedWorkouts, s.windowWeeks ?? 4, new Date())} windowWeeks={s.windowWeeks ?? 4} />;
      case 'consistency':
        return <DashboardConsistencyTile data={consistencyMetric(completedWorkouts, s.windowWeeks ?? 16, new Date(), preferences.weekStartsOn)} />;
      case 'streak':
        return <DashboardStreakTile stats={streakStats(completedWorkouts, s.weeklyTargetDefault ?? 3, s.weeklyTargets ?? {}, new Date(), preferences.weekStartsOn)} />;
      case 'muscle-heatmap':
        return <DashboardMuscleHeatmapTile heat={muscleHeat(completedWorkouts, s.windowDays ?? 14, new Date())} windowDays={s.windowDays ?? 14} />;
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
      default:
        return null;
    }
  };

  return (
    <AppScreen testID="dashboard-app-screen" backgroundColor={theme.background} edges={['top']}>
      <View testID="dashboard-shell" style={styles.appShell}>
        <DraggableFlatList
          testID="dashboard-scroll"
          data={visibleTiles}
          keyExtractor={(tile) => tile.id}
          extraData={{ summary, editing }}
          activationDistance={editing ? 12 : 100000}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          contentInset={{ bottom: dockScrollInset }}
          ListHeaderComponent={
            <DashboardHeader
              theme={theme}
              variant={theme.headerVariant}
              onStart={starter.openChooser}
              editing={editing}
              onToggleEdit={() => {
                lightHaptic();
                setEditing((current) => !current);
              }}
            />
          }
          ListFooterComponent={
            <View style={{ paddingBottom: dockScrollInset }}>
              {editing && addableTiles.length ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add tile"
                  onPress={() => {
                    lightHaptic();
                    setAddTileOpen(true);
                  }}
                  style={({ pressed }) => [styles.addTileRow, pressed && pressedFeedback]}
                >
                  <Icon name="add" size={20} color={theme.ink} />
                  <Text style={styles.addTileLabel}>Add tile</Text>
                </Pressable>
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
        <ForgeActionSheet
          visible={addTileOpen}
          onClose={() => setAddTileOpen(false)}
          accessibilityLabel="Dismiss add tile chooser"
          title="Add tile"
          actions={addableTiles.map((tile) => ({
            label: tile.label,
            icon: 'add' as const,
            onPress: tile.onPress,
          }))}
        />
        <DashboardTileSettingsSheet
          config={settingsTileId ? (layout.find((tile) => tile.id === settingsTileId) ?? null) : null}
          workoutTypes={preferences.workoutTypes}
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
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const deleteLayerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translateX.value / TILE_DELETE_WIDTH)),
  }));

  // Normal view: a clean card with no drag rail or remove control. The reorder
  // and swipe-to-delete chrome only appears in edit mode (toggled from the header).
  if (!editing) {
    return (
      <View style={styles.tileWrap}>
        <ForgeCard testID={testID} style={styles.tileCard}>
          <View style={styles.plainBody}>{children}</View>
        </ForgeCard>
      </View>
    );
  }

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
  // Slide the card left to reveal a destructive action, matching the live-workout
  // set/exercise swipe. Whichever axis clears 16 pt first wins, so a horizontal
  // slide is not mistaken for a scroll while a vertical drag still falls through
  // to the list scroll (and the drag rail keeps its long-press to reorder).
  const swipe = Gesture.Pan()
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
        <View style={styles.tileSwipeRow}>
          <Animated.View
            style={[styles.tileDeleteLayer, deleteLayerStyle, { pointerEvents: revealed ? 'auto' : 'none' }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${name} tile`}
              onPress={remove}
              style={({ pressed }) => [styles.tileDeleteAction, pressed && styles.tileDeleteActionPressed]}
            >
              <Icon name="trash" size={20} color={theme.textDestructive} />
              <Text style={styles.tileDeleteText}>Delete</Text>
            </Pressable>
          </Animated.View>
          <Animated.View
            style={[styles.tileSwipeContent, cardStyle]}
            accessibilityActions={[{ name: 'delete', label: `Delete ${name} tile` }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'delete') remove();
            }}
          >
            <ForgeCard testID={testID} style={[styles.tileCard, isActive && styles.tileCardActive]}>
              {/* A generous left rail is the drag zone, so a hold anywhere down the
                  left edge of the card starts a reorder — not only on the grip. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reorder ${name} tile`}
                onLongPress={onDrag}
                delayLongPress={140}
                style={styles.dragRail}
              >
                <Icon name="drag" size={18} color={theme.muted} />
              </Pressable>
              <View style={styles.tileBody}>{children}</View>
              {onOpenSettings ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${name} tile settings`}
                  onPress={onOpenSettings}
                  hitSlop={8}
                  style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
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
  // Horizontal padding lives on the items (and the header owns its own), so the
  // header title lines up with the other tabs' titles at the screen inset.
  listContent: { paddingTop: 0 },
  tileWrap: { marginBottom: 14, paddingHorizontal: 20 },
  tileCard: { position: 'relative' },
  tileCardActive: { opacity: 0.97 },
  // Clean card body when not editing (no rail inset / remove control).
  plainBody: { padding: 16, minHeight: 44 },
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
  tileDeleteActionPressed: { backgroundColor: theme.destructiveSurfacePressed },
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
