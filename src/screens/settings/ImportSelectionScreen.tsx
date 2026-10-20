import { ForgeEntityName } from '../../components/ui';
import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeCard, ForgeConfirmationDialog, ForgeFloatingCta, ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../../components/ui';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsSection, settingsLayout } from './SettingsRow';
import { takePendingImport } from '../../state/pendingImport';
import { emptyImportSelection, filterTransferToSelection, transferItems, type ImportSelectionKey } from '../../data/importSelection';
import { mergeDataTransfer, type DataTransferMergeResult, type ForgeDataTransfer } from '../../data/backupRepository';
import { useSettings } from '../../state/SettingsContext';
import { usePlans } from '../../state/PlansContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useRestTimer } from '../../state/RestTimerContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportSelection'>;

const CATEGORY_META: { key: ImportSelectionKey; title: string; icon: IconName }[] = [
  { key: 'workouts', title: 'Workouts', icon: 'history' },
  { key: 'plans', title: 'Plans', icon: 'layers' },
  { key: 'routines', title: 'Routines', icon: 'book' },
  { key: 'exercises', title: 'Custom exercises', icon: 'fitness' },
  { key: 'workoutTypes', title: 'Workout types', icon: 'tag' },
  { key: 'measurements', title: 'Measurements', icon: 'measure' },
];

export function ImportSelectionScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const clearance = useForgeFloatingCtaClearance();
  const { reload: reloadSettings, preferences } = useSettings();
  const { reload: reloadPlans, plans, standaloneRoutines } = usePlans();
  const { reload: reloadWorkouts, completedWorkouts } = useWorkouts();
  const { reload: reloadExercises, customExercises } = useExerciseCatalog();
  const { stop: stopRestTimer } = useRestTimer();

  const [transfer] = useState<ForgeDataTransfer | null>(() => takePendingImport());
  const items = useMemo(() => (transfer ? transferItems(transfer) : null), [transfer]);
  const categories = useMemo(
    () => (items ? CATEGORY_META.filter((meta) => items[meta.key].length > 0) : []),
    [items],
  );
  // Records already on this device — used to flag them and default them off, so
  // an import adds only what's genuinely new.
  const onDevice = useMemo<Record<ImportSelectionKey, Set<string>>>(() => ({
    workouts: new Set(completedWorkouts.map((w) => w.id)),
    plans: new Set(plans.map((p) => p.id)),
    routines: new Set(standaloneRoutines.map((r) => r.id)),
    exercises: new Set(customExercises.map((e) => e.id)),
    workoutTypes: new Set(preferences.workoutTypes.map((t) => t.id)),
    measurements: new Set(preferences.dailyMeasurementDefinitions.map((d) => d.id)),
  }), [completedWorkouts, plans, standaloneRoutines, customExercises, preferences]);
  const [selection, setSelection] = useState(() => {
    const next = emptyImportSelection();
    if (items) for (const meta of CATEGORY_META) items[meta.key].forEach((item) => { if (!onDevice[meta.key].has(item.id)) next[meta.key].add(item.id); });
    return next;
  });
  const [expanded, setExpanded] = useState<Set<ImportSelectionKey>>(() => new Set(categories.length ? [categories[0].key] : []));
  const [headerElevated, setHeaderElevated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<DataTransferMergeResult | null>(null);

  // Re-entry without a pending file (e.g. after a back swipe) has nothing to show.
  useEffect(() => { if (!transfer) navigation.goBack(); }, [transfer, navigation]);
  if (!transfer || !items) return null;

  const totalSelected = CATEGORY_META.reduce((sum, meta) => sum + selection[meta.key].size, 0);

  const toggleItem = (key: ImportSelectionKey, id: string): void => {
    selectionHaptic();
    setSelection((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(id)) next[key].delete(id);
      else next[key].add(id);
      return next;
    });
  };
  const toggleAll = (key: ImportSelectionKey): void => {
    selectionHaptic();
    setSelection((prev) => {
      const all = items[key];
      const allOn = all.every((item) => prev[key].has(item.id));
      return { ...prev, [key]: allOn ? new Set() : new Set(all.map((item) => item.id)) };
    });
  };
  const toggleExpanded = (key: ImportSelectionKey): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const runImport = (): void => {
    if (busy || !totalSelected) return;
    setBusy(true);
    void (async () => {
      try {
        stopRestTimer();
        const result = await mergeDataTransfer(filterTransferToSelection(transfer, selection));
        await Promise.all([reloadSettings(), reloadPlans(), reloadWorkouts(), reloadExercises()]);
        setSummary(result);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader title="Import" navigation={navigation} elevated={headerElevated} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: clearance + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <Text style={[styles.intro, { color: theme.textSecondary }]}>Choose exactly what to add. Records already on this device are kept.</Text>
          {categories.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="database-import" size={30} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>This file carries no importable records.</Text>
            </View>
          ) : null}
          {categories.map((meta) => {
            const all = items[meta.key];
            const selected = selection[meta.key];
            const allOn = all.every((item) => selected.has(item.id));
            const someOn = !allOn && all.some((item) => selected.has(item.id));
            const isExpanded = expanded.has(meta.key);
            return (
              <SettingsSection key={meta.key}>
                <View style={styles.categoryHeader}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: allOn }}
                    accessibilityLabel={`${allOn ? 'Deselect all' : 'Select all'} ${meta.title}`}
                    onPress={() => toggleAll(meta.key)}
                    hitSlop={10}
                    style={[styles.check, { borderColor: allOn || someOn ? theme.selectionIndicator : theme.border, backgroundColor: allOn ? theme.selectionIndicator : 'transparent' }]}
                  >
                    {allOn ? <Icon name="check" size={16} color={theme.onActionPrimary} /> : someOn ? <View style={[styles.partial, { backgroundColor: theme.selectionIndicator }]} /> : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${meta.title}, ${selected.size} of ${all.length} selected`}
                    onPress={() => toggleExpanded(meta.key)}
                    style={({ pressed }) => [styles.categoryExpand, pressed && pressedFeedback]}
                  >
                    <Icon name={meta.icon} size={20} color={theme.textSecondary} />
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryTitle}>{meta.title}</Text>
                      <Text style={styles.categorySub}>{selected.size} of {all.length} selected</Text>
                    </View>
                    <Icon name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
                {isExpanded ? all.map((item, index) => {
                  const checked = selected.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      accessibilityLabel={item.label}
                      onPress={() => toggleItem(meta.key, item.id)}
                      style={({ pressed }) => [styles.itemRow, index === 0 && styles.itemFirst, pressed && pressedFeedback]}
                    >
                      <View style={[styles.check, { borderColor: checked ? theme.selectionIndicator : theme.border, backgroundColor: checked ? theme.selectionIndicator : 'transparent' }]}>
                        {checked ? <Icon name="check" size={16} color={theme.onActionPrimary} /> : null}
                      </View>
                      <View style={styles.itemCopy}>
                        <ForgeEntityName style={styles.itemLabel} presentation="full">{item.label}</ForgeEntityName>
                        {item.sublabel ? <ForgeEntityName style={styles.itemSub} presentation="full">{item.sublabel}</ForgeEntityName> : null}
                      </View>
                      {onDevice[meta.key].has(item.id) ? <Text style={[styles.onDeviceTag, { color: theme.textSecondary }]}>On device</Text> : null}
                    </Pressable>
                  );
                }) : null}
              </SettingsSection>
            );
          })}
        </ScrollView>
        <ForgeFloatingCta
          label={busy ? 'Importing…' : `Import ${totalSelected} item${totalSelected === 1 ? '' : 's'}`}
          accessibilityLabel={`Import ${totalSelected} item${totalSelected === 1 ? '' : 's'}`}
          disabled={!totalSelected || busy}
          tone="success"
          icon="check"
          onPress={runImport}
        />
        <ForgeConfirmationDialog
          visible={Boolean(summary)}
          title="Import complete"
          message={summary ? importSummaryMessage(summary) : ''}
          cancelLabel="Done"
          confirmLabel="Done"
          confirmTone="success"
          showCancel={false}
          onCancel={() => { setSummary(null); navigation.goBack(); }}
          onConfirm={() => { setSummary(null); navigation.goBack(); }}
          testID="import-selection-summary"
        />
      </View>
    </AppScreen>
  );
}

function importSummaryMessage(result: DataTransferMergeResult): string {
  const labels: Record<string, string> = {
    workouts: 'workouts', plans: 'plans and routines', exercises: 'custom exercises', workoutTypes: 'workout types', measurements: 'measurements',
  };
  const added = Object.entries(result.categories)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${n} ${labels[key] ?? key}`);
  const base = added.length ? `Added ${added.join(', ')}. Existing matching records stayed on device.` : 'Everything selected was already on this device.';
  if (result.renamed.length) {
    return `${base}\n\nRenamed to avoid duplicates: ${result.renamed.map(({ from, to }) => `“${from}” → “${to}”`).join(', ')}.`;
  }
  return base;
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    content: { padding: settingsLayout.screenPadding, paddingTop: settingsLayout.contentTop, gap: settingsLayout.sectionGap },
    intro: { ...typeScale.supporting, lineHeight: 20, paddingHorizontal: 6 },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
    emptyText: { ...typeScale.supporting, textAlign: 'center' },
    categoryHeader: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    categoryExpand: { flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
    categoryCopy: { flex: 1, minWidth: 0 },
    categoryTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
    categorySub: { ...typeScale.caption, color: theme.textSecondary, marginTop: 1 },
    itemRow: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    itemFirst: { borderTopColor: theme.border },
    itemCopy: { flex: 1, minWidth: 0 },
    itemLabel: { ...typeScale.body, color: theme.textPrimary },
    itemSub: { ...typeScale.caption, color: theme.textSecondary, marginTop: 1 },
    onDeviceTag: { ...typeScale.caption },
    // Rounded-square, not a full circle, so multi-select reads differently from a radio.
    check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    partial: { width: 10, height: 2, borderRadius: 1 },
  });
