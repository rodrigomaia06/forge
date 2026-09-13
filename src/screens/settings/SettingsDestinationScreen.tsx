import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Alert, Image, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, ForgeText as Text } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';
import { createSqliteBackup, databaseStatus, exportJson, exportText, mergeDataTransfer, pickJsonTransfer, pickSqliteBackup, restoreSqliteBackup } from '../../data/backupRepository';
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
      const transfer = await pickJsonTransfer();
      if (!transfer) return;
      const confirmed = await new Promise<boolean>((resolve) => Alert.alert(
        'Merge Forge data?',
        `${transfer.workouts.completedWorkouts.length} workouts and ${transfer.customExercises.length} custom exercises will be added. Existing data is kept.`,
        [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Merge', onPress: () => resolve(true) }],
      ));
      // The system confirmation above intentionally precedes every database write.
      if (!confirmed) return;
      const result = await mergeDataTransfer(transfer);
      await refresh();
      await recordDiagnostic('data-imported');
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
        <Action title="Export JSON" divider onPress={() => void run(async () => { await exportJson(); await recordDiagnostic('data-exported'); })} />
        <Action title="Export text" divider onPress={() => void run(exportText)} />
        <Action title="Import JSON" onPress={importData} />
      </SettingsSection>
      <SettingsSection
        title="Database backup"
        footer={Platform.OS === 'web' ? 'Full SQLite backup and restore are available in iOS and Android builds.' : 'A complete Forge .sqlite file includes WAL changes. Restore validates it first and creates an in-app safety copy.'}
      >
        <Action title="Create SQLite backup" divider disabled={Platform.OS === 'web'} onPress={() => void run(async () => { await createSqliteBackup(); await recordDiagnostic('backup-created'); })} />
        <Action title="Restore SQLite backup" disabled={Platform.OS === 'web'} onPress={restore} />
      </SettingsSection>
      {busy ? <Text style={styles.unavailable}>Working securely with local data…</Text> : null}
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
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconSize?: number;
  onPress?: () => void;
  divider?: boolean;
  destructive?: boolean;
  disabled?: boolean;
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
      disclosure={!destructive}
      showDivider={divider}
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
