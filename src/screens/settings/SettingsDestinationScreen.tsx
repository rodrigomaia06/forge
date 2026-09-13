import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, ForgeBackButton, ForgeBottomSheet, ForgeCard, ForgeFloatingCta, ForgeSheetHeader, ForgeText as Text, Icon, pressedFeedback } from '../../components/ui';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';
import { allDataTransferSelection, createSqliteBackup, databaseStatus, exportJson, exportText, inspectDataTransfer, mergeDataTransfer, pickJsonTransfer, pickSqliteBackup, restoreSqliteBackup, type DataTransferCategory, type DataTransferInspection, type DataTransferSelection, type ForgeDataTransfer } from '../../data/backupRepository';
import { clearDiagnostics, exportDiagnostics, loadDiagnostics, recordDiagnostic, type DiagnosticEntry } from '../../data/diagnosticsRepository';
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
  const [transferStep, setTransferStep] = React.useState<'export-json' | 'export-text' | 'import-select' | 'import-review' | null>(null);
  const [transfer, setTransfer] = React.useState<ForgeDataTransfer | null>(null);
  const [selection, setSelection] = React.useState<DataTransferSelection>(allDataTransferSelection);
  const [inspection, setInspection] = React.useState<DataTransferInspection | null>(null);
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
  const run = React.useCallback(async (work: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(true);
    try { await work(); if (success) Alert.alert('Done', success); }
    catch (error) {
      await recordDiagnostic('operation-failed', error instanceof Error && /compatible|valid|SQLite/.test(error.message) ? 'invalid-file' : 'unknown');
      Alert.alert('Could not complete this action', error instanceof Error ? error.message : 'Try again.');
    } finally { setBusy(false); }
  }, [busy]);
  const importData = (): void => {
    void run(async () => {
      const incoming = await pickJsonTransfer();
      if (!incoming) return;
      setTransfer(incoming);
      setSelection(allDataTransferSelection());
      setInspection(null);
      setTransferStep('import-select');
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
      Alert.alert('Data merged', `${result.workouts} workouts and ${result.exercises} exercises were added.`);
    });
  };
  const restore = (): void => {
    void run(async () => {
      const inspection = await pickSqliteBackup();
      if (!inspection) return;
      const confirmed = await new Promise<boolean>((resolve) => Alert.alert(
        'Replace all Forge data?',
        `This backup has ${inspection.workoutCount} completed workouts, ${inspection.planCount} plans and ${inspection.customExerciseCount} custom exercises. Current device data will be replaced after a safety copy is made.`,
        [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Replace data', style: 'destructive', onPress: () => resolve(true) }],
      ));
      if (!confirmed) return;
      await restoreSqliteBackup(inspection);
      await refresh();
      await recordDiagnostic('backup-restored');
      Alert.alert('Backup restored', 'Forge has reloaded the restored data.');
    });
  };
  return (
    <View style={styles.stack}>
      <SettingsSection
        title="Data transfer"
        footer="Portable JSON adds data without replacing your current workouts. Text is a read-only summary for sharing."
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
        footer={Platform.OS === 'web' ? 'Full SQLite backup and restore are available in iOS and Android builds.' : 'A complete Forge .sqlite file includes WAL changes. Restore validates it first and creates an in-app safety copy.'}
      >
        <Action title="Create SQLite backup" divider disabled={Platform.OS === 'web'} onPress={() => void run(async () => { await createSqliteBackup(); await recordDiagnostic('backup-created'); })} />
        <Action title="Restore SQLite backup" disabled={Platform.OS === 'web'} onPress={restore} />
      </SettingsSection>
      {busy ? <Text style={styles.unavailable}>Working securely with local data…</Text> : null}
      <DataTransferSheet
        step={transferStep}
        selection={selection}
        inspection={inspection}
        onChangeSelection={setSelection}
        onClose={() => { setTransferStep(null); setInspection(null); }}
        onBack={() => setTransferStep('import-select')}
        onExportJson={() => void run(async () => { await exportJson(selection); await recordDiagnostic('data-exported'); setTransferStep(null); })}
        onExportText={() => void run(async () => { await exportText(selection); setTransferStep(null); })}
        onReview={reviewImport}
        onImport={mergeSelected}
        busy={busy}
      />
    </View>
  );
}

const transferCategories: Array<{ key: DataTransferCategory; title: string; detail: string; icon: IconName }> = [
  { key: 'workouts', title: 'Workouts', detail: 'Completed training and the current workout', icon: 'history' },
  { key: 'plans', title: 'Plans & routines', detail: 'Your saved training structures', icon: 'layers' },
  { key: 'exercises', title: 'Custom exercises', detail: 'Exercises you created', icon: 'fitness' },
  { key: 'workoutTypes', title: 'Workout types', detail: 'Your type library', icon: 'activity' },
  { key: 'measurements', title: 'Measurements', detail: 'Definitions and entries', icon: 'measure' },
];

function DataTransferSheet({
  step, selection, inspection, onChangeSelection, onClose, onBack, onExportJson, onExportText, onReview, onImport, busy,
}: {
  step: 'export-json' | 'export-text' | 'import-select' | 'import-review' | null;
  selection: DataTransferSelection;
  inspection: DataTransferInspection | null;
  onChangeSelection: (selection: DataTransferSelection) => void;
  onClose: () => void;
  onBack: () => void;
  onExportJson: () => void;
  onExportText: () => void;
  onReview: () => void;
  onImport: () => void;
  busy: boolean;
}) {
  const theme = useForgeTheme();
  const clearance = useForgeFloatingCtaClearance();
  const selectedCount = transferCategories.filter(({ key }) => selection[key]).length;
  const exporting = step === 'export-json' || step === 'export-text';
  const reviewing = step === 'import-review';
  const title = exporting ? 'Export data' : reviewing ? 'Review import' : 'Import data';
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
      <ForgeSheetHeader
        title={title}
        closePosition="right"
        onClose={onClose}
        leading={reviewing ? <ForgeBackButton accessibilityLabel="Back to import selection" onPress={onBack} /> : undefined}
      />
      <ScrollView contentContainerStyle={[styles.transferContent, { paddingBottom: clearance }]} showsVerticalScrollIndicator={false}>
        {reviewing ? (
          <ImportReview inspection={inspection} selection={selection} />
        ) : (
          <>
            <Text style={[styles.transferIntro, { color: theme.textSecondary }]}>
              {exporting
                ? 'Create a portable file with only the data you want to keep or share.'
                : 'Choose the compatible Forge data to add. Existing records are kept.'}
            </Text>
            <ForgeCard variant="inset" size="compact">
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
        label={reviewing ? 'Import selected data' : exporting ? 'Export selected data' : 'Review selected data'}
        accessibilityLabel={reviewing ? 'Import selected data' : exporting ? 'Export selected data' : 'Review selected data'}
        disabled={!selectedCount || busy}
        tone={reviewing ? 'success' : 'neutral'}
        icon={reviewing ? 'check' : undefined}
        onPress={reviewing ? onImport : exporting ? (step === 'export-json' ? onExportJson : onExportText) : onReview}
      />
    </ForgeBottomSheet>
  );
}

function ImportReview({ inspection, selection }: { inspection: DataTransferInspection | null; selection: DataTransferSelection }) {
  const theme = useForgeTheme();
  if (!inspection) return null;
  return (
    <View style={styles.reviewStack}>
      <Text style={[styles.transferIntro, { color: theme.textSecondary }]}>Validated Forge JSON from {new Date(inspection.exportedAt).toLocaleDateString()}. Only new records will be added.</Text>
      <ForgeCard variant="inset" size="compact">
        {transferCategories.filter(({ key }) => selection[key]).map(({ key, title: categoryTitle }, index) => {
          const summary = inspection.categories[key];
          return (
            <View key={key} style={[styles.reviewRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View><Text style={[styles.transferOptionTitle, { color: theme.textPrimary }]}>{categoryTitle}</Text><Text style={[styles.transferOptionDetail, { color: theme.textSecondary }]}>{summary.available} in file · {summary.existingRecords} already on this device</Text></View>
              <Text style={[styles.reviewNew, { color: summary.newRecords ? theme.success : theme.textSecondary }]}>{summary.newRecords} new</Text>
            </View>
          );
        })}
      </ForgeCard>
      {inspection.activeWorkout ? <Text style={[styles.transferNote, { color: theme.textSecondary }]}>The current workout can be added because this device does not have one in progress.</Text> : null}
      <Text style={[styles.transferNote, { color: theme.textSecondary }]}>Import is additive: nothing currently on this device is replaced. Use SQLite restore only when you need a full replacement.</Text>
    </View>
  );
}

function Logs() {
  const [entries, setEntries] = React.useState<DiagnosticEntry[]>([]);
  const [status, setStatus] = React.useState('Checking local storage…');
  const refresh = React.useCallback(() => {
    void Promise.all([loadDiagnostics(), databaseStatus()]).then(([next, database]) => {
      setEntries(next); setStatus(`${database.database} · ${database.tables} tables · local only`);
    }).catch(() => setStatus('Local storage is unavailable.'));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
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
  return <View style={styles.stack}>
    <SettingsSection title="Local diagnostics" footer="Logs are private to this device and limited to 80 technical events. They never contain workout names, exercises, values, notes or identifiers.">
      <Text style={styles.copy}>{status}</Text>
    </SettingsSection>
    <SettingsSection title="Recent events">
      {entries.length ? entries.map((entry, index) => <Action key={entry.id} title={diagnosticLabel(entry)} subtitle={new Date(entry.at).toLocaleString()} divider={index < entries.length - 1} />) : <Text style={styles.copy}>No diagnostic events recorded.</Text>}
    </SettingsSection>
    <SettingsSection>
      <Action title="Export logs" divider onPress={exportLogs} />
      <Action title="Clear logs" destructive onPress={clear} />
    </SettingsSection>
  </View>;
}
function diagnosticLabel(entry: DiagnosticEntry): string {
  return ({ 'app-opened': 'App opened', 'data-exported': 'Data exported', 'data-imported': 'Data imported', 'backup-created': 'SQLite backup created', 'backup-restored': 'SQLite backup restored', 'operation-failed': 'Operation could not complete' } as Record<DiagnosticEntry['kind'], string>)[entry.kind];
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
  transferContent: { paddingHorizontal: 20, paddingTop: 10, gap: 16 },
  transferIntro: { ...typeScale.supporting, lineHeight: 20 },
  transferOption: { minHeight: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  transferOptionCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  transferOptionText: { flex: 1, gap: 2 },
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
});
