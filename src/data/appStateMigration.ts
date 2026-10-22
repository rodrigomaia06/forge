export const appStateKeys = {
  dashboard: '@forge/dashboard-layout-v1',
  timer: '@forge/rest-timer-v1',
  diagnostics: '@forge/diagnostics-v1',
  backupHistory: '@forge/backup-history-v1',
} as const;
export type AppStateKey = (typeof appStateKeys)[keyof typeof appStateKeys];
export const appStateSchema =
  'CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value_json TEXT NOT NULL)';
const marker = 'app-state-v1-migrated';

type MigrationDatabase = {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, ...params: string[]): Promise<T | null>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
  withTransactionAsync(work: () => Promise<void>): Promise<void>;
};
type LegacyStorage = {
  multiGet(keys: string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiRemove(keys: string[]): Promise<void>;
};

export async function migrateAppState(
  db: MigrationDatabase,
  storage: LegacyStorage,
): Promise<void> {
  await db.execAsync(appStateSchema);
  const keys = Object.values(appStateKeys);
  const migrated = await db.getFirstAsync('SELECT value FROM forge_meta WHERE key = ?', marker);
  if (!migrated) {
    const entries = await storage.multiGet(keys);
    await db.withTransactionAsync(async () => {
      for (const [key, value] of entries) {
        if (value === null) continue;
        // Validate JSON before deleting its legacy source. Existing SQLite values win.
        JSON.parse(value);
        await db.runAsync(
          'INSERT OR IGNORE INTO app_state (key, value_json) VALUES (?, ?)',
          key,
          value,
        );
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO forge_meta (key, value) VALUES (?, ?)',
        marker,
        '1',
      );
    });
  }
  await storage.multiRemove(keys);
}

/** Old full backups replace auxiliary state with defaults, never destination values. */
export async function prepareRestoredAppState(db: MigrationDatabase): Promise<void> {
  await db.execAsync(appStateSchema);
  await db.runAsync('INSERT OR REPLACE INTO forge_meta (key, value) VALUES (?, ?)', marker, '1');
}
