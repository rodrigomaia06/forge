import { appStateKeys, loadAppState, updateAppState } from './appStateRepository';

/**
 * Timestamps of the last successful backup/export, kept separately from the
 * diagnostics log so clearing logs never wipes the "last backup" indicator.
 * Holds no workout data — only when the actions last ran on this device.
 */
const KEY = appStateKeys.backupHistory;

export type BackupEvent = 'sqlite-backup' | 'data-export';
export type BackupHistory = { lastSqliteBackupAt?: number; lastExportAt?: number };

function parse(value: unknown): BackupHistory {
  if (!value || typeof value !== 'object') return {};
  const record = value as Partial<Record<keyof BackupHistory, unknown>>;
  const at = (input: unknown): number | undefined =>
    typeof input === 'number' && Number.isFinite(input) && input > 0 ? input : undefined;
  return {
    ...(at(record.lastSqliteBackupAt) ? { lastSqliteBackupAt: at(record.lastSqliteBackupAt) } : {}),
    ...(at(record.lastExportAt) ? { lastExportAt: at(record.lastExportAt) } : {}),
  };
}

export async function loadBackupHistory(): Promise<BackupHistory> {
  try {
    return parse(JSON.parse((await loadAppState(KEY)) ?? '{}'));
  } catch {
    return {};
  }
}

export async function recordBackupEvent(
  event: BackupEvent,
  at: number = Date.now(),
): Promise<void> {
  await updateAppState(KEY, (raw) => {
    let history: BackupHistory = {};
    try {
      history = parse(JSON.parse(raw ?? '{}'));
    } catch {
      /* Use empty history when malformed. */
    }
    const next: BackupHistory =
      event === 'sqlite-backup'
        ? { ...history, lastSqliteBackupAt: at }
        : { ...history, lastExportAt: at };
    return JSON.stringify(next);
  });
}
