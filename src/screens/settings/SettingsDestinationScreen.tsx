import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { AppScreen, ForgeAnchoredMenu, ForgeBackButton, ForgeBottomSheet, ForgeBottomSheetHandle, ForgeCard, ForgeConfirmationDialog, ForgeFloatingCta, ForgeSheetHeader, ForgeSingleSelectList, ForgeText as Text, Icon, pressedFeedback, useAnchoredMenu } from '../../components/ui';
import type { ForgeSingleSelectOption } from '../../components/ui';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';
import { allDataTransferSelection, createSqliteBackup, databaseStatus, eraseAllForgeData, exportJson, exportText, inspectDataTransfer, mergeDataTransfer, pickJsonTransfer, pickSqliteBackup, restoreSqliteBackup, type DataTransferCategory, type DataTransferInspection, type DataTransferMergeResult, type DataTransferSelection, type ForgeDataTransfer, type ShareDescriptor } from '../../data/backupRepository';
import { clearDiagnostics, exportDiagnostics, loadDiagnostics, recordDiagnostic, type DiagnosticEntry, type DiagnosticKind } from '../../data/diagnosticsRepository';
import { loadBackupHistory, recordBackupEvent, type BackupHistory } from '../../data/backupHistory';
import { relativeTime } from '../../utils/relativeTime';
import { useSettings } from '../../state/SettingsContext';
import { usePlans } from '../../state/PlansContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useRestTimer } from '../../state/RestTimerContext';

type DestinationRoute = 'ExerciseLibrary' | 'WorkoutTypes' | 'BackupExport' | 'Logs' | 'About';
type Props = NativeStackScreenProps<RootStackParamList, DestinationRoute>;

export function SettingsDestinationScreen({ navigation, route }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const [headerElevated, setHeaderElevated] = React.useState(false);
  const title = {
    ExerciseLibrary: 'Exercises',
    WorkoutTypes: 'Workout types',
    BackupExport: 'Backup & Export',
    Logs: 'Logs',
    About: 'About',
  }[route.name];
  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader title={title} navigation={navigation} elevated={headerElevated} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          {route.name === 'BackupExport' ? (
            <BackupExport />
          ) : route.name === 'About' ? (
            <About />
          ) : route.name === 'Logs' ? (
            <Logs />
          ) : (
            <SettingsSection>
              <Text style={styles.copy}>Your exercise library will appear here.</Text>
            </SettingsSection>
          )}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function BackupExport() {
  const [busy, setBusy] = React.useState(false);
  const [transferStep, setTransferStep] = React.useState<'export-json' | 'export-text' | 'import-selection' | 'import-review' | null>(null);
  const [transfer, setTransfer] = React.useState<ForgeDataTransfer | null>(null);
  const [selection, setSelection] = React.useState<DataTransferSelection>(allDataTransferSelection);
  const [inspection, setInspection] = React.useState<DataTransferInspection | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = React.useState(false);
  const [deleteCompleteOpen, setDeleteCompleteOpen] = React.useState(false);
  const [restoreInspection, setRestoreInspection] = React.useState<Awaited<ReturnType<typeof pickSqliteBackup>>>(null);
  const [notice, setNotice] = React.useState<{ title: string; message: string; tone?: 'neutral' | 'success' } | null>(null);
  const [mergeSummary, setMergeSummary] = React.useState<DataTransferMergeResult | null>(null);
  const [history, setHistory] = React.useState<BackupHistory>({});
  const reloadHistory = React.useCallback(() => { void loadBackupHistory().then(setHistory); }, []);
  React.useEffect(() => { reloadHistory(); }, [reloadHistory]);
  const theme = useForgeTheme();
  const { reload: reloadSettings } = useSettings();
  const { reload: reloadPlans } = usePlans();
  const { reload: reloadWorkouts } = useWorkouts();
  const { reload: reloadExercises } = useExerciseCatalog();
  const { stop: stopRestTimer } = useRestTimer();
  const refresh = React.useCallback(async () => {
    stopRestTimer();
    await Promise.all([reloadSettings(), reloadPlans(), reloadWorkouts(), reloadExercises()]);
  }, [reloadExercises, reloadPlans, reloadSettings, reloadWorkouts, stopRestTimer]);
  const run = React.useCallback(async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await work(); }
    catch (error) {
      await recordDiagnostic('operation-failed', error instanceof Error && /compatible|valid|SQLite/.test(error.message) ? 'invalid-file' : 'unknown');
      setNotice({
        title: 'Could not complete this action',
        message: localDataErrorMessage(error),
      });
    } finally { setBusy(false); }
  }, [busy]);
  const importData = (): void => {
    void run(async () => {
      const incoming = await pickJsonTransfer();
      if (!incoming) return;
      setTransfer(incoming);
      // A shared single item declares exactly which sections it carries; default
      // the picker to those rather than everything.
      const nextSelection = incoming.selection ?? allDataTransferSelection();
      setSelection(nextSelection);
      setInspection(null);
      setTransferStep('import-selection');
    });
  };
  const reviewImport = (): void => {
    if (!transfer) return;
    void run(async () => {
      setInspection(await inspectDataTransfer(transfer, selection));
      setTransferStep('import-review');
    });
  };
  const mergeSelected = (): void => {
    if (!transfer) return;
    void run(async () => {
      const result = await mergeDataTransfer(transfer, selection);
      await refresh();
      await recordDiagnostic('data-imported');
      setTransferStep(null);
      setTransfer(null);
      setMergeSummary(result);
    });
  };
  const restore = (): void => {
    void run(async () => {
      const inspection = await pickSqliteBackup();
      if (!inspection) return;
      setRestoreInspection(inspection);
    });
  };
  const confirmRestore = (): void => {
    const inspection = restoreInspection;
    if (!inspection) return;
    setRestoreInspection(null);
    void run(async () => {
      await restoreSqliteBackup(inspection);
      await refresh();
      await recordDiagnostic('backup-restored');
      setNotice({
        title: 'Backup restored',
        message: `Forge reloaded ${inspection.workoutCount} workouts, ${inspection.planCount} plans and ${inspection.customExerciseCount} custom exercises from this backup.`,
        tone: 'success',
      });
    });
  };
  const erase = (): void => {
    setDeleteConfirmationOpen(true);
  };
  const confirmErase = (): void => {
    setDeleteConfirmationOpen(false);
    void run(async () => {
      stopRestTimer();
      await eraseAllForgeData();
      await Promise.all([reloadSettings(), reloadPlans(), reloadWorkouts(), reloadExercises()]);
      setDeleteCompleteOpen(true);
    });
  };
  return (
    <View style={styles.stack}>
      <SettingsSection
        title="Data transfer"
        icon="database-export"
        footer={`${history.lastExportAt ? `Last export ${relativeTime(history.lastExportAt)}. ` : ''}Portable JSON adds data without replacing your current workouts. Text is a read-only summary for sharing.`}
      >
        <Action title="Export JSON" divider onPress={() => { setSelection(allDataTransferSelection()); setTransferStep('export-json'); }} />
        <Action title="Export text" divider onPress={() => { setSelection(allDataTransferSelection()); setTransferStep('export-text'); }} />
        <View style={styles.importRow}>
          <Action title="Import JSON" disclosure={false} style={styles.importAction} onPress={importData} />
          <View
            testID="json-import-info-placeholder"
            accessible={false}
            pointerEvents="none"
            style={[
              styles.importInfoPlaceholder,
              {
                backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Icon name="info" size={20} color={theme.textSecondary} />
          </View>
        </View>
      </SettingsSection>
      <SettingsSection
        title="Database backup"
        icon="save"
        footer={Platform.OS === 'web'
          ? 'Full SQLite backup and restore are available in iOS and Android builds.'
          : `${history.lastSqliteBackupAt ? `Last backup ${relativeTime(history.lastSqliteBackupAt)}. ` : 'No SQLite backup yet. '}A complete Forge .sqlite file includes WAL changes. Restore validates it first and creates an in-app safety copy.`}
      >
        <Action title="Create SQLite backup" divider disabled={Platform.OS === 'web'} onPress={() => void run(async () => { await createSqliteBackup(); await recordBackupEvent('sqlite-backup'); await recordDiagnostic('backup-created'); reloadHistory(); })} />
        <Action title="Restore SQLite backup" divider disabled={Platform.OS === 'web'} onPress={restore} />
        <Action title="Delete all app data" destructive onPress={erase} />
      </SettingsSection>
      {busy ? <Text style={styles.unavailable}>Working securely with local data…</Text> : null}
      <DataTransferSheet
        step={transferStep}
        selection={selection}
        inspection={inspection}
        share={transferStep?.startsWith('import') ? transfer?.share : undefined}
        onChangeSelection={setSelection}
        onClose={() => { setTransferStep(null); setInspection(null); setTransfer(null); }}
        onBack={() => { setInspection(null); setTransferStep('import-selection'); }}
        onExportJson={() => void run(async () => { await exportJson(selection); await recordBackupEvent('data-export'); await recordDiagnostic('data-exported'); setTransferStep(null); reloadHistory(); })}
        onExportText={() => void run(async () => { await exportText(selection); await recordBackupEvent('data-export'); setTransferStep(null); reloadHistory(); })}
        onReviewImport={reviewImport}
        onImport={mergeSelected}
        busy={busy}
      />
      <ForgeConfirmationDialog
        visible={deleteConfirmationOpen}
        title="Delete all app data?"
        message="This permanently deletes your workouts, plans, routines, custom exercises, measurements, preferences and local diagnostics from this device. This cannot be undone."
        cancelLabel="Keep data"
        confirmLabel="Delete all data"
        onCancel={() => setDeleteConfirmationOpen(false)}
        onConfirm={confirmErase}
        testID="delete-all-data-confirmation"
      />
      <ForgeConfirmationDialog
        visible={Boolean(restoreInspection)}
        title="Replace all Forge data?"
        message={restoreInspection ? `This backup has ${restoreInspection.workoutCount} completed workouts, ${restoreInspection.planCount} plans and ${restoreInspection.customExerciseCount} custom exercises. Current device data will be replaced after a safety copy is made.` : ''}
        cancelLabel="Keep current data"
        confirmLabel="Replace data"
        confirmTone="destructive"
        onCancel={() => setRestoreInspection(null)}
        onConfirm={confirmRestore}
        testID="restore-sqlite-confirmation"
      />
      <ForgeConfirmationDialog
        visible={Boolean(notice)}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        cancelLabel="Done"
        confirmLabel="Done"
        confirmTone={notice?.tone ?? 'neutral'}
        showCancel={false}
        onCancel={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
        testID="backup-export-notice"
      />
      <ForgeConfirmationDialog
        visible={Boolean(mergeSummary)}
        title="Data merged"
        message={mergeSummary ? mergeSummaryMessage(mergeSummary) : ''}
        cancelLabel="Done"
        confirmLabel="Done"
        confirmTone="success"
        showCancel={false}
        onCancel={() => setMergeSummary(null)}
        onConfirm={() => setMergeSummary(null)}
        testID="data-merged-summary"
      />
      <ForgeConfirmationDialog
        visible={deleteCompleteOpen}
        title="All app data deleted"
        message="Forge is ready for a fresh start."
        cancelLabel="Done"
        confirmLabel="Done"
        confirmTone="success"
        showCancel={false}
        onCancel={() => setDeleteCompleteOpen(false)}
        onConfirm={() => setDeleteCompleteOpen(false)}
        testID="delete-all-data-complete"
      />
    </View>
  );
}

function localDataErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/unable to open database|prepareAsync|SQLiteError/i.test(message))
    return 'Forge could not open that SQLite file. Your current data was not changed. Choose a complete Forge backup and try again.';
  if (/compatible|integrity|header/i.test(message))
    return 'This file is not a valid Forge SQLite backup. Your current data was not changed.';
  return 'Your local data was not changed. Try again.';
}

function mergeSummaryMessage(result: DataTransferMergeResult): string {
  const labels: Record<DataTransferCategory, string> = {
    workouts: 'workouts', plans: 'plans and routines', exercises: 'custom exercises', workoutTypes: 'workout types', measurements: 'measurements',
  };
  const added = (Object.entries(result.categories) as Array<[DataTransferCategory, number]>)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${labels[key]}`);
  if (result.activeWorkoutAdded) added.push('current workout');
  return added.length
    ? `Added ${added.join(', ')}. Existing matching records stayed on device.`
    : 'No new records were needed. Matching records stayed on device.';
}

function shareKindLabel(kind: ShareDescriptor['kind']): string {
  return { routine: 'Shared routine', plan: 'Shared plan', workout: 'Shared workout', exercise: 'Shared exercise' }[kind];
}

const transferCategories: Array<{ key: DataTransferCategory; title: string; detail: string; icon: IconName }> = [
  { key: 'workouts', title: 'Workouts', detail: 'Completed training and the current workout', icon: 'history' },
  { key: 'plans', title: 'Plans & routines', detail: 'Your saved training structures', icon: 'layers' },
  { key: 'exercises', title: 'Custom exercises', detail: 'Exercises you created', icon: 'fitness' },
  { key: 'workoutTypes', title: 'Workout types', detail: 'Your type library', icon: 'activity' },
  { key: 'measurements', title: 'Measurements', detail: 'Definitions and entries', icon: 'measure' },
];

function DataTransferSheet({
  step, selection, inspection, share, onChangeSelection, onClose, onBack, onExportJson, onExportText, onReviewImport, onImport, busy,
}: {
  step: 'export-json' | 'export-text' | 'import-selection' | 'import-review' | null;
  selection: DataTransferSelection;
  inspection: DataTransferInspection | null;
  share?: ShareDescriptor;
  onChangeSelection: (selection: DataTransferSelection) => void;
  onClose: () => void;
  onBack: () => void;
  onExportJson: () => void;
  onExportText: () => void;
  onReviewImport: () => void;
  onImport: () => void;
  busy: boolean;
}) {
  const theme = useForgeTheme();
  const clearance = useForgeFloatingCtaClearance();
  const selectedCount = transferCategories.filter(({ key }) => selection[key]).length;
  const exporting = step === 'export-json' || step === 'export-text';
  const reviewing = step === 'import-review';
  const importing = step === 'import-selection' || reviewing;
  const title = exporting ? 'Export data' : reviewing ? 'Review import' : 'Choose import data';
  const toggle = (key: DataTransferCategory): void => onChangeSelection({ ...selection, [key]: !selection[key] });
  return (
    <ForgeBottomSheet
      visible={step !== null}
      onClose={onClose}
      accessibilityLabel={title}
      closeDistance={680}
      dragEnabled={false}
      style={[styles.transferSheet, { backgroundColor: theme.surfaceElevated }]}
    >
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title={title}
        closePosition="right"
        onClose={onClose}
        leading={reviewing ? <ForgeBackButton accessibilityLabel="Back" onPress={onBack} /> : undefined}
      />
      <ScrollView style={styles.transferScroll} contentContainerStyle={[styles.transferContent, { paddingBottom: clearance }]} showsVerticalScrollIndicator={false}>
        {share ? (
          <ForgeCard variant="nested" size="compact" style={styles.shareBanner}>
            <Icon name="share" size={20} color={theme.textSecondary} />
            <View style={styles.transferOptionText}>
              <Text style={[styles.transferOptionTitle, { color: theme.textPrimary }]}>{share.title}</Text>
              <Text style={[styles.transferOptionDetail, { color: theme.textSecondary }]}>
                {shareKindLabel(share.kind)}{share.summary ? ` · ${share.summary}` : ''}
              </Text>
            </View>
          </ForgeCard>
        ) : null}
        {reviewing ? (
          <ImportReview inspection={inspection} selection={selection} />
        ) : (
          <>
            <Text style={[styles.transferIntro, { color: theme.textSecondary }]}>
              {exporting
                ? 'Create a portable file with only the data you want to keep or share.'
                : 'Choose the compatible Forge data to add. Existing records are kept.'}
            </Text>
            <ForgeCard variant="nested" size="compact">
              {transferCategories.map(({ key, title: categoryTitle, detail, icon }, index) => (
                <Pressable
                  key={key}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${selection[key] ? 'Remove' : 'Include'} ${categoryTitle}`}
                  accessibilityState={{ checked: selection[key] }}
                  aria-checked={selection[key]}
                  onPress={() => toggle(key)}
                  style={({ pressed }) => [styles.transferOption, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && pressedFeedback]}
                >
                  <View style={styles.transferOptionCopy}>
                    <Icon name={icon} size={20} color={theme.textSecondary} />
                    <View style={styles.transferOptionText}>
                      <Text style={[styles.transferOptionTitle, { color: theme.textPrimary }]}>{categoryTitle}</Text>
                      <Text style={[styles.transferOptionDetail, { color: theme.textSecondary }]}>{detail}</Text>
                    </View>
                  </View>
                  <View style={[styles.transferCheck, { borderColor: selection[key] ? theme.success : theme.border, backgroundColor: selection[key] ? theme.success : 'transparent' }]}>
                    {selection[key] ? <Icon name="check" size={16} color={theme.onSuccess} /> : null}
                  </View>
                </Pressable>
              ))}
            </ForgeCard>
          </>
        )}
      </ScrollView>
      <ForgeFloatingCta
        label={reviewing ? 'Import selected data' : importing ? 'Review selected data' : 'Export selected data'}
        accessibilityLabel={reviewing ? 'Import selected data' : importing ? 'Review selected data' : 'Export selected data'}
        disabled={!selectedCount || busy}
        tone={reviewing ? 'success' : 'neutral'}
        icon={reviewing ? 'check' : undefined}
        onPress={reviewing ? onImport : importing ? onReviewImport : step === 'export-json' ? onExportJson : onExportText}
      />
    </ForgeBottomSheet>
  );
}

function ImportReview({ inspection, selection }: { inspection: DataTransferInspection | null; selection: DataTransferSelection }) {
  const theme = useForgeTheme();
  if (!inspection) return null;
  const reviewCategories = transferCategories.filter(({ key }) => (
    selection[key] && inspection.categories[key].available > 0
  ));
  return (
    <View style={styles.reviewStack}>
      {reviewCategories.length ? <ForgeCard variant="nested" size="compact">
        {reviewCategories.map(({ key, title: categoryTitle }, index) => {
          const summary = inspection.categories[key];
          return (
          <View key={key} style={[styles.reviewRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View><Text style={[styles.transferOptionTitle, { color: theme.textPrimary }]}>{categoryTitle}</Text><Text style={[styles.transferOptionDetail, { color: theme.textSecondary }]}>{key === 'plans' ? `${summary.planCount ?? 0} plans · ${summary.routineCount ?? 0} routines · ${summary.existingRecords} on device` : `${summary.available} in file · ${summary.existingRecords} on device`}</Text></View>
              <Text style={[styles.reviewNew, { color: summary.newRecords ? theme.success : theme.textSecondary }]}>{summary.newRecords} new</Text>
            </View>
          );
        })}
      </ForgeCard> : <Text style={[styles.transferNote, { color: theme.textSecondary }]}>No compatible records are selected.</Text>}
      {inspection.activeWorkout ? <Text style={[styles.transferNote, { color: theme.textSecondary }]}>Includes the current workout.</Text> : null}
    </View>
  );
}

const logFilterOptions: readonly ForgeSingleSelectOption<DiagnosticKind | 'all'>[] = [
  { value: 'all', label: 'All events' },
  { value: 'operation-failed', label: 'Failures' },
  { value: 'app-opened', label: 'App opened' },
  { value: 'data-exported', label: 'Data exported' },
  { value: 'data-imported', label: 'Data imported' },
  { value: 'backup-created', label: 'Backup created' },
  { value: 'backup-restored', label: 'Backup restored' },
];

function Logs() {
  const theme = useForgeTheme();
  const [entries, setEntries] = React.useState<DiagnosticEntry[]>([]);
  const [status, setStatus] = React.useState('Checking local storage…');
  const [filter, setFilter] = React.useState<DiagnosticKind | 'all'>('all');
  const [copied, setCopied] = React.useState<string | null>(null);
  const filterMenu = useAnchoredMenu();
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = React.useCallback(() => {
    void Promise.all([loadDiagnostics(), databaseStatus()]).then(([next, database]) => {
      setEntries(next); setStatus(`${database.database} · ${database.tables} tables · local only`);
    }).catch(() => setStatus('Local storage is unavailable.'));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  React.useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);
  const flagCopied = (id: string): void => {
    setCopied(id);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1600);
  };
  const copyEntry = (entry: DiagnosticEntry): void => {
    void Clipboard.setStringAsync(logEntryLine(entry)).then(() => flagCopied(entry.id));
  };
  const copyAll = (): void => {
    const payload = JSON.stringify({ format: 'forge-diagnostics', entries: entries.map(({ at, kind, detail }) => ({ at, kind, ...(detail ? { detail } : {}) })) }, null, 2);
    void Clipboard.setStringAsync(payload).then(() => flagCopied('all'));
  };
  const exportLogs = (): void => {
    void exportDiagnostics().catch(async () => {
      await recordDiagnostic('operation-failed', 'unavailable');
      Alert.alert('Could not export logs', 'Local diagnostics are still available on this device.');
      refresh();
    });
  };
  const clear = (): void => Alert.alert('Clear diagnostic logs?', 'This removes local technical events. Workout names, values, notes and identifiers are never recorded here.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => void clearDiagnostics().then(refresh) },
  ]);
  const visible = filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter);
  const filterLabel = logFilterOptions.find((option) => option.value === filter)?.label ?? 'All events';
  return <View style={styles.stack}>
    <SettingsSection title="Local diagnostics" icon="info" footer="Logs are private to this device and limited to 80 technical events. They never contain workout names, exercises, values, notes or identifiers.">
      <Text style={styles.copy}>{status}</Text>
    </SettingsSection>
    <SettingsSection title="Recent events">
      {entries.length ? (
        <>
          <View ref={filterMenu.ref} collapsable={false}>
            <SettingsRow
              title="Show"
              trailing={<Text style={[styles.value, { color: theme.textSecondary }]}>{filterLabel}</Text>}
              disclosure
              onPress={filterMenu.open}
              showDivider
            />
          </View>
          {visible.length ? visible.map((entry, index) => (
            <SettingsRow
              key={entry.id}
              icon={kindIcon(entry.kind)}
              iconColor={entry.kind === 'operation-failed' ? theme.textPrimary : theme.textSecondary}
              title={diagnosticLabel(entry)}
              subtitle={relativeTime(entry.at)}
              accessibilityLabel={`${diagnosticLabel(entry)}, ${new Date(entry.at).toLocaleString()}. Tap to copy.`}
              trailing={<Icon name={copied === entry.id ? 'check' : 'copy'} size={18} color={copied === entry.id ? theme.success : theme.textSecondary} />}
              onPress={() => copyEntry(entry)}
              showDivider={index < visible.length - 1}
            />
          )) : <Text style={styles.copy}>No {filterLabel.toLowerCase()} recorded.</Text>}
        </>
      ) : (
        <View style={styles.logsEmpty}>
          <Icon name="clipboard" size={30} color={theme.textSecondary} />
          <Text style={[styles.logsEmptyText, { color: theme.textSecondary }]}>No diagnostic events recorded yet.</Text>
        </View>
      )}
    </SettingsSection>
    <SettingsSection>
      <Action title={copied === 'all' ? 'Copied to clipboard' : 'Copy all logs'} icon={copied === 'all' ? 'check' : 'copy'} iconColor={copied === 'all' ? theme.success : undefined} disabled={!entries.length} disclosure={false} divider onPress={copyAll} />
      <Action title="Export logs" icon="database-export" disclosure={false} divider onPress={exportLogs} />
      <Action title="Clear logs" icon="trash" disclosure={false} destructive onPress={clear} />
    </SettingsSection>
    <ForgeAnchoredMenu
      visible={filterMenu.visible}
      anchor={filterMenu.anchor}
      onClose={filterMenu.close}
      align="end"
      minWidth={200}
      testID="logs-filter-menu"
    >
      <ForgeSingleSelectList
        options={logFilterOptions}
        selectedValue={filter}
        rounded
        disableVirtualization
        onSelect={(value) => { setFilter(value); filterMenu.close(); }}
        onSelectedPress={() => filterMenu.close()}
      />
    </ForgeAnchoredMenu>
  </View>;
}
function kindIcon(kind: DiagnosticKind): IconName {
  return ({
    'app-opened': 'play',
    'data-exported': 'database-export',
    'data-imported': 'database-import',
    'backup-created': 'save',
    'backup-restored': 'restore',
    'operation-failed': 'alert-triangle',
  } as Record<DiagnosticKind, IconName>)[kind];
}
function diagnosticLabel(entry: DiagnosticEntry): string {
  return ({ 'app-opened': 'App opened', 'data-exported': 'Data exported', 'data-imported': 'Data imported', 'backup-created': 'SQLite backup created', 'backup-restored': 'SQLite backup restored', 'operation-failed': 'Operation could not complete' } as Record<DiagnosticEntry['kind'], string>)[entry.kind];
}
function logEntryLine(entry: DiagnosticEntry): string {
  return `${new Date(entry.at).toISOString()} ${entry.kind}${entry.detail ? ` (${entry.detail})` : ''}`;
}
function About() {
  const theme = useForgeTheme();
  const openExternal = (url: string): void => {
    void Linking.openURL(url);
  };
  return (
    <View style={styles.stack}>
      <View style={styles.brand}>
        <Image
          source={require('../../../assets/forge-app-icon.png')}
          style={styles.logo}
          accessibilityLabel="Forge icon"
        />
        <View>
          <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Forge 0.1.0</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Training, kept simple.
          </Text>
        </View>
      </View>
      <SettingsSection>
        <Action
          title="Source code"
          icon="git"
          iconSize={26}
          divider
          onPress={() => openExternal('https://github.com/rodrigomaia06/Forge')}
        />
        <Action
          title="License: GPL v3.0"
          icon="license"
          iconSize={26}
          onPress={() => openExternal('https://github.com/rodrigomaia06/Forge/blob/main/LICENSE')}
        />
      </SettingsSection>
      <SettingsSection title="Privacy">
        <Text style={[styles.privacy, { color: theme.textSecondary }]}>
          Forge keeps your workouts on this device. No account, no server, no tracking.
        </Text>
      </SettingsSection>
    </View>
  );
}
function Action({
  title,
  subtitle,
  icon,
  iconColor,
  iconSize,
  onPress,
  divider = false,
  destructive = false,
  disabled = false,
  disclosure = !destructive,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  iconSize?: number;
  onPress?: () => void;
  divider?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  disclosure?: boolean;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}) {
  return (
    <SettingsRow
      title={title}
      subtitle={subtitle}
      icon={icon}
      iconColor={iconColor}
      iconSize={iconSize}
      destructive={destructive}
      disabled={!onPress || disabled}
      onPress={onPress ?? (() => undefined)}
      disclosure={disclosure}
      showDivider={divider}
      style={style}
    />
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: settingsLayout.screenPadding,
    paddingTop: settingsLayout.contentTop,
    paddingBottom: settingsLayout.contentBottom,
  },
  stack: { gap: settingsLayout.sectionGap },
  importRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center' },
  importAction: { flex: 1 },
  importInfoPlaceholder: { width: 44, height: 44, marginRight: 12, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  transferSheet: { maxHeight: '82%' },
  // Hug-then-scroll (ADR 0005): the body sizes to content and scrolls within the
  // sheet's maxHeight cap rather than parking high with dead space beneath.
  transferScroll: { flexShrink: 1 },
  transferContent: { paddingHorizontal: 20, paddingTop: 10, gap: 16 },
  transferIntro: { ...typeScale.supporting, lineHeight: 20 },
  transferOption: { minHeight: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  transferOptionCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  transferOptionText: { flex: 1, gap: 2 },
  shareBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  transferOptionTitle: { ...typeScale.controlLabel },
  transferOptionDetail: { ...typeScale.caption },
  transferCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  reviewStack: { gap: 16 },
  reviewRow: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewNew: { ...typeScale.controlLabel, textAlign: 'right' },
  transferNote: { ...typeScale.caption, lineHeight: 19, paddingHorizontal: 2 },
  unavailable: { textAlign: 'center', color: dashboardTheme.slate, ...typeScale.supporting },
  brand: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
  },
  brandTitle: { color: dashboardTheme.ink, ...typeScale.sectionTitle },
  brandSubtitle: { marginTop: 3, color: dashboardTheme.slate, ...typeScale.supporting },
  privacy: { padding: 18, color: dashboardTheme.slate, ...typeScale.supporting },
  copy: { padding: 20, color: dashboardTheme.slate, ...typeScale.body },
  value: { ...typeScale.supporting },
  logsEmpty: { paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  logsEmptyText: { ...typeScale.supporting, textAlign: 'center' },
});
