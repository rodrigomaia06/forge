import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, Button, ForgeCard, ForgeConfirmationDialog, ForgeFloatingCta, ForgeText as Text, Icon } from '../../components/ui';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { settingsLayout } from './SettingsRow';
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
// The scalar fields `importDiff` compares per kind, in emission order. A conflict's
// `changes` is [...fields, ...children]; the field labels let us split the flat list
// back into a "Details" group and a child group without a raw text hunk.
const SCALAR_LABELS: Record<ShareConflict['kind'], readonly string[]> = {
  routine: ['Name', 'Type', 'Note'],
  workout: ['Name', 'Type', 'Note'],
  plan: ['Name', 'Description'],
  exercise: ['Name', 'Muscle', 'Equipment', 'Category', 'Rest'],
};
const CHILD_GROUP: Record<ShareConflict['kind'], string | null> = {
  routine: 'Exercises', workout: 'Exercises', plan: 'Routines', exercise: null,
};
const CHANGE_MARKER: Record<ShareChange['type'], string> = { added: '+', removed: '−', changed: '~' };

/** Split the flat change list into its scalar "Details" and its child group. */
function splitChanges(conflict: ShareConflict): { details: ShareChange[]; children: ShareChange[] } {
  const scalar = new Set<string>(SCALAR_LABELS[conflict.kind]);
  const boundary = conflict.changes.findIndex((change) => !scalar.has(change.label));
  if (boundary === -1) return { details: conflict.changes, children: [] };
  return { details: conflict.changes.slice(0, boundary), children: conflict.changes.slice(boundary) };
}

export function ImportConflictScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const clearance = useForgeFloatingCtaClearance();
  const { reload: reloadSettings } = useSettings();
  const { reload: reloadPlans } = usePlans();
  const { reload: reloadWorkouts } = useWorkouts();
  const { reload: reloadExercises } = useExerciseCatalog();
  const { stop: stopRestTimer } = useRestTimer();

  const [pending] = useState(() => takePendingConflict());
  const [headerElevated, setHeaderElevated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<DataTransferMergeResult | null>(null);

  // Re-entry without a stashed conflict (e.g. a back swipe that re-mounts) has
  // nothing to resolve.
  useEffect(() => { if (!pending) navigation.goBack(); }, [pending, navigation]);

  const groups = useMemo(() => (pending ? splitChanges(pending.conflict) : { details: [], children: [] }), [pending]);
  if (!pending) return null;
  const { conflict } = pending;
  const noun = KIND_NOUN[conflict.kind];
  const childGroupTitle = CHILD_GROUP[conflict.kind];

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

  const renderGroup = (title: string, changes: ShareChange[]): React.ReactNode => {
    if (!changes.length) return null;
    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{title}</Text>
        <ForgeCard variant="nested" size="compact">
          {changes.map((change, index) => (
            <View
              key={`${change.type}-${change.label}-${index}`}
              style={[styles.changeRow, index > 0 && styles.changeDivider]}
            >
              <Text
                style={[styles.changeMarker, { color: markerColor(change.type, theme) }]}
                accessibilityLabel={changeAccessibility(change.type)}
              >
                {CHANGE_MARKER[change.type]}
              </Text>
              <View style={styles.changeCopy}>
                <Text style={styles.changeLabel}>{change.label}</Text>
                {change.detail ? <Text style={styles.changeDetail}>{change.detail}</Text> : null}
              </View>
            </View>
          ))}
        </ForgeCard>
      </View>
    );
  };

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
              <Icon name="share" size={20} color={theme.textSecondary} />
              <Text style={styles.leadTitle} numberOfLines={2}>{conflict.name}</Text>
            </View>
            <Text style={styles.leadSub}>This replaces the {noun} already on this device.</Text>
            {conflict.summary ? <Text style={styles.leadSummary}>{conflict.summary}</Text> : null}
          </View>
          {renderGroup('Details', groups.details)}
          {childGroupTitle ? renderGroup(childGroupTitle, groups.children) : null}
          <View style={styles.secondaryActions}>
            <Button label="Keep both" variant="outline" onPress={() => resolve('keepBoth')} disabled={busy} style={styles.secondaryButton} />
            <Button label="Skip" variant="ghost" tone="destructive" onPress={() => resolve('skip')} disabled={busy} style={styles.secondaryButton} />
          </View>
        </ScrollView>
        <ForgeFloatingCta
          label="Update"
          accessibilityLabel="Update"
          disabled={busy}
          tone="success"
          icon="check"
          onPress={() => resolve('update')}
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
    group: { gap: 8 },
    groupTitle: { ...typeScale.controlLabel, color: theme.textPrimary, paddingHorizontal: 6 },
    changeRow: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    changeDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    changeMarker: { ...typeScale.controlLabel, width: 14, textAlign: 'center', lineHeight: 22 },
    changeCopy: { flex: 1, gap: 2 },
    changeLabel: { ...typeScale.body, color: theme.textPrimary },
    changeDetail: { ...typeScale.caption, color: theme.textSecondary },
    secondaryActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 6 },
    secondaryButton: { flex: 1 },
  });
