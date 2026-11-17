import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, ForgeConfirmationDialog, ForgeText as Text, Icon, lightHaptic, pressedFeedback } from '../../components/ui';
import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ForgeTheme } from '../../types';
import { createSnapshot, downloadSnapshot, listSnapshots, restoreSnapshot, type SnapshotListing } from '../../data/snapshotRepository';
import { notifyPersistenceReset } from '../../data/persistenceLifecycle';
import { pickSqliteBackup, restoreSqliteBackup, type BackupInspection } from '../../data/backupRepository';
import { recordDiagnostic } from '../../data/diagnosticsRepository';
import { localDataErrorMessage } from './SettingsDestinationScreen';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../types';
import { useSettings } from '../../state/SettingsContext';
import { usePlans } from '../../state/PlansContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useRestTimer } from '../../state/RestTimerContext';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageBackups'>;

const TRIGGER_LABEL: Record<SnapshotListing['trigger'], string> = {
  auto: 'Weekly backup',
  manual: 'Manual backup',
  'pre-restore': 'Before restore',
};

function snapshotTitle(listing: SnapshotListing): string {
  return new Date(listing.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function snapshotDate(listing: SnapshotListing): string {
  return new Date(listing.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function snapshotWhere(listing: SnapshotListing): string {
  return listing.local && listing.cloud ? 'Phone and iCloud' : listing.cloud ? 'iCloud' : 'This phone';
}

/** One backup, like a file list entry: where it lives, type, date and size of the data, then its actions. */
function BackupEntry({
  listing,
  last,
  disabled,
  onDownload,
  onRestore,
  index,
}: {
  listing: SnapshotListing;
  last: boolean;
  disabled: boolean;
  onDownload: () => void;
  onRestore: () => void;
  index: number;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createEntryStyles);
  const label = `${TRIGGER_LABEL[listing.trigger]}, ${snapshotTitle(listing)}`;
  return (
    <View style={styles.entry} testID={`backup-snapshot-${index}`} accessibilityLabel={`${label}, ${listing.counts.workouts} workouts, ${snapshotWhere(listing)}`}>
      <View style={styles.tile}>
        <Icon name={listing.cloud ? 'cloud' : 'device-mobile'} size={20} color={theme.textPrimary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{TRIGGER_LABEL[listing.trigger]}</Text>
        <Text style={styles.meta} numberOfLines={1}>{snapshotDate(listing)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Download ${label}`}
        disabled={disabled}
        hitSlop={4}
        onPress={() => { lightHaptic(); onDownload(); }}
        style={({ pressed }) => [styles.action, pressed && pressedFeedback]}
        testID={`backup-snapshot-download-${index}`}
      >
        <Icon name="download" size={20} color={theme.textPrimary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Restore ${label}`}
        disabled={disabled}
        hitSlop={4}
        onPress={() => { lightHaptic(); onRestore(); }}
        style={({ pressed }) => [styles.action, pressed && pressedFeedback]}
        testID={`backup-snapshot-restore-${index}`}
      >
        <Icon name="restore" size={20} color={theme.textPrimary} />
      </Pressable>
      {last ? null : <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
    </View>
  );
}

function createEntryStyles(theme: ForgeTheme) {
  return StyleSheet.create({
    entry: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 },
    tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceInset },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typeScale.body, fontFamily: typeScale.cardTitle.fontFamily, color: theme.textPrimary },
    meta: { ...typeScale.supporting, color: theme.textSecondary },
    action: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceInset },
    divider: { position: 'absolute', left: 64, right: 14, bottom: 0, height: StyleSheet.hairlineWidth },
  });
}

export function ManageBackupsScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [headerElevated, setHeaderElevated] = React.useState(false);
  const [listings, setListings] = React.useState<SnapshotListing[] | null>(null);
  const [confirmRestore, setConfirmRestore] = React.useState<SnapshotListing | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [fileRestore, setFileRestore] = React.useState<BackupInspection | null>(null);
  const [notice, setNotice] = React.useState<{ title: string; message: string; tone?: 'neutral' | 'success' } | null>(null);
  const { reload: reloadSettings } = useSettings();
  const { reload: reloadPlans } = usePlans();
  const { reload: reloadWorkouts } = useWorkouts();
  const { reload: reloadExercises } = useExerciseCatalog();
  const { stop: stopRestTimer } = useRestTimer();

  const load = React.useCallback(() => {
    void listSnapshots()
      .then(setListings)
      .catch(() => setListings([]));
  }, []);
  React.useEffect(load, [load]);

  const run = async (work: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setNotice({ title: 'Could not complete this action', message: localDataErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const restore = (listing: SnapshotListing): void => {
    setConfirmRestore(null);
    void run(async () => {
      stopRestTimer();
      await restoreSnapshot(listing);
      await Promise.all([reloadSettings(), reloadPlans(), reloadWorkouts(), reloadExercises()]);
      notifyPersistenceReset();
      load();
      setNotice({
        title: 'Backup restored',
        message: `Forge restored ${listing.counts.workouts} workouts and ${listing.counts.plans} plans from ${snapshotTitle(listing)}. Your previous data was saved as a "Before restore" backup.`,
        tone: 'success',
      });
    });
  };

  const reloadAll = async (): Promise<void> => {
    await Promise.all([reloadSettings(), reloadPlans(), reloadWorkouts(), reloadExercises()]);
    notifyPersistenceReset();
  };

  // The document picker can take any amount of time (and may never resolve when
  // dismissed on some platforms), so it never holds the busy lock.
  const pickFile = (): void => {
    if (busy) return;
    void pickSqliteBackup()
      .then((inspection) => { if (inspection) setFileRestore(inspection); })
      .catch((error: unknown) => setNotice({ title: 'Could not open this file', message: localDataErrorMessage(error) }));
  };

  const restoreFile = (inspection: BackupInspection): void => {
    setFileRestore(null);
    void run(async () => {
      stopRestTimer();
      // Same safety net as restoring a listed backup: current data stays restorable.
      await createSnapshot('pre-restore');
      await restoreSqliteBackup(inspection);
      await reloadAll();
      await recordDiagnostic('backup-restored');
      setNotice({
        title: 'Backup restored',
        message: `Forge restored ${inspection.workoutCount} workouts, ${inspection.planCount} plans and ${inspection.customExerciseCount} custom exercises from this file. Your previous data was saved as a "Before restore" backup.`,
        tone: 'success',
      });
    });
  };

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader title="Manage backups" navigation={navigation} elevated={headerElevated} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: settingsLayout.contentBottom + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <SettingsSection>
            <SettingsRow
              title="Restore from file"
              subtitle="A downloaded .sqlite backup"
              icon="database-import"
              disabled={busy}
              onPress={pickFile}
              testID="restore-backup-file"
            />
          </SettingsSection>
          {listings === null ? (
            <Text style={[styles.note, { color: theme.textSecondary }]}>Loading backups…</Text>
          ) : listings.length === 0 ? (
            <Text style={[styles.note, { color: theme.textSecondary }]}>No backups yet. Use Back up now in Backup & Export.</Text>
          ) : (
            <SettingsSection
              title="Kept backups"
              icon="history"
              info="Forge keeps every backup from the last 7 days, one per week for 8 weeks and one per month for a year. Backups share unchanged data, so each new one only adds what changed."
            >
              {listings.map((listing, index) => (
                <BackupEntry
                  key={listing.id}
                  listing={listing}
                  index={index}
                  last={index === listings.length - 1}
                  disabled={busy}
                  onDownload={() => void run(() => downloadSnapshot(listing))}
                  onRestore={() => setConfirmRestore(listing)}
                />
              ))}
            </SettingsSection>
          )}
          {busy ? <Text style={[styles.note, { color: theme.textSecondary }]}>Working securely with local data…</Text> : null}
        </ScrollView>
      </View>
      <ForgeConfirmationDialog
        visible={Boolean(confirmRestore)}
        title="Replace all Forge data?"
        message={confirmRestore ? `Restore the backup from ${snapshotTitle(confirmRestore)} (${confirmRestore.counts.workouts} workouts, ${confirmRestore.counts.plans} plans). Your current data is saved as a backup first.` : ''}
        cancelLabel="Keep current data"
        confirmLabel="Restore"
        confirmTone="destructive"
        onCancel={() => setConfirmRestore(null)}
        onConfirm={() => confirmRestore && restore(confirmRestore)}
        testID="restore-snapshot-confirmation"
      />
      <ForgeConfirmationDialog
        visible={Boolean(fileRestore)}
        title="Replace all Forge data?"
        message={fileRestore ? `This file has ${fileRestore.workoutCount} completed workouts, ${fileRestore.planCount} plans and ${fileRestore.customExerciseCount} custom exercises. Current data will be replaced after a safety copy is made.` : ''}
        cancelLabel="Keep current data"
        confirmLabel="Restore"
        confirmTone="destructive"
        onCancel={() => setFileRestore(null)}
        onConfirm={() => fileRestore && restoreFile(fileRestore)}
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
        testID="manage-backups-notice"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: settingsLayout.screenPadding, paddingTop: settingsLayout.contentTop, gap: settingsLayout.sectionGap },
  note: { ...typeScale.supporting, textAlign: 'center' },
});
