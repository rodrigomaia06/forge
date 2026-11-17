// Backups need SQLite and the file system; the web build keeps today's
// behaviour (no full backups) and hides the Backups section.
import type { BackupInspection } from './backupRepository';
import type { BackupEntry, BackupState, CloudStatus, SnapshotTrigger } from './snapshots/snapshotCore';

export type { BackupEntry, BackupState };
export { shouldWarnAboutBackup } from './snapshots/snapshotCore';
export type SnapshotRunResult = { createdAt: string; file: string; cloud: CloudStatus | 'off' };

const unavailable = () => Promise.reject(new Error('Backups are available in the iOS and Android builds.'));

export const loadBackupState = async (): Promise<BackupState> => ({});
export const refreshCloudStatus = async (): Promise<BackupState> => ({});
export const recordBackupWarningShown = async (): Promise<void> => undefined;
export const createSnapshot = (_trigger: SnapshotTrigger): Promise<SnapshotRunResult> => unavailable();
export const runAutomaticBackupIfDue = async (_enabled: boolean): Promise<void> => undefined;
export const clearCloudStatus = async (): Promise<void> => undefined;
export const isICloudAvailable = async (): Promise<boolean> => false;
export const listBackups = async (): Promise<BackupEntry[]> => [];
export const restoreBackup = (_entry: BackupEntry): Promise<void> => unavailable();
export const restoreBackupFile = (_inspection: BackupInspection): Promise<void> => unavailable();
export const downloadBackup = (_entry: BackupEntry): Promise<void> => unavailable();
export const backupFolderSupported = (): boolean => false;
export const chooseBackupFolder = async (): Promise<null> => null;
export const stopUsingBackupFolder = async (): Promise<void> => undefined;
export const isBackupFolderReachable = async (_state: BackupState): Promise<boolean> => false;
