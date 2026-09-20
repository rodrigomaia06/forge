import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';

import {
  AppScreen,
  ForgeActionSheet,
  ForgeCard,
  ForgeText as Text,
  Icon,
  lightHaptic,
  pressedFeedback,
  selectionHaptic,
} from '../components/ui';
import { DashboardHeader } from '../components/DashboardHeader';
import {
  DashboardLastWorkoutTile,
  DashboardStartCard,
  DashboardTrainingTimeCard,
  DashboardVolumeTile,
  DashboardWeekCard,
} from './dashboard/DashboardSummaryParts';
import { useWorkoutStarter } from './dashboard/workoutStarter';
import {
  lastCompletedWorkout,
  trainingTimeThisWeek,
  weekStrip,
  weekVolume,
} from './dashboard/dashboardSummary';
import { suggestNextWorkout } from '../domain/workouts/suggestNextWorkout';
import {
  DASHBOARD_TILE_DEFAULT_TITLE,
  useDashboardLayout,
  type DashboardTileConfig,
  type DashboardTileKind,
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
};

export function DashboardScreen() {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<RootNavigationProp>();
  const dockScrollInset = useForgeDockScrollInset();
  const { completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const { preferences } = useSettings();
  const starter = useWorkoutStarter();
  const { layout, setLayout } = useDashboardLayout();
  const [editing, setEditing] = useState(false);
  const [addTileOpen, setAddTileOpen] = useState(false);

  const summary = useMemo(() => {
    const now = new Date();
    const { days, workoutCount } = weekStrip(completedWorkouts, now, preferences.weekStartsOn);
    const { totalSeconds, perDaySeconds } = trainingTimeThisWeek(completedWorkouts, now, preferences.weekStartsOn);
    const { thisWeekKg, deltaPct } = weekVolume(completedWorkouts, now, preferences.weekStartsOn);
    const suggestion = suggestNextWorkout({ completedWorkouts, plans, standaloneRoutines, now });
    return {
      days,
      workoutCount,
      totalSeconds,
      perDaySeconds,
      thisWeekKg,
      deltaPct,
      suggestion,
      lastWorkout: lastCompletedWorkout(completedWorkouts),
    };
  }, [completedWorkouts, plans, standaloneRoutines, preferences.weekStartsOn]);

  const startSuggested = () => {
    if (summary.suggestion) starter.startRoutine(summary.suggestion.routine, summary.suggestion.plan);
    else starter.openChooser();
  };

  const visibleTiles = layout.filter((tile) => tile.visible);
  const hiddenTiles = layout.filter((tile) => !tile.visible);

  const persistOrder = (nextVisible: DashboardTileConfig[]) =>
    setLayout([...nextVisible, ...layout.filter((tile) => !tile.visible)]);
  const hideTile = (kind: DashboardTileKind) => {
    selectionHaptic();
    setLayout(layout.map((tile) => (tile.kind === kind ? { ...tile, visible: false } : tile)));
  };
  const addTile = (kind: DashboardTileKind) => {
    selectionHaptic();
    setLayout([
      ...layout.filter((tile) => tile.kind !== kind),
      { ...(layout.find((tile) => tile.kind === kind) ?? { kind, visible: true }), visible: true },
    ]);
    setAddTileOpen(false);
  };

  const renderTileContent = (kind: DashboardTileKind) => {
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
        return <DashboardVolumeTile thisWeekKg={summary.thisWeekKg} deltaPct={summary.deltaPct} />;
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
          keyExtractor={(tile) => tile.kind}
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
              {editing && hiddenTiles.length ? (
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
              testID={TILE_TEST_ID[item.kind]}
              name={DASHBOARD_TILE_DEFAULT_TITLE[item.kind]}
              editing={editing}
              isActive={isActive}
              onDrag={drag}
              onRemove={() => hideTile(item.kind)}
            >
              {renderTileContent(item.kind)}
            </DashboardTileFrame>
          )}
        />
        {starter.sheet}
        <ForgeActionSheet
          visible={addTileOpen}
          onClose={() => setAddTileOpen(false)}
          accessibilityLabel="Dismiss add tile chooser"
          title="Add tile"
          actions={hiddenTiles.map((tile) => ({
            label: DASHBOARD_TILE_DEFAULT_TITLE[tile.kind],
            icon: 'add' as const,
            onPress: () => addTile(tile.kind),
          }))}
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
  children,
}: {
  testID: string;
  name: string;
  editing: boolean;
  isActive: boolean;
  onDrag: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  // Normal view: a clean card with no drag rail or remove control. The reorder
  // and remove chrome only appears in edit mode (toggled from the header).
  if (!editing) {
    return (
      <View style={styles.tileWrap}>
        <ForgeCard testID={testID} style={styles.tileCard}>
          <View style={styles.plainBody}>{children}</View>
        </ForgeCard>
      </View>
    );
  }
  return (
    <View style={styles.tileWrap}>
      <ForgeCard testID={testID} style={[styles.tileCard, isActive && styles.tileCardActive]}>
        {/* A generous left rail is the drag zone, so a hold anywhere down the left
            edge of the card starts a reorder — not only on the grip icon. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${name} tile`}
          // Web mouse users can't long-press to drag, so start the reorder on
          // press-down there; touch keeps long-press so a scroll is not hijacked.
          {...(Platform.OS === 'web'
            ? { onPressIn: onDrag }
            : { onLongPress: onDrag, delayLongPress: 140 })}
          style={styles.dragRail}
        >
          <Icon name="drag" size={18} color={theme.muted} />
        </Pressable>
        <View style={styles.tileBody}>{children}</View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name} tile`}
          onPress={() => {
            lightHaptic();
            onRemove();
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
        >
          <Icon name="close" size={15} color={theme.textDestructive} />
        </Pressable>
      </ForgeCard>
    </View>
  );
}

const DRAG_RAIL_WIDTH = 40;

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
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  removeButtonPressed: { backgroundColor: theme.pressed },
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
});
