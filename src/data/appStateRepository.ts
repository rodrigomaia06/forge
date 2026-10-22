import { withDatabaseMaintenance, withDatabaseTransaction } from './database';
import type { AppStateKey } from './appStateMigration';
export { appStateKeys } from './appStateMigration';

export function loadAppState(key: AppStateKey): Promise<string | null> {
  return withDatabaseMaintenance(async (db) => {
    const row = await db.getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM app_state WHERE key = ?',
      key,
    );
    return row?.value_json ?? null;
  });
}

export function updateAppState(
  key: AppStateKey,
  update: (current: string | null) => string | null,
): Promise<void> {
  return withDatabaseTransaction(async (db) => {
    const row = await db.getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM app_state WHERE key = ?',
      key,
    );
    const value = update(row?.value_json ?? null);
    if (value === null) await db.runAsync('DELETE FROM app_state WHERE key = ?', key);
    else
      await db.runAsync(
        'INSERT OR REPLACE INTO app_state (key, value_json) VALUES (?, ?)',
        key,
        value,
      );
  });
}

export function saveAppState(key: AppStateKey, value: string | null): Promise<void> {
  return updateAppState(key, () => value);
}
