import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  SNAPSHOT_TABLES,
  canonicalJson,
  cloudStatusAfterUpload,
  cloudStatusFromError,
  filesSnapshotStore,
  isAutoBackupDue,
  mergeListings,
  mirrorSnapshot,
  pruneStore,
  safName,
  readSnapshotRows,
  selectSnapshotsToKeep,
  shouldWarnAboutBackup,
  writeSnapshot,
  type SnapshotFiles,
  type SnapshotRow,
  type SnapshotTable,
} from '../../src/data/snapshots/snapshotCore';

const hash = async (text: string) => createHash('sha256').update(text).digest('hex');
const DAY = 24 * 60 * 60 * 1000;

function memoryFiles(options: { failWrites?: string } = {}): SnapshotFiles & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    async list(directory) {
      const prefix = `${directory}/`;
      return [...new Set([...files.keys()].filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length).split('/')[0]))];
    },
    async read(path) {
      const text = files.get(path);
      if (text === undefined) throw new Error(`missing ${path}`);
      return text;
    },
    async write(path, text) {
      if (options.failWrites) throw new Error(options.failWrites);
      files.set(path, text);
    },
    async remove(path) {
      files.delete(path);
    },
  };
}

function data(workouts = 3): Record<SnapshotTable, SnapshotRow[]> {
  const rows = Object.fromEntries(SNAPSHOT_TABLES.map((table) => [table, [] as SnapshotRow[]])) as Record<SnapshotTable, SnapshotRow[]>;
  rows.preferences = [{ id: 1, value_json: '{"weightUnit":"kg"}' }];
  rows.plans = [{ id: 'p1', position: 0, value_json: '{"name":"Push"}' }];
  rows.routines = [{ id: 'r1', plan_id: 'p1', position: 0, value_json: '{"name":"Day A"}' }];
  rows.workouts = Array.from({ length: workouts }, (_, index) => ({
    id: `w${index}`,
    is_active: 0,
    completed_at: 1_700_000_000_000 + index,
    started_at: 1_700_000_000_000 + index - 3600,
    value_json: JSON.stringify({ name: `Workout ${index}` }),
  }));
  rows.app_state = [{ key: '@forge/dashboard-layout-v1', value_json: '[]' }];
  return rows;
}

const options = (now: Date, trigger: 'auto' | 'manual' = 'manual') => ({ hash, now, appVersion: '0.1.0', trigger });

test('canonical JSON ignores key order, so equal rows hash the same', async () => {
  expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}');
  expect(await hash(canonicalJson({ id: 'x', value: 1 }))).toBe(await hash(canonicalJson({ value: 1, id: 'x' })));
});

test('a snapshot restores exactly the rows it captured', async () => {
  const store = filesSnapshotStore(memoryFiles());
  const source = data();
  const manifest = await writeSnapshot(store, source, options(new Date('2026-11-01T10:00:00Z')));
  expect(manifest.counts).toEqual({ workouts: 3, plans: 1, routines: 1, customExercises: 0 });
  const reread = await store.readManifest(manifest.id);
  expect(await readSnapshotRows(store, reread)).toEqual(source);
});

test('unchanged data adds no objects; one edited workout adds one', async () => {
  const store = filesSnapshotStore(memoryFiles());
  const first = await writeSnapshot(store, data(), options(new Date('2026-11-01T10:00:00Z')));
  expect(first.newObjects).toBe(7);
  const same = await writeSnapshot(store, data(), options(new Date('2026-11-02T10:00:00Z')));
  expect(same.newObjects).toBe(0);
  const edited = data();
  edited.workouts[1] = { ...edited.workouts[1], value_json: '{"name":"Renamed"}' };
  const next = await writeSnapshot(store, edited, options(new Date('2026-11-03T10:00:00Z')));
  expect(next.newObjects).toBe(1);
  expect((await store.listObjectHashes()).length).toBe(8);
});

test('retention keeps the last week, then one per week and one per month', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const daily = Array.from({ length: 400 }, (_, day) => ({
    id: `d${day}`,
    createdAt: new Date(now.getTime() - day * DAY).toISOString(),
  }));
  const keep = selectSnapshotsToKeep(daily, now);
  for (let day = 0; day <= 7; day += 1) expect(keep.has(`d${day}`)).toBe(true);
  // 8 days through 56 days: one per ISO week (plus a month's last day), far fewer than 49.
  const weekly = daily.slice(8, 57).filter((manifest) => keep.has(manifest.id));
  expect(weekly.length).toBeGreaterThanOrEqual(6);
  expect(weekly.length).toBeLessThanOrEqual(10);
  // The newest snapshot of October (day 17 = Oct 31) is kept as that month's.
  expect(keep.has('d17')).toBe(true);
  // Nothing past a year, and the total stays small.
  expect(daily.slice(367).some((manifest) => keep.has(manifest.id))).toBe(false);
  expect(keep.size).toBeLessThan(35);
  // An old lone snapshot is still kept as the latest.
  expect(selectSnapshotsToKeep([{ id: 'old', createdAt: '2020-01-01T00:00:00Z' }], now)).toEqual(new Set(['old']));
});

test('pruning removes dropped snapshots and only the objects nobody references', async () => {
  const files = memoryFiles();
  const store = filesSnapshotStore(files);
  const old = data();
  old.workouts[0] = { ...old.workouts[0], value_json: '{"name":"Old only"}' };
  await writeSnapshot(store, old, options(new Date('2024-01-01T10:00:00Z')));
  const current = await writeSnapshot(store, data(), options(new Date('2026-11-16T10:00:00Z')));
  const removed = await pruneStore(store, new Date('2026-11-17T10:00:00Z'));
  expect(removed).toEqual({ snapshots: 1, objects: 1 });
  expect(await store.listManifestIds()).toEqual([current.id]);
  expect(await readSnapshotRows(store, current)).toEqual(data());
});

test('mirroring sends only the missing objects; a full iCloud leaves the phone copy intact', async () => {
  const local = filesSnapshotStore(memoryFiles());
  const cloudFiles = memoryFiles();
  const cloud = filesSnapshotStore(cloudFiles);
  const first = await writeSnapshot(local, data(), options(new Date('2026-11-01T10:00:00Z')));
  expect(await mirrorSnapshot(local, cloud, first)).toBe(7);
  const more = await writeSnapshot(local, data(4), options(new Date('2026-11-08T10:00:00Z')));
  expect(await mirrorSnapshot(local, cloud, more)).toBe(1);
  expect(await readSnapshotRows(cloud, more)).toEqual(data(4));

  const full = filesSnapshotStore(memoryFiles({ failWrites: 'no-space: iCloud storage is full.' }));
  const error = await mirrorSnapshot(local, full, more).catch((caught: unknown) => caught);
  expect(cloudStatusFromError(error)).toBe('no-space');
  expect(await readSnapshotRows(local, more)).toEqual(data(4));
  expect(mergeListings([first, more], [first]).map((listing) => [listing.id, listing.local, listing.cloud])).toEqual([
    [more.id, true, false],
    [first.id, true, true],
  ]);
});

test('weekly schedule and the two-week reminder', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  expect(isAutoBackupDue({}, now)).toBe(true);
  expect(isAutoBackupDue({ lastSuccessAt: ago(6) }, now)).toBe(false);
  expect(isAutoBackupDue({ lastSuccessAt: ago(7) }, now)).toBe(true);

  // Automatic backup on and healthy: never nag.
  expect(shouldWarnAboutBackup({ lastSuccessAt: ago(30) }, true, now)).toBe(false);
  // Off: warn once nothing was saved for two weeks, then at most every two weeks.
  expect(shouldWarnAboutBackup({ lastSuccessAt: ago(10) }, false, now)).toBe(false);
  expect(shouldWarnAboutBackup({ lastSuccessAt: ago(15) }, false, now)).toBe(true);
  expect(shouldWarnAboutBackup({ lastSuccessAt: ago(30), lastWarningAt: ago(3) }, false, now)).toBe(false);
  // Failing (phone write or full iCloud): warn even when automatic backup is on.
  expect(shouldWarnAboutBackup({ lastError: 'disk', lastSuccessAt: ago(1) }, true, now)).toBe(true);
  expect(shouldWarnAboutBackup({ cloud: 'no-space', lastSuccessAt: ago(1) }, true, now)).toBe(true);
  // iCloud simply unavailable (Android, signed out) is not a failure.
  expect(shouldWarnAboutBackup({ cloud: 'unavailable', lastSuccessAt: ago(1) }, true, now)).toBe(false);
});

test('Android folder names come from the decoded document path', () => {
  const tree = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments';
  expect(safName(`${tree}/document/primary%3ADocuments%2FForge%20Backups/`)).toBe('Forge Backups');
  expect(safName(`${tree}/document/primary%3ADocuments%2FForge%20Backups%2Fobjects%2Fab`)).toBe('ab');
  expect(safName('content://com.android.externalstorage.documents/tree/primary%3ADownload')).toBe('Download');
});

test('a snapshot found in both the backup folder and app storage is listed once', async () => {
  const folder = filesSnapshotStore(memoryFiles());
  const app = filesSnapshotStore(memoryFiles());
  const manifest = await writeSnapshot(folder, data(), options(new Date('2026-11-01T10:00:00Z')));
  await mirrorSnapshot(folder, app, manifest);
  expect(mergeListings([manifest, await app.readManifest(manifest.id)], []).length).toBe(1);
});

test('an unreachable backup folder triggers the reminder', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  expect(shouldWarnAboutBackup({ lastSuccessAt: now.toISOString(), folderUnavailable: true }, true, now)).toBe(true);
});

test('a full iCloud is detected from the upload, not the write', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  // Just mirrored: waiting for iOS, not a failure.
  expect(shouldWarnAboutBackup({ cloud: 'pending', lastSuccessAt: now.toISOString() }, true, now)).toBe(false);
  expect(cloudStatusAfterUpload('pending', 'pending')).toBe('pending');
  expect(cloudStatusAfterUpload('pending', 'uploaded')).toBe('synced');
  expect(cloudStatusAfterUpload('pending', 'no-space')).toBe('no-space');
  // Offline or a busy server retries on its own.
  expect(cloudStatusAfterUpload('pending', 'error')).toBe('pending');
  // Freeing iCloud space lets the queued upload finish and clears the warning.
  expect(cloudStatusAfterUpload('no-space', 'uploaded')).toBe('synced');
  expect(cloudStatusAfterUpload('unavailable', 'uploaded')).toBe('unavailable');
});
