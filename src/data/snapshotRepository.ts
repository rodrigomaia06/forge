import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import appConfig from '../../app.json';
import { appStateKeys } from './appStateMigration';
import { loadAppState, updateAppState } from './appStateRepository';
import { prepareRestoredAppState } from './appStateMigration';
import { cacheFile, shareFile, withTemporaryBackupDatabase } from './backupRepository';
import { withDatabaseMaintenance, type ForgeDatabase } from './database';
import { recordDiagnostic } from './diagnosticsRepository';
import { flushPersistence } from './persistenceLifecycle';
import {
  backupFolderFiles,
  backupFolderReachable,
  backupFolderSupported,
  forgetBackupFolder,
  iCloudFiles,
  iCloudUploadState,
  isICloudAvailable,
  pickBackupFolder,
  type BackupFolder,
} from './snapshots/backupStorage';
import { clearAppBackups, localBackupSize, localFiles } from './snapshots/localFiles';
import {
  SNAPSHOT_TABLES,
  cloudStatusAfterUpload,
  cloudStatusFromError,
  filesSnapshotStore,
  isAutoBackupDue,
  mergeListings,
  mirrorSnapshot,
  pruneStore,
  readSnapshotRows,
  writeSnapshot,
  type BackupState,
  type CloudStatus,
  type SnapshotListing,
  type SnapshotManifest,
  type SnapshotRow,
  type SnapshotStore,
  type SnapshotTable,
  type SnapshotTrigger,
} from './snapshots/snapshotCore';

export type { BackupState, SnapshotListing };
export { shouldWarnAboutBackup } from './snapshots/snapshotCore';

/** Rows that describe this install, not the user's data, stay out of snapshots and survive a restore. */
const DEVICE_META_KEYS = ['bundled-catalog-version'];
const DEVICE_APP_STATE_KEYS: string[] = [
  appStateKeys.timer,
  appStateKeys.diagnostics,
  appStateKeys.backupHistory,
  appStateKeys.backupState,
];
const COLUMN = /^[a-z_]+$/;

const hash = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
/** In-app storage: the fallback when no backup folder is chosen. It is deleted with the app. */
const appStore = (): SnapshotStore => filesSnapshotStore(localFiles());
function folderStore(folder: BackupFolder | undefined): SnapshotStore | null {
  const files = backupFolderFiles(folder);
  return files ? filesSnapshotStore(files) : null;
}
function cloudStore(): SnapshotStore | null {
  const files = iCloudFiles();
  return files ? filesSnapshotStore(files) : null;
}

export async function loadBackupState(): Promise<BackupState> {
  try {
    const parsed = JSON.parse((await loadAppState(appStateKeys.backupState)) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as BackupState) : {};
  } catch {
    return {};
  }
}

function saveBackupState(change: Partial<BackupState>): Promise<void> {
  return updateAppState(appStateKeys.backupState, (raw) => {
    let current: BackupState = {};
    try {
      current = JSON.parse(raw ?? '{}') as BackupState;
    } catch {
      /* A damaged record only loses backup bookkeeping. */
    }
    const next = { ...current, ...change };
    for (const key of Object.keys(next) as (keyof BackupState)[]) if (next[key] === undefined) delete next[key];
    return JSON.stringify(next);
  });
}

export function recordBackupWarningShown(): Promise<void> {
  return saveBackupState({ lastWarningAt: new Date().toISOString() });
}

async function captureRows(db: ForgeDatabase): Promise<Record<SnapshotTable, SnapshotRow[]>> {
  const rows = {} as Record<SnapshotTable, SnapshotRow[]>;
  for (const table of SNAPSHOT_TABLES) {
    const all = await db.getAllAsync<SnapshotRow>(`SELECT * FROM ${table} ORDER BY rowid`);
    rows[table] = all.filter((row) => {
      if (table === 'forge_meta') return !DEVICE_META_KEYS.includes(String(row.key));
      if (table === 'app_state') return !DEVICE_APP_STATE_KEYS.includes(String(row.key));
      return true;
    });
  }
  return rows;
}

let running: Promise<SnapshotRunResult> | null = null;

export type SnapshotRunResult = { manifest: SnapshotManifest; cloud: CloudStatus };

/**
 * Saves a snapshot on the phone (in the backup folder when one is chosen,
 * otherwise in app storage), then mirrors it to iCloud when available. An
 * unreachable folder falls back to app storage, and a failed or full iCloud
 * never fails the backup; both are reported in the state.
 */
export function createSnapshot(trigger: SnapshotTrigger): Promise<SnapshotRunResult> {
  if (running) return running;
  running = (async () => {
    const attemptAt = new Date();
    try {
      await flushPersistence();
      const rows = await withDatabaseMaintenance(captureRows);
      const { folder } = await loadBackupState();
      const options = { hash, now: attemptAt, appVersion: appConfig.expo.version, trigger };
      let local: SnapshotStore = appStore();
      let manifest: SnapshotManifest | null = null;
      let folderUnavailable: true | undefined;
      const chosen = folderStore(folder);
      if (chosen) {
        try {
          manifest = await writeSnapshot(chosen, rows, options);
          local = chosen;
          // Backups saved in app storage while the folder was unreachable move over now.
          await moveAppBackupsTo(chosen);
        } catch {
          folderUnavailable = true;
        }
      }
      if (!manifest) manifest = await writeSnapshot(local, rows, options);
      await pruneStore(local, attemptAt);
      const cloud = await mirrorToCloud(local, manifest, attemptAt);
      await saveBackupState({
        lastAttemptAt: attemptAt.toISOString(),
        lastSuccessAt: attemptAt.toISOString(),
        lastError: undefined,
        folderUnavailable,
        cloud,
        cloudManifestId: cloud === 'pending' ? manifest.id : undefined,
      });
      await recordDiagnostic('backup-created', cloud === 'no-space' ? 'icloud-no-space' : cloud === 'error' ? 'unknown' : undefined);
      return { manifest, cloud };
    } catch (error) {
      await saveBackupState({
        lastAttemptAt: attemptAt.toISOString(),
        lastError: error instanceof Error ? error.message : 'Backup failed.',
      }).catch(() => undefined);
      await recordDiagnostic('operation-failed', 'unknown').catch(() => undefined);
      throw error;
    } finally {
      running = null;
    }
  })();
  return running;
}

async function mirrorToCloud(local: SnapshotStore, manifest: SnapshotManifest, now: Date): Promise<CloudStatus> {
  const cloud = cloudStore();
  if (!cloud || !(await isICloudAvailable())) return 'unavailable';
  try {
    await mirrorSnapshot(local, cloud, manifest);
    await pruneStore(cloud, now);
    // Written into the iCloud folder; iOS uploads it later (see refreshCloudStatus).
    return 'pending';
  } catch (error) {
    return cloudStatusFromError(error);
  }
}

/**
 * Checks whether iOS has uploaded the last mirrored backup. A full iCloud only
 * shows here: the write into the iCloud folder itself always succeeds.
 */
export async function refreshCloudStatus(): Promise<BackupState> {
  const state = await loadBackupState();
  if ((state.cloud !== 'pending' && state.cloud !== 'no-space') || !state.cloudManifestId) return state;
  const next = cloudStatusAfterUpload(state.cloud, await iCloudUploadState(`snapshots/${state.cloudManifestId}.json`));
  if (next === state.cloud) return state;
  await saveBackupState({ cloud: next, cloudManifestId: next === 'synced' ? undefined : state.cloudManifestId });
  if (next === 'no-space') await recordDiagnostic('operation-failed', 'icloud-no-space').catch(() => undefined);
  return { ...state, cloud: next };
}

/** Runs the weekly automatic backup when it is on and due. Never throws. */
export async function runAutomaticBackupIfDue(enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    if (!isAutoBackupDue(await loadBackupState(), new Date())) return;
    await createSnapshot('auto');
  } catch {
    /* Recorded in the backup state; the reminder surfaces it. */
  }
}

async function readManifests(store: SnapshotStore | null): Promise<SnapshotManifest[]> {
  if (!store) return [];
  const manifests: SnapshotManifest[] = [];
  for (const id of await store.listManifestIds()) {
    try {
      manifests.push(await store.readManifest(id));
    } catch {
      /* Skip a damaged or still-downloading manifest. */
    }
  }
  return manifests;
}

/** Moves every snapshot kept in app storage into the folder, then clears app storage. */
async function moveAppBackupsTo(target: SnapshotStore): Promise<void> {
  const source = appStore();
  const manifests = await readManifests(source);
  if (manifests.length === 0) return;
  for (const manifest of manifests) await mirrorSnapshot(source, target, manifest);
  clearAppBackups();
}

export { backupFolderSupported };

/**
 * Lets the person choose a folder outside the app (iOS Files, Android storage).
 * Backups already in app storage move there, and backups already in that folder
 * (for example from before reinstalling Forge) appear in Manage backups.
 */
export async function chooseBackupFolder(): Promise<BackupFolder | null> {
  const folder = await pickBackupFolder();
  if (!folder) return null;
  const store = folderStore(folder);
  if (!store) throw new Error('Backup folders are not available in this build.');
  await moveAppBackupsTo(store);
  await saveBackupState({ folder, folderUnavailable: undefined });
  return folder;
}

/** Goes back to app storage. Backups already in the folder stay there. */
export async function stopUsingBackupFolder(): Promise<void> {
  await forgetBackupFolder();
  await saveBackupState({ folder: undefined, folderUnavailable: undefined });
}

export async function isBackupFolderReachable(state: BackupState): Promise<boolean> {
  return backupFolderReachable(state.folder);
}

/** Stores to look in, phone first. */
async function readableStores(): Promise<SnapshotStore[]> {
  const { folder } = await loadBackupState();
  const cloud = (await isICloudAvailable()) ? cloudStore() : null;
  return [folderStore(folder), appStore(), cloud].filter((store): store is SnapshotStore => store !== null);
}

/** Every kept snapshot in the backup folder, app storage and iCloud, newest first. */
export async function listSnapshots(): Promise<SnapshotListing[]> {
  const { folder } = await loadBackupState();
  const cloud = (await isICloudAvailable()) ? cloudStore() : null;
  const [inFolder, inApp, remote] = await Promise.all([
    readManifests(folderStore(folder)).catch(() => []),
    readManifests(appStore()).catch(() => []),
    readManifests(cloud).catch(() => []),
  ]);
  return mergeListings([...inFolder, ...inApp], remote);
}

export function localBackupBytes(): number {
  try {
    return localBackupSize();
  } catch {
    return 0;
  }
}

async function snapshotRows(listing: SnapshotListing): Promise<Record<SnapshotTable, SnapshotRow[]>> {
  let lastError: unknown = new Error('This backup is no longer available.');
  for (const store of await readableStores()) {
    try {
      return await readSnapshotRows(store, await store.readManifest(listing.id));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Replaces user rows in a candidate copy of the live database, keeping the catalogue and device rows. */
async function applySnapshotRows(candidate: SQLite.SQLiteDatabase, rows: Record<SnapshotTable, SnapshotRow[]>): Promise<void> {
  await candidate.withTransactionAsync(async () => {
    for (const table of [...SNAPSHOT_TABLES].reverse()) {
      if (table === 'forge_meta')
        await candidate.runAsync(`DELETE FROM forge_meta WHERE key NOT IN (${DEVICE_META_KEYS.map(() => '?').join(',')})`, ...DEVICE_META_KEYS);
      else if (table === 'app_state')
        await candidate.runAsync(`DELETE FROM app_state WHERE key NOT IN (${DEVICE_APP_STATE_KEYS.map(() => '?').join(',')})`, ...DEVICE_APP_STATE_KEYS);
      else await candidate.runAsync(`DELETE FROM ${table}`);
    }
    // The rest timer belongs to the session being replaced.
    await candidate.runAsync('DELETE FROM app_state WHERE key = ?', appStateKeys.timer);
    for (const table of SNAPSHOT_TABLES) {
      for (const row of rows[table]) {
        const columns = Object.keys(row);
        if (columns.some((column) => !COLUMN.test(column))) throw new Error('A backup object is damaged.');
        await candidate.runAsync(
          `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
          ...columns.map((column) => row[column]),
        );
      }
    }
  });
  await prepareRestoredAppState(candidate);
}

async function withMaterializedSnapshot<T>(
  listing: SnapshotListing,
  work: (candidate: SQLite.SQLiteDatabase, live: ForgeDatabase) => Promise<T>,
): Promise<T> {
  // Read (and, from iCloud, download) every object before touching the database queue.
  const rows = await snapshotRows(listing);
  return withDatabaseMaintenance(async (live) =>
    withTemporaryBackupDatabase(await live.serializeAsync(), async (candidate) => {
      await applySnapshotRows(candidate, rows);
      const integrity = await candidate.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
      if (integrity?.integrity_check !== 'ok') throw new Error('The restored backup failed SQLite integrity validation.');
      return work(candidate, live);
    }),
  );
}

/**
 * Restores a snapshot over all current data. A "Before restore" snapshot of the
 * current data is saved first, so a restore can always be undone.
 */
export async function restoreSnapshot(listing: SnapshotListing): Promise<void> {
  await createSnapshot('pre-restore');
  await flushPersistence();
  await withMaterializedSnapshot(listing, async (candidate, live) => {
    await SQLite.backupDatabaseAsync({ sourceDatabase: candidate, destDatabase: live });
  });
  await recordDiagnostic('backup-restored');
}

/** Shares a snapshot as one .sqlite file, which "Restore backup" accepts on any device. */
export async function downloadSnapshot(listing: SnapshotListing): Promise<void> {
  const bytes = await withMaterializedSnapshot(listing, (candidate) => candidate.serializeAsync());
  const name = `forge-backup-${listing.createdAt.slice(0, 10)}.sqlite`;
  await shareFile(cacheFile(name, bytes), 'application/vnd.sqlite3');
}
