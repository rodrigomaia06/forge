import React from 'react';
import { AppState, Platform } from 'react-native';
import { ForgeConfirmationDialog } from '../components/ui';
import {
  createSnapshot,
  refreshCloudStatus,
  recordBackupWarningShown,
  runAutomaticBackupIfDue,
  shouldWarnAboutBackup,
  type BackupState,
} from '../data/snapshotRepository';
import { runWhenIdle } from '../utils/idle';
import { useActiveWorkout } from './WorkoutContext';
import { useSettings } from './SettingsContext';

/** Leave launch work (fonts, first render, catalogue) alone before checking backups. */
const LAUNCH_DELAY_MS = 8000;

type Warning = {
  title: string;
  message: string;
  /** Only an acknowledgement: backing up again cannot help (iCloud is full). */
  informational?: boolean;
};

function warningCopy(state: BackupState, autoBackupEnabled: boolean): Warning {
  if (state.lastError)
    return {
      title: 'Backup did not finish',
      message: 'Forge could not save its last automatic backup on this phone. Back up now to keep a current copy of your training.',
    };
  if (state.folderUnavailable)
    return {
      title: 'Backup folder unavailable',
      message: 'Forge could not reach your backup folder, so the last backup was saved inside the app, where deleting Forge would remove it. Choose the folder again in Backup & Export.',
    };
  if (state.cloud === 'no-space')
    return {
      title: 'iCloud is full',
      message: 'Your backups are saved on this phone, but not in iCloud. Free up iCloud storage so a lost phone does not take your training with it.',
      informational: true,
    };
  if (state.cloud === 'error')
    return {
      title: 'iCloud copy failed',
      message: 'Your last backup is saved on this phone, but Forge could not copy it to iCloud.',
    };
  return {
    title: autoBackupEnabled ? 'Back up your training' : 'Automatic backup is off',
    message: 'Forge has not backed up your data in two weeks. Back up now, or turn on automatic weekly backups in Backup & Export.',
  };
}

/**
 * Runs the weekly automatic backup when the app opens or returns to the
 * foreground, and shows the two-week reminder when backups are off or failing.
 * Work waits for an idle moment so it never competes with input.
 */
export function BackupScheduler() {
  const { ready, preferences } = useSettings();
  const activeWorkout = useActiveWorkout();
  const inWorkout = React.useRef(false);
  inWorkout.current = Boolean(activeWorkout);
  const enabled = preferences.autoBackupEnabled;
  const [warning, setWarning] = React.useState<Warning | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | undefined>();
  const checking = React.useRef(false);

  const check = React.useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      await runAutomaticBackupIfDue(enabled);
      const state = await refreshCloudStatus();
      // Never interrupt a live workout; the reminder waits for the next open.
      if (inWorkout.current || !shouldWarnAboutBackup(state, enabled, new Date())) return;
      await recordBackupWarningShown();
      setFailed(undefined);
      setWarning(warningCopy(state, enabled));
    } catch {
      /* Backup bookkeeping must never break the app. */
    } finally {
      checking.current = false;
    }
  }, [enabled]);

  React.useEffect(() => {
    if (Platform.OS === 'web' || !ready) return;
    let cancelIdle: (() => void) | undefined;
    const schedule = () => {
      cancelIdle?.();
      cancelIdle = runWhenIdle(() => void check(), 2000);
    };
    const launch = setTimeout(schedule, LAUNCH_DELAY_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') schedule();
    });
    return () => {
      clearTimeout(launch);
      cancelIdle?.();
      subscription.remove();
    };
  }, [check, ready]);

  const backUpNow = (): void => {
    setBusy(true);
    setFailed(undefined);
    void createSnapshot('manual')
      .then(() => setWarning(null))
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : 'Backup failed.'))
      .finally(() => setBusy(false));
  };

  return (
    <ForgeConfirmationDialog
      visible={Boolean(warning)}
      busy={busy}
      error={failed}
      title={warning?.title ?? ''}
      message={warning?.message ?? ''}
      cancelLabel="Not now"
      confirmLabel={warning?.informational ? 'OK' : 'Back up now'}
      confirmTone="success"
      showCancel={!warning?.informational}
      onCancel={() => setWarning(null)}
      onConfirm={warning?.informational ? () => setWarning(null) : backUpNow}
      testID="backup-reminder"
    />
  );
}
