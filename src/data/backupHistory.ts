import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Timestamps of the last successful backup/export, kept separately from the
 * diagnostics log so clearing logs never wipes the "last backup" indicator.
 * Holds no workout data — only when the actions last ran on this device.
 */
const KEY = '@forge/backup-history-v1';

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
    return parse(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}'));
  } catch {
    return {};
  }
}

export async function recordBackupEvent(event: BackupEvent, at: number = Date.now()): Promise<void> {
  const history = await loadBackupHistory();
  const next: BackupHistory =
    event === 'sqlite-backup' ? { ...history, lastSqliteBackupAt: at } : { ...history, lastExportAt: at };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
