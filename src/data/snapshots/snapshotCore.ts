/**
 * Content-addressed backup snapshots, kept platform-free so they can be tested
 * without a device.
 *
 * A snapshot stores every user-owned database row as its own object, named by
 * the SHA-256 of the row's canonical JSON (`objects/<aa>/<hash>.json`). A small
 * manifest (`snapshots/<id>.json`) lists the objects per table in row order.
 * Rows that did not change since an earlier snapshot already have an object, so
 * a new snapshot only writes what changed, and old snapshots share everything
 * they have in common.
 */

export const SNAPSHOT_FORMAT = 'forge-snapshot';
export const SNAPSHOT_VERSION = 1;

/** User tables captured by a snapshot, in the order they are restored (plans before routines). */
export const SNAPSHOT_TABLES = [
  'forge_meta',
  'preferences',
  'workout_types',
  'custom_exercises',
  'plans',
  'routines',
  'workouts',
  'set_measurements',
  'set_targets',
  'app_state',
] as const;
export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];

export type SnapshotRow = Record<string, string | number | null>;
export type SnapshotTrigger = 'auto' | 'manual' | 'pre-restore';

export type SnapshotCounts = {
  workouts: number;
  plans: number;
  routines: number;
  customExercises: number;
};

export type SnapshotManifest = {
  format: typeof SNAPSHOT_FORMAT;
  version: typeof SNAPSHOT_VERSION;
  id: string;
  createdAt: string;
  appVersion: string;
  trigger: SnapshotTrigger;
  /** Object hashes per table, in row order. */
  tables: Record<SnapshotTable, string[]>;
  counts: SnapshotCounts;
  /** Objects this snapshot added to the store it was first written to. */
  newObjects: number;
};

/** Where snapshots live: the phone's own storage or a cloud mirror. */
export interface SnapshotStore {
  listManifestIds(): Promise<string[]>;
  readManifest(id: string): Promise<SnapshotManifest>;
  writeManifest(manifest: SnapshotManifest): Promise<void>;
  removeManifest(id: string): Promise<void>;
  listObjectHashes(): Promise<string[]>;
  readObject(hash: string): Promise<string>;
  writeObject(hash: string, text: string): Promise<void>;
  removeObject(hash: string): Promise<void>;
}

export type HashText = (text: string) => Promise<string>;

/** JSON with recursively sorted keys, so equal content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

/** The object text stored for one row: table name plus every column. */
export function rowObjectText(table: SnapshotTable, row: SnapshotRow): string {
  return canonicalJson({ table, row });
}

export function parseRowObject(text: string): { table: SnapshotTable; row: SnapshotRow } {
  const parsed = JSON.parse(text) as { table?: unknown; row?: unknown };
  if (!SNAPSHOT_TABLES.includes(parsed.table as SnapshotTable) || !parsed.row || typeof parsed.row !== 'object')
    throw new Error('A backup object is damaged.');
  return { table: parsed.table as SnapshotTable, row: parsed.row as SnapshotRow };
}

export function emptyTables(): Record<SnapshotTable, string[]> {
  return Object.fromEntries(SNAPSHOT_TABLES.map((table) => [table, []])) as unknown as Record<SnapshotTable, string[]>;
}

/** Snapshot ids sort chronologically: a compact UTC time plus a short content suffix. */
export function snapshotId(createdAt: Date, contentHash: string): string {
  return `${createdAt.toISOString().replace(/[-:.]/g, '').replace('T', '-').slice(0, 15)}-${contentHash.slice(0, 8)}`;
}

export function countsFromRows(rows: Record<SnapshotTable, SnapshotRow[]>): SnapshotCounts {
  return {
    workouts: rows.workouts.filter((row) => Number(row.is_active) === 0).length,
    plans: rows.plans.length,
    routines: rows.routines.length,
    customExercises: rows.custom_exercises.filter((row) => Number(row.archived ?? 0) === 0).length,
  };
}

/**
 * Writes one snapshot: every row becomes an object (written only if the store
 * does not already hold it), then the manifest. Returns the manifest.
 */
export async function writeSnapshot(
  store: SnapshotStore,
  rows: Record<SnapshotTable, SnapshotRow[]>,
  options: { hash: HashText; now: Date; appVersion: string; trigger: SnapshotTrigger },
): Promise<SnapshotManifest> {
  const existing = new Set(await store.listObjectHashes());
  const tables = emptyTables();
  let newObjects = 0;
  for (const table of SNAPSHOT_TABLES) {
    for (const row of rows[table]) {
      const text = rowObjectText(table, row);
      const hash = await options.hash(text);
      if (!existing.has(hash)) {
        await store.writeObject(hash, text);
        existing.add(hash);
        newObjects += 1;
      }
      tables[table].push(hash);
    }
  }
  const contentHash = await options.hash(canonicalJson(tables));
  const manifest: SnapshotManifest = {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    id: snapshotId(options.now, contentHash),
    createdAt: options.now.toISOString(),
    appVersion: options.appVersion,
    trigger: options.trigger,
    tables,
    counts: countsFromRows(rows),
    newObjects,
  };
  // The manifest goes last, so an interrupted run never leaves a snapshot that
  // points at objects that were not written.
  await store.writeManifest(manifest);
  return manifest;
}

export function validateManifest(value: unknown): SnapshotManifest {
  const manifest = value as Partial<SnapshotManifest>;
  if (manifest?.format !== SNAPSHOT_FORMAT || manifest.version !== SNAPSHOT_VERSION || typeof manifest.id !== 'string')
    throw new Error('This backup was made by a newer or unknown version of Forge.');
  if (!manifest.tables || SNAPSHOT_TABLES.some((table) => !Array.isArray(manifest.tables?.[table])))
    throw new Error('A backup manifest is damaged.');
  return manifest as SnapshotManifest;
}

/** Reads every row of a snapshot back, table by table, in restore order. */
export async function readSnapshotRows(
  store: SnapshotStore,
  manifest: SnapshotManifest,
): Promise<Record<SnapshotTable, SnapshotRow[]>> {
  const rows = Object.fromEntries(SNAPSHOT_TABLES.map((table) => [table, [] as SnapshotRow[]])) as unknown as Record<SnapshotTable, SnapshotRow[]>;
  for (const table of SNAPSHOT_TABLES) {
    for (const hash of manifest.tables[table]) {
      const object = parseRowObject(await store.readObject(hash));
      if (object.table !== table) throw new Error('A backup object is damaged.');
      rows[table].push(object.row);
    }
  }
  return rows;
}

/** Copies a snapshot to another store, sending only the objects it lacks. */
export async function mirrorSnapshot(
  source: SnapshotStore,
  target: SnapshotStore,
  manifest: SnapshotManifest,
): Promise<number> {
  const existing = new Set(await target.listObjectHashes());
  let copied = 0;
  for (const hash of new Set(SNAPSHOT_TABLES.flatMap((table) => manifest.tables[table]))) {
    if (existing.has(hash)) continue;
    await target.writeObject(hash, await source.readObject(hash));
    copied += 1;
  }
  await target.writeManifest(manifest);
  return copied;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Retention: every snapshot from the last 7 days, the newest of each ISO week
 * for 8 weeks, the newest of each month for 12 months, and always the latest.
 */
export function selectSnapshotsToKeep(
  manifests: readonly Pick<SnapshotManifest, 'id' | 'createdAt'>[],
  now: Date,
): Set<string> {
  const sorted = [...manifests].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const keep = new Set<string>();
  if (sorted[0]) keep.add(sorted[0].id);
  const weeks = new Set<string>();
  const months = new Set<string>();
  // Newest first, so the first snapshot seen in a week or month is its newest.
  // A week or month already represented by a kept snapshot needs no other one.
  for (const manifest of sorted) {
    const created = new Date(manifest.createdAt);
    const age = now.getTime() - created.getTime();
    const week = isoWeekKey(created);
    const month = `${created.getUTCFullYear()}-${created.getUTCMonth()}`;
    const kept =
      age <= 7 * DAY ||
      (age <= 8 * 7 * DAY && !weeks.has(week)) ||
      (age <= 366 * DAY && !months.has(month));
    if (!kept) continue;
    keep.add(manifest.id);
    weeks.add(week);
    months.add(month);
  }
  return keep;
}

function isoWeekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return `${day.getUTCFullYear()}-W${Math.ceil(((day.getTime() - yearStart) / DAY + 1) / 7)}`;
}

/**
 * Applies retention to one store, then removes objects no kept snapshot
 * references. Returns how many snapshots and objects were removed.
 */
export async function pruneStore(store: SnapshotStore, now: Date): Promise<{ snapshots: number; objects: number }> {
  const manifests = await Promise.all((await store.listManifestIds()).map((id) => store.readManifest(id)));
  const keep = selectSnapshotsToKeep(manifests, now);
  let snapshots = 0;
  for (const manifest of manifests) {
    if (keep.has(manifest.id)) continue;
    await store.removeManifest(manifest.id);
    snapshots += 1;
  }
  const referenced = new Set(
    manifests.filter((manifest) => keep.has(manifest.id)).flatMap((manifest) => SNAPSHOT_TABLES.flatMap((table) => manifest.tables[table])),
  );
  let objects = 0;
  for (const hash of await store.listObjectHashes()) {
    if (referenced.has(hash)) continue;
    await store.removeObject(hash);
    objects += 1;
  }
  return { snapshots, objects };
}

/** Backup bookkeeping kept in app state. */
export type BackupState = {
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  /** Set when the last run failed to save even on the phone. */
  lastError?: string;
  /** `pending`: copied into the iCloud folder, waiting for iOS to upload it. */
  cloud?: 'synced' | 'pending' | 'unavailable' | 'no-space' | 'error';
  /** The snapshot whose iCloud upload is being watched while `cloud` is pending. */
  cloudManifestId?: string;
  /** The backup folder outside the app; without it, backups stay in app storage and go with the app. */
  folder?: { name: string; uri?: string };
  /** Set when the chosen folder could not be written, so the last backup stayed in app storage. */
  folderUnavailable?: boolean;
  lastWarningAt?: string;
};

export const AUTO_BACKUP_INTERVAL = 7 * DAY;
export const BACKUP_WARNING_INTERVAL = 14 * DAY;

/** Automatic backups run once a week. */
export function isAutoBackupDue(state: BackupState, now: Date): boolean {
  const last = state.lastSuccessAt ? Date.parse(state.lastSuccessAt) : 0;
  return now.getTime() - last >= AUTO_BACKUP_INTERVAL;
}

/**
 * The reminder appears at most every two weeks, when automatic backup is off and
 * nothing was backed up in two weeks, or when the last run (or its iCloud copy)
 * failed. An unavailable iCloud (Android, unsigned builds, signed out) is normal.
 */
export function shouldWarnAboutBackup(state: BackupState, autoBackupEnabled: boolean, now: Date): boolean {
  const lastWarning = state.lastWarningAt ? Date.parse(state.lastWarningAt) : 0;
  if (now.getTime() - lastWarning < BACKUP_WARNING_INTERVAL) return false;
  const failing = Boolean(state.lastError) || Boolean(state.folderUnavailable) || state.cloud === 'no-space' || state.cloud === 'error';
  if (failing) return true;
  if (autoBackupEnabled) return false;
  const lastSuccess = state.lastSuccessAt ? Date.parse(state.lastSuccessAt) : 0;
  return now.getTime() - lastSuccess >= BACKUP_WARNING_INTERVAL;
}

/** The few file operations a snapshot store needs; paths use `/` and are relative to the store root. */
export interface SnapshotFiles {
  list(directory: string): Promise<string[]>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** The on-disk layout shared by the phone and iCloud: `snapshots/<id>.json`, `objects/<aa>/<hash>.json`. */
export function filesSnapshotStore(files: SnapshotFiles): SnapshotStore {
  const objectPath = (hash: string) => `objects/${hash.slice(0, 2)}/${hash}.json`;
  return {
    async listManifestIds() {
      return (await files.list('snapshots')).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort();
    },
    async readManifest(id) {
      return validateManifest(JSON.parse(await files.read(`snapshots/${id}.json`)));
    },
    writeManifest: (manifest) => files.write(`snapshots/${manifest.id}.json`, JSON.stringify(manifest)),
    removeManifest: (id) => files.remove(`snapshots/${id}.json`),
    async listObjectHashes() {
      const hashes: string[] = [];
      for (const prefix of await files.list('objects')) {
        for (const name of await files.list(`objects/${prefix}`)) {
          if (name.endsWith('.json')) hashes.push(name.slice(0, -5));
        }
      }
      return hashes;
    },
    readObject: (hash) => files.read(objectPath(hash)),
    writeObject: (hash, text) => files.write(objectPath(hash), text),
    removeObject: (hash) => files.remove(objectPath(hash)),
  };
}

export type CloudStatus = NonNullable<BackupState['cloud']>;

/** Maps an iCloud bridge error (`<kind>: <detail>`) to a cloud status. */
export function cloudStatusFromError(error: unknown): CloudStatus {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('no-space')) return 'no-space';
  if (message.includes('unavailable')) return 'unavailable';
  return 'error';
}

export type SnapshotListing = SnapshotManifest & { local: boolean; cloud: boolean };

/** One list for the manager: snapshots from both stores, newest first. */
export function mergeListings(local: SnapshotManifest[], cloud: SnapshotManifest[]): SnapshotListing[] {
  const byId = new Map<string, SnapshotListing>();
  for (const manifest of local) if (!byId.has(manifest.id)) byId.set(manifest.id, { ...manifest, local: true, cloud: false });
  for (const manifest of cloud) {
    const existing = byId.get(manifest.id);
    byId.set(manifest.id, existing ? { ...existing, cloud: true } : { ...manifest, local: false, cloud: true });
  }
  return [...byId.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/**
 * The display name of an Android Storage Access Framework document. Its URI
 * carries the whole path encoded in one segment
 * (`…/document/primary%3ADocuments%2FForge%20Backups`), so take the decoded tail.
 */
export function safName(uri: string): string {
  const decoded = decodeURIComponent(uri.replace(/\/+$/, ''));
  const tail = decoded.slice(decoded.lastIndexOf('/') + 1);
  return tail.slice(tail.lastIndexOf(':') + 1) || tail;
}

export type UploadState = 'uploaded' | 'pending' | 'no-space' | 'error' | 'unavailable';

/**
 * The cloud status once iOS reports on the watched upload. Only a quota error
 * counts as a failure: other upload errors (offline, server busy) retry on their own.
 */
export function cloudStatusAfterUpload(current: BackupState['cloud'], upload: UploadState): BackupState['cloud'] {
  if (current !== 'pending' && current !== 'no-space') return current;
  if (upload === 'uploaded') return 'synced';
  if (upload === 'no-space') return 'no-space';
  return current;
}
