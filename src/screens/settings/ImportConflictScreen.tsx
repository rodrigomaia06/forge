import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, Button, ForgeConfirmationDialog, ForgeFloatingCta, ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../../components/ui';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsSection, settingsLayout } from './SettingsRow';
import { resolveWorkoutTypeIcon } from './workoutTypeIcon';
import { takePendingConflict } from '../../state/pendingConflict';
import { mergeDataTransfer, type DataTransferMergeResult } from '../../data/backupRepository';
import { recordDiagnostic } from '../../data/diagnosticsRepository';
import type { ShareChange, ShareConflict, ShareResolution } from '../../data/importDiff';
import { mergeSummaryMessage } from './SettingsDestinationScreen';
import { useSettings } from '../../state/SettingsContext';
import { usePlans } from '../../state/PlansContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useRestTimer } from '../../state/RestTimerContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportConflict'>;

const KIND_NOUN: Record<ShareConflict['kind'], string> = {
  routine: 'routine', plan: 'plan', workout: 'workout', exercise: 'exercise',
};
// The child a conflict groups under, and the section header icon for it.
const CHILD_GROUP: Record<ShareConflict['kind'], { title: string; icon: IconName } | null> = {
  routine: { title: 'Exercises', icon: 'fitness' },
  workout: { title: 'Exercises', icon: 'fitness' },
  plan: { title: 'Routines', icon: 'book' },
  exercise: null,
};
const CHANGE_MARKER: Record<ShareChange['type'], string> = { added: '+', removed: '−', changed: '~' };

type Group = { key: 'details' | 'children'; title: string; icon: IconName; changes: ShareChange[] };

export function ImportConflictScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const clearance = useForgeFloatingCtaClearance();
  const { reload: reloadSettings, preferences } = useSettings();
  const { reload: reloadPlans } = usePlans();
  const { reload: reloadWorkouts } = useWorkouts();
  const { reload: reloadExercises } = useExerciseCatalog();
  const { stop: stopRestTimer } = useRestTimer();

  const [pending] = useState(() => takePendingConflict());
  const [headerElevated, setHeaderElevated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<DataTransferMergeResult | null>(null);
  // Every change unit defaults to CHECKED: all-checked "Update" == a full replace.
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(pending ? pending.conflict.changes.map((change) => change.id) : []),
  );
  const [expanded, setExpanded] = useState<Set<Group['key']>>(() => new Set(['details', 'children']));

  // Re-entry without a stashed conflict (e.g. a back swipe that re-mounts) has
  // nothing to resolve.
  useEffect(() => { if (!pending) navigation.goBack(); }, [pending, navigation]);

  const groups = useMemo<Group[]>(() => {
    if (!pending) return [];
    const child = CHILD_GROUP[pending.conflict.kind];
    const details = pending.conflict.changes.filter((change) => change.group === 'field');
    const children = pending.conflict.changes.filter((change) => change.group === 'child');
    const out: Group[] = [];
    if (details.length) out.push({ key: 'details', title: 'Details', icon: 'replace', changes: details });
    if (child && children.length) out.push({ key: 'children', title: child.title, icon: child.icon, changes: children });
    return out;
  }, [pending]);

  if (!pending) return null;
  const { conflict } = pending;
  const noun = KIND_NOUN[conflict.kind];
  const leadIcon = leadItemIcon(conflict, preferences.workoutTypes);

  const toggleUnit = (id: string): void => {
    selectionHaptic();
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleGroup = (group: Group): void => {
    selectionHaptic();
    setChecked((prev) => {
      const allOn = group.changes.every((change) => prev.has(change.id));
      const next = new Set(prev);
      for (const change of group.changes) {
        if (allOn) next.delete(change.id);
        else next.add(change.id);
      }
      return next;
    });
  };
  const toggleExpanded = (key: Group['key']): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resolve = (resolution: ShareResolution): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        stopRestTimer();
        const result = await mergeDataTransfer(pending.transfer, pending.selection, resolution);
        await Promise.all([reloadSettings(), reloadPlans(), reloadWorkouts(), reloadExercises()]);
        await recordDiagnostic('data-imported');
        setSummary(result);
      } finally {
        setBusy(false);
      }
    })();
  };

  const childIconFor = (change: ShareChange): IconName =>
    conflict.kind === 'plan' ? resolveWorkoutTypeIcon(change.childType, preferences.workoutTypes) : 'fitness';

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen} testID="import-conflict-screen">
        <SettingsDetailHeader title="Review update" navigation={navigation} elevated={headerElevated} backAccessibilityLabel="Cancel import" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: clearance + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <View style={styles.lead}>
            <View style={styles.leadHead}>
              <View testID="import-conflict-lead-icon">
                <Icon name={leadIcon} size={20} color={theme.textSecondary} />
              </View>
              <Text style={styles.leadTitle} numberOfLines={2}>{conflict.name}</Text>
            </View>
            <Text style={styles.leadSub}>This replaces the {noun} already on this device.</Text>
            <Text style={styles.leadSummary}>Choose what to keep. {conflict.summary}</Text>
          </View>
          {groups.map((group) => {
            const allOn = group.changes.every((change) => checked.has(change.id));
            const someOn = !allOn && group.changes.some((change) => checked.has(change.id));
            const isExpanded = expanded.has(group.key);
            const selectedCount = group.changes.filter((change) => checked.has(change.id)).length;
            const showChildIcon = group.key === 'children';
            return (
              <SettingsSection key={group.key}>
                <View style={styles.groupHeader}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: allOn }}
                    accessibilityLabel={`${allOn ? 'Deselect all' : 'Select all'} ${group.title}`}
                    onPress={() => toggleGroup(group)}
                    hitSlop={10}
                    style={[styles.check, { borderColor: allOn || someOn ? theme.selectionIndicator : theme.border, backgroundColor: allOn ? theme.selectionIndicator : 'transparent' }]}
                  >
                    {allOn ? <Icon name="check" size={16} color={theme.onActionPrimary} /> : someOn ? <View style={[styles.partial, { backgroundColor: theme.selectionIndicator }]} /> : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${group.title}, ${selectedCount} of ${group.changes.length} selected`}
                    onPress={() => toggleExpanded(group.key)}
                    style={({ pressed }) => [styles.groupExpand, pressed && pressedFeedback]}
                  >
                    <Icon name={group.icon} size={20} color={theme.textSecondary} />
                    <View style={styles.groupCopy}>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <Text style={styles.groupSub}>{selectedCount} of {group.changes.length} selected</Text>
                    </View>
                    <Icon name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
                {isExpanded ? group.changes.map((change, index) => {
                  const isChecked = checked.has(change.id);
                  return (
                    <Pressable
                      key={change.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                      accessibilityLabel={change.label}
                      onPress={() => toggleUnit(change.id)}
                      style={({ pressed }) => [styles.itemRow, index === 0 && styles.itemFirst, pressed && pressedFeedback]}
                    >
                      <View style={[styles.check, { borderColor: isChecked ? theme.selectionIndicator : theme.border, backgroundColor: isChecked ? theme.selectionIndicator : 'transparent' }]}>
                        {isChecked ? <Icon name="check" size={16} color={theme.onActionPrimary} /> : null}
                      </View>
                      {showChildIcon ? (
                        <View testID={`import-conflict-icon-${change.id}`}>
                          <Icon name={childIconFor(change)} size={20} color={theme.textSecondary} />
                        </View>
                      ) : null}
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemLabel} numberOfLines={1}>{change.label}</Text>
                        {change.detail ? <Text style={styles.itemSub} numberOfLines={1}>{change.detail}</Text> : null}
                      </View>
                      <Text
                        style={[styles.marker, { color: markerColor(change.type, theme) }]}
                        accessibilityLabel={changeAccessibility(change.type)}
                      >
                        {CHANGE_MARKER[change.type]}
                      </Text>
                    </Pressable>
                  );
                }) : null}
              </SettingsSection>
            );
          })}
          <View style={styles.secondaryActions}>
            <Button label="Keep both" variant="outline" onPress={() => resolve('keepBoth')} disabled={busy} style={styles.secondaryButton} />
            <Button label="Skip" variant="ghost" tone="destructive" onPress={() => resolve('skip')} disabled={busy} style={styles.secondaryButton} />
          </View>
        </ScrollView>
        <ForgeFloatingCta
          label="Update"
          accessibilityLabel="Update"
          disabled={busy || checked.size === 0}
          tone="success"
          icon="check"
          onPress={() => resolve({ kind: 'update', selectedIds: [...checked] })}
        />
        <ForgeConfirmationDialog
          visible={Boolean(summary)}
          title="Data merged"
          message={summary ? mergeSummaryMessage(summary) : ''}
          cancelLabel="Done"
          confirmLabel="Done"
          confirmTone="success"
          showCancel={false}
          onCancel={() => { setSummary(null); navigation.goBack(); }}
          onConfirm={() => { setSummary(null); navigation.goBack(); }}
          testID="import-conflict-summary"
        />
      </View>
    </AppScreen>
  );
}

function leadItemIcon(conflict: ShareConflict, workoutTypes: import('../../types').WorkoutTypePreference[]): IconName {
  if (conflict.kind === 'plan') return 'layers';
  if (conflict.kind === 'exercise') return 'fitness';
  return resolveWorkoutTypeIcon(conflict.type, workoutTypes);
}

function markerColor(type: ShareChange['type'], theme: import('../../types').ForgeTheme): string {
  if (type === 'added') return theme.success;
  if (type === 'removed') return theme.textDestructive;
  return theme.textSecondary;
}

function changeAccessibility(type: ShareChange['type']): string {
  return type === 'added' ? 'Added' : type === 'removed' ? 'Removed' : 'Changed';
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    content: { padding: settingsLayout.screenPadding, paddingTop: settingsLayout.contentTop, gap: settingsLayout.sectionGap },
    lead: { gap: 6, paddingHorizontal: 6 },
    leadHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    leadTitle: { flex: 1, ...typeScale.sectionTitle, color: theme.textPrimary },
    leadSub: { ...typeScale.supporting, lineHeight: 20, color: theme.textSecondary },
    leadSummary: { ...typeScale.caption, color: theme.textSecondary },
    groupHeader: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    groupExpand: { flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
    groupCopy: { flex: 1, minWidth: 0 },
    groupTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
    groupSub: { ...typeScale.caption, color: theme.textSecondary, marginTop: 1 },
    itemRow: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    itemFirst: { borderTopColor: theme.border },
    itemCopy: { flex: 1, minWidth: 0 },
    itemLabel: { ...typeScale.body, color: theme.textPrimary },
    itemSub: { ...typeScale.caption, color: theme.textSecondary, marginTop: 1 },
    marker: { ...typeScale.controlLabel, width: 14, textAlign: 'center' },
    secondaryActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 6 },
    secondaryButton: { flex: 1 },
    // Rounded-square, not a full circle, so multi-select reads differently from a radio.
    check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    partial: { width: 10, height: 2, borderRadius: 1 },
  });
