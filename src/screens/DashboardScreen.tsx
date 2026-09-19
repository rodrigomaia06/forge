import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';

import {
  AppScreen,
  Button,
  ForgeActionSheet,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput,
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
  const [renameTarget, setRenameTarget] = useState<DashboardTileConfig | null>(null);
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
  const renameTile = (kind: DashboardTileKind, title: string | undefined) =>
    setLayout(layout.map((tile) => (tile.kind === kind ? { ...tile, title } : tile)));

  const renderTileContent = (tile: DashboardTileConfig) => {
    switch (tile.kind) {
      case 'start':
        return (
          <DashboardStartCard
            suggestion={summary.suggestion}
            workoutTypes={preferences.workoutTypes}
            onStart={startSuggested}
            onChooseAnother={starter.openChooser}
          />
        );
      case 'week':
        return <DashboardWeekCard days={summary.days} workoutCount={summary.workoutCount} title={tile.title} />;
      case 'training-time':
        return (
          <DashboardTrainingTimeCard
            totalSeconds={summary.totalSeconds}
            perDaySeconds={summary.perDaySeconds}
            days={summary.days}
            title={tile.title}
          />
        );
      case 'last-workout':
        return (
          <DashboardLastWorkoutTile
            lastWorkout={summary.lastWorkout}
            workoutTypes={preferences.workoutTypes}
            title={tile.title}
            onOpen={(workoutId) => navigation.navigate('WorkoutDetails', { workoutId })}
          />
        );
      case 'volume':
        return <DashboardVolumeTile thisWeekKg={summary.thisWeekKg} deltaPct={summary.deltaPct} title={tile.title} />;
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
          extraData={{ editing, summary }}
          activationDistance={editing ? 8 : 10000}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: dockScrollInset }}
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
            editing && hiddenTiles.length ? (
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
            ) : null
          }
          onDragEnd={({ data }) => persistOrder(data)}
          renderItem={({ item, drag, isActive }) => (
            <DashboardTileFrame
              editing={editing}
              isActive={isActive}
              name={item.title ?? DASHBOARD_TILE_DEFAULT_TITLE[item.kind]}
              canRename={item.kind !== 'start'}
              onDrag={drag}
              onRename={() => {
                lightHaptic();
                setRenameTarget(item);
              }}
              onRemove={() => hideTile(item.kind)}
            >
              {renderTileContent(item)}
            </DashboardTileFrame>
          )}
        />
        {starter.sheet}
        <RenameTileSheet
          target={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSave={(kind, title) => {
            renameTile(kind, title);
            setRenameTarget(null);
          }}
        />
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
  editing,
  isActive,
  name,
  canRename,
  onDrag,
  onRename,
  onRemove,
  children,
}: {
  editing: boolean;
  isActive: boolean;
  name: string;
  canRename: boolean;
  onDrag: () => void;
  onRename: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  if (!editing) return <View style={styles.tileWrap}>{children}</View>;
  return (
    <View style={[styles.tileWrap, isActive && styles.tileWrapActive]}>
      <View style={styles.editBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reorder ${name} tile`}
            onLongPress={onDrag}
            delayLongPress={120}
            style={({ pressed }) => [styles.editControl, pressed && pressedFeedback]}
          >
            <Icon name="drag" size={19} color={theme.slate} />
          </Pressable>
          <View style={styles.editBarSpacer} />
          {canRename ? (
            <Pressable
              accessibilityRole="button"
            accessibilityLabel={`Rename ${name} tile`}
              onPress={onRename}
              style={({ pressed }) => [styles.editControl, pressed && pressedFeedback]}
            >
              <Icon name="note" size={18} color={theme.slate} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name} tile`}
            onPress={onRemove}
            style={({ pressed }) => [styles.editControl, pressed && pressedFeedback]}
          >
            <Icon name="close" size={18} color={theme.textDestructive} />
          </Pressable>
        </View>
      <View pointerEvents="none">{children}</View>
    </View>
  );
}

function RenameTileSheet({
  target,
  onClose,
  onSave,
}: {
  target: DashboardTileConfig | null;
  onClose: () => void;
  onSave: (kind: DashboardTileKind, title: string | undefined) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState('');
  useEffect(() => {
    if (target) setText(target.title ?? '');
  }, [target]);
  const defaultTitle = target ? DASHBOARD_TILE_DEFAULT_TITLE[target.kind] : '';
  return (
    <ForgeBottomSheet
      visible={target !== null}
      onClose={onClose}
      accessibilityLabel="Close rename tile"
      initialOffset={340}
      closeDistance={340}
      dismissThreshold={150}
    >
      {(close) => (
        <View style={styles.renameSheet}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title="Rename tile" onClose={close} closeAccessibilityLabel="Cancel rename" />
          <View style={styles.renameBody}>
            <ForgeTextInput
              value={text}
              onChangeText={setText}
              placeholder={defaultTitle}
              placeholderTextColor={theme.muted}
              accessibilityLabel="Tile title"
              style={styles.renameInput}
              autoFocus
            />
            <View style={styles.renameActions}>
              <Button
                label="Reset to default"
                variant="ghost"
                onPress={() => target && onSave(target.kind, undefined)}
              />
              <Button
                label="Save"
                onPress={() => target && onSave(target.kind, text.trim() || undefined)}
              />
            </View>
          </View>
        </View>
      )}
    </ForgeBottomSheet>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  appShell: { flex: 1, minHeight: 0 },
  tileWrap: { paddingHorizontal: 20, marginBottom: 14 },
  tileWrapActive: { opacity: 0.96 },
  editBar: { flexDirection: 'row', alignItems: 'center', height: 34, marginBottom: 4 },
  editBarSpacer: { flex: 1 },
  editControl: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  addTileRow: {
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 14,
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
  renameSheet: { alignSelf: 'stretch' },
  renameBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  renameInput: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.input,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.ink,
    ...typeScale.body,
  },
  renameActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
