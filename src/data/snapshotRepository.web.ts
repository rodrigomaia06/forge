// Snapshots need SQLite and the file system; the web build keeps today's
// behaviour (no full backups) and hides the Backups section.
import type { BackupState, SnapshotListing, SnapshotManifest, CloudStatus, SnapshotTrigger } from './snapshots/snapshotCore';

export type { BackupState, SnapshotListing };
export { shouldWarnAboutBackup } from './snapshots/snapshotCore';
export type SnapshotRunResult = { manifest: SnapshotManifest; cloud: CloudStatus | 'off' };

const unavailable = () => Promise.reject(new Error('Backups are available in the iOS and Android builds.'));

export const loadBackupState = async (): Promise<BackupState> => ({});
export const recordBackupWarningShown = async (): Promise<void> => undefined;
export const createSnapshot = (_trigger: SnapshotTrigger): Promise<SnapshotRunResult> => unavailable();
export const runAutomaticBackupIfDue = async (_enabled: boolean): Promise<void> => undefined;
export const listSnapshots = async (): Promise<SnapshotListing[]> => [];
export const localBackupBytes = (): number => 0;
export const restoreSnapshot = (_listing: SnapshotListing): Promise<void> => unavailable();
export const downloadSnapshot = (_listing: SnapshotListing): Promise<void> => unavailable();
export const backupFolderSupported = (): boolean => false;
export const chooseBackupFolder = async (): Promise<null> => null;
export const stopUsingBackupFolder = async (): Promise<void> => undefined;
export const isBackupFolderReachable = async (_state: BackupState): Promise<boolean> => false;
export const refreshCloudStatus = async (): Promise<BackupState> => ({});
export const isICloudAvailable = async (): Promise<boolean> => false;
export const clearCloudStatus = async (): Promise<void> => undefined;
