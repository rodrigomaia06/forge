import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { File } from 'expo-file-system';
import appConfig from '../../app.json';
import { appStateKeys, prepareRestoredAppState } from './appStateMigration';
import { loadAppState, updateAppState } from './appStateRepository';
import { cacheFile, inspectBytes, shareFile, withTemporaryBackupDatabase, type BackupInspection } from './backupRepository';
import { withDatabaseMaintenance, type ForgeDatabase } from './database';
import { recordDiagnostic } from './diagnosticsRepository';
import { flushPersistence } from './persistenceLifecycle';
import { loadSettingsPreferences } from './settingsRepository';
import {
  appBackupFiles,
  backupFolderReachable,
  backupFolderSupported,
  folderBackupFiles,
  forgetBackupFolder,
  iCloudFiles,
  iCloudUploadState,
  isICloudAvailable,
  pickBackupFolder,
  type BackupFileStore,
  type BackupFolder,
} from './snapshots/backupStorage';
import {
  SNAPSHOT_TABLES,
  backupFileName,
  backupFilesToRemove,
  cloudStatusAfterUpload,
  cloudStatusFromError,
  filesSnapshotStore,
  isAutoBackupDue,
  mergeBackupEntries,
  parseBackupFileName,
  pruneStore,
  readSnapshotRows,
  writeSnapshot,
  type BackupEntry,
  type BackupState,
  type CloudStatus,
  type SnapshotManifest,
  type SnapshotRow,
  type SnapshotStore,
  type SnapshotTable,
  type SnapshotTrigger,
} from './snapshots/snapshotCore';

export type { BackupEntry, BackupState };
export { backupFolderSupported, isICloudAvailable };
export { shouldWarnAboutBackup } from './snapshots/snapshotCore';

/** Rows that describe this install, not the user's data, stay out of restores (and iCloud snapshots). */
const DEVICE_META_KEYS = ['bundled-catalog-version'];
const DEVICE_APP_STATE_KEYS: string[] = [
  appStateKeys.timer,
  appStateKeys.diagnostics,
  appStateKeys.backupHistory,
  appStateKeys.backupState,
];
const COLUMN = /^[a-z_]+$/;
const SQLITE_MIME = 'application/vnd.sqlite3';

type Rows = Record<SnapshotTable, SnapshotRow[]>;

const hash = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
function cloudStore(): SnapshotStore | null {
  const files = iCloudFiles();
  return files ? filesSnapshotStore(files) : null;
}

// Backup bookkeeping (a device row: never backed up, kept across restores).

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

/** User rows of a database; tables an older backup lacks read as empty. */
async function captureRows(db: SQLite.SQLiteDatabase): Promise<Rows> {
  const present = new Set(
    (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((row) => row.name),
  );
  const rows = {} as Rows;
  for (const table of SNAPSHOT_TABLES) {
    const all = present.has(table) ? await db.getAllAsync<SnapshotRow>(`SELECT * FROM ${table} ORDER BY rowid`) : [];
    rows[table] = all.filter((row) => {
      if (table === 'forge_meta') return !DEVICE_META_KEYS.includes(String(row.key));
      if (table === 'app_state') return !DEVICE_APP_STATE_KEYS.includes(String(row.key));
      return true;
    });
  }
  return rows;
}

// Where phone backups go.

/** The chosen folder when one is set, then Forge's own folder. */
async function phoneStores(): Promise<{ folder: BackupFileStore | null; app: BackupFileStore }> {
  const { folder } = await loadBackupState();
  return { folder: folderBackupFiles(folder), app: appBackupFiles() };
}

/** Keeps what the retention policy keeps; files Forge did not name are left alone. */
async function pruneFiles(store: BackupFileStore, now: Date): Promise<void> {
  for (const name of backupFilesToRemove(await store.list(), now)) await store.remove(name);
}

/** Moves Forge-named backups from Forge's own folder into the chosen folder. */
async function moveAppBackupsTo(target: BackupFileStore): Promise<void> {
  const app = appBackupFiles();
  for (const name of await app.list()) {
    if (!parseBackupFileName(name)) continue;
    await target.save(name, await app.fetch(name));
    await app.remove(name);
  }
}

// Creating backups.

let running: Promise<SnapshotRunResult> | null = null;

export type SnapshotRunResult = { createdAt: string; file: string; cloud: CloudStatus | 'off' };

/**
 * Saves a complete `.sqlite` copy of the data on the phone (in the chosen
 * folder, or Forge's own folder), then, with iCloud copy on, an incremental
 * snapshot to iCloud. An unreachable folder falls back to Forge's folder, and a
 * failed or full iCloud never fails the backup; both are recorded in the state.
 */
export function createSnapshot(trigger: SnapshotTrigger): Promise<SnapshotRunResult> {
  if (running) return running;
  running = (async () => {
    const attemptAt = new Date();
    let temporary: File | null = null;
    try {
      const { iCloudBackupEnabled } = await loadSettingsPreferences();
      await flushPersistence();
      const { bytes, rows } = await withDatabaseMaintenance(async (db) => ({
        bytes: await db.serializeAsync(),
        rows: iCloudBackupEnabled ? await captureRows(db) : null,
      }));
      const name = backupFileName(attemptAt, trigger);
      temporary = cacheFile(name, bytes);
      const { folder, app } = await phoneStores();
      let saved: BackupFileStore = app;
      let folderUnavailable: true | undefined;
      if (folder) {
        try {
          await folder.save(name, temporary);
          saved = folder;
          await moveAppBackupsTo(folder);
        } catch {
          folderUnavailable = true;
        }
      }
      if (saved === app) await app.save(name, temporary);
      await pruneFiles(saved, attemptAt);
      let cloud: CloudStatus | undefined;
      let cloudManifestId: string | undefined;
      if (rows) ({ cloud, cloudManifestId } = await saveToCloud(rows, attemptAt, trigger));
      await saveBackupState({
        lastAttemptAt: attemptAt.toISOString(),
        lastSuccessAt: attemptAt.toISOString(),
        lastError: undefined,
        folderUnavailable,
        cloud,
        cloudManifestId,
      });
      await recordDiagnostic('backup-created', cloud === 'no-space' ? 'icloud-no-space' : cloud === 'error' ? 'unknown' : undefined);
      return { createdAt: attemptAt.toISOString(), file: name, cloud: cloud ?? 'off' };
    } catch (error) {
      await saveBackupState({
        lastAttemptAt: attemptAt.toISOString(),
        lastError: error instanceof Error ? error.message : 'Backup failed.',
      }).catch(() => undefined);
      await recordDiagnostic('operation-failed', 'unknown').catch(() => undefined);
      throw error;
    } finally {
      try {
        if (temporary?.exists) temporary.delete();
      } catch {
        /* The cache is cleared by the system eventually. */
      }
      running = null;
    }
  })();
  return running;
}

async function saveToCloud(rows: Rows, now: Date, trigger: SnapshotTrigger): Promise<{ cloud: CloudStatus; cloudManifestId?: string }> {
  const cloud = cloudStore();
  if (!cloud || !(await isICloudAvailable())) return { cloud: 'unavailable' };
  try {
    const manifest = await writeSnapshot(cloud, rows, { hash, now, appVersion: appConfig.expo.version, trigger });
    await pruneStore(cloud, now);
    // Written into the iCloud folder; iOS uploads it later (see refreshCloudStatus).
    return { cloud: 'pending', cloudManifestId: manifest.id };
  } catch (error) {
    return { cloud: cloudStatusFromError(error) };
  }
}

/**
 * Checks whether iOS has uploaded the last iCloud snapshot. A full iCloud only
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

/**
 * Turning the iCloud copy off clears its status, so a full iCloud stops
 * prompting. Backups already in iCloud stay there and still appear in
 * Manage backups.
 */
export function clearCloudStatus(): Promise<void> {
  return saveBackupState({ cloud: undefined, cloudManifestId: undefined });
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

// The backup folder.

/**
 * Lets the person choose a folder outside the app (iOS Files, Android storage).
 * Backups in Forge's own folder move there, and backups already in that folder
 * (for example from before reinstalling Forge) appear in Manage backups.
 */
export async function chooseBackupFolder(): Promise<BackupFolder | null> {
  const folder = await pickBackupFolder();
  if (!folder) return null;
  const store = folderBackupFiles(folder);
  if (!store) throw new Error('Backup folders are not available in this build.');
  await moveAppBackupsTo(store);
  await saveBackupState({ folder, folderUnavailable: undefined });
  return folder;
}

/** Goes back to Forge's own folder. Backups already in the chosen folder stay there. */
export async function stopUsingBackupFolder(): Promise<void> {
  await forgetBackupFolder();
  await saveBackupState({ folder: undefined, folderUnavailable: undefined });
}

export async function isBackupFolderReachable(state: BackupState): Promise<boolean> {
  return backupFolderReachable(state.folder);
}

// Listing, restoring and downloading.

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

/** Every kept backup on the phone and in iCloud, newest first. */
export async function listBackups(): Promise<BackupEntry[]> {
  const { folder, app } = await phoneStores();
  const cloud = (await isICloudAvailable()) ? cloudStore() : null;
  const [inFolder, inApp, remote] = await Promise.all([
    folder ? folder.list().catch(() => []) : Promise.resolve([]),
    app.list().catch(() => []),
    readManifests(cloud).catch(() => []),
  ]);
  return mergeBackupEntries([...inFolder, ...inApp], remote);
}

/** A readable local copy of a phone backup, from the chosen folder or Forge's own. */
async function fetchBackupFile(name: string): Promise<File> {
  const { folder, app } = await phoneStores();
  if (folder) {
    try {
      const file = await folder.fetch(name);
      if (file.exists) return file;
    } catch {
      /* Try Forge's own folder. */
    }
  }
  const file = await app.fetch(name);
  if (!file.exists) throw new Error('This backup is no longer on this phone.');
  return file;
}

/** Reads the user rows of a Forge `.sqlite` file after validating it. */
async function rowsFromSqlite(bytes: Uint8Array): Promise<Rows> {
  await inspectBytes(bytes);
  return withTemporaryBackupDatabase(bytes, captureRows);
}

async function entryRows(entry: BackupEntry): Promise<Rows> {
  if (entry.file) return rowsFromSqlite(await (await fetchBackupFile(entry.file)).bytes());
  const cloud = cloudStore();
  if (!entry.cloudId || !cloud) throw new Error('iCloud is not available on this device.');
  return readSnapshotRows(cloud, await cloud.readManifest(entry.cloudId));
}

/** Replaces user rows in a candidate copy of the live database, keeping the catalogue and device rows. */
async function applyRows(candidate: SQLite.SQLiteDatabase, rows: Rows): Promise<void> {
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
        if (columns.some((column) => !COLUMN.test(column))) throw new Error('This backup is damaged.');
        await candidate.runAsync(
          `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
          ...columns.map((column) => row[column]),
        );
      }
    }
  });
  await prepareRestoredAppState(candidate);
}

/** Builds a validated copy of the live database holding `rows` as its user data. */
function withRestoredCopy<T>(rows: Rows, work: (candidate: SQLite.SQLiteDatabase, live: ForgeDatabase) => Promise<T>): Promise<T> {
  return withDatabaseMaintenance(async (live) =>
    withTemporaryBackupDatabase(await live.serializeAsync(), async (candidate) => {
      await applyRows(candidate, rows);
      const integrity = await candidate.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
      if (integrity?.integrity_check !== 'ok') throw new Error('The restored backup failed SQLite integrity validation.');
      return work(candidate, live);
    }),
  );
}

/**
 * Replaces all user data with `rows`. A Before restore backup of the current
 * data is saved first, so a restore can always be undone. Device settings
 * (backup folder, logs, timer) stay as they are.
 */
async function restoreRows(rows: Rows): Promise<void> {
  await createSnapshot('pre-restore');
  await flushPersistence();
  await withRestoredCopy(rows, (candidate, live) => SQLite.backupDatabaseAsync({ sourceDatabase: candidate, destDatabase: live }));
  await recordDiagnostic('backup-restored');
}

export async function restoreBackup(entry: BackupEntry): Promise<void> {
  // Read (and, from iCloud, download) everything before touching the database.
  await restoreRows(await entryRows(entry));
}

/** Restores a Forge `.sqlite` file picked with Restore from file. */
export async function restoreBackupFile(inspection: BackupInspection): Promise<void> {
  await restoreRows(await rowsFromSqlite(inspection.bytes));
}

/** Shares a backup as one `.sqlite` file, which Restore from file accepts on any device. */
export async function downloadBackup(entry: BackupEntry): Promise<void> {
  if (entry.file) {
    await shareFile(await fetchBackupFile(entry.file), SQLITE_MIME);
    return;
  }
  const bytes = await withRestoredCopy(await entryRows(entry), (candidate) => candidate.serializeAsync());
  const name = backupFileName(new Date(entry.createdAt), entry.trigger);
  await shareFile(cacheFile(name, bytes), SQLITE_MIME);
}
