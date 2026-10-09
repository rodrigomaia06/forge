import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import {
  striveTables,
  striveColumns,
  requiredStriveColumns,
  requiredStriveTables,
  type StriveSnapshot,
  type StriveRow,
} from './striveImport';

export async function pickStriveBackup(): Promise<{
  name: string;
  snapshot: StriveSnapshot;
} | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  const name = `strive-import-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
  const candidate = new File(Paths.cache, name);
  let database: SQLite.SQLiteDatabase | undefined;
  try {
    const source = new File(asset.uri);
    if (source.size > 50 * 1024 * 1024)
      throw new Error('This Strive backup exceeds the 50 MB import limit.');
    const bytes = await source.bytes();
    if ('SQLite format 3\0'.split('').some((character, i) => bytes[i] !== character.charCodeAt(0)))
      throw new Error('Choose a Strive .db or .sqlite backup. This file is not a SQLite database.');
    candidate.write(bytes);
    database = await SQLite.openDatabaseAsync(name, { useNewConnection: true }, Paths.cache.uri);
    await database.execAsync('PRAGMA query_only = ON; PRAGMA trusted_schema = OFF;');
    const integrity = await database.getAllAsync<Record<string, string>>('PRAGMA quick_check');
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok')
      throw new Error('The Strive backup failed integrity checks. Export a fresh backup.');
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const tables = {} as StriveSnapshot['tables'];
    for (const table of striveTables) {
      const entry = await database.getFirstAsync<{ type: string }>(
        'SELECT type FROM sqlite_master WHERE name = ?',
        table,
      );
      if (!entry && !(requiredStriveTables as readonly string[]).includes(table)) {
        tables[table] = [];
        continue;
      }
      if (entry?.type !== 'table')
        throw new Error(`The Strive backup is missing the ${table} table.`);
      const schema = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      const columns = new Set(schema.map((column) => column.name));
      const missing = requiredStriveColumns[table]?.find((column) => !columns.has(column));
      if (
        missing ||
        (table === 'exercises' &&
          !['name_en', 'name_pl', 'name'].some((column) => columns.has(column)))
      )
        throw new Error(
          `The Strive backup is missing a required ${table} field: ${missing ?? 'exercise name'}.`,
        );
      const count = await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      if (!count || count.count > 100000)
        throw new Error('This Strive backup has too many records for one import.');
      const selected = striveColumns[table].filter((column) => columns.has(column));
      tables[table] = selected.length
        ? await database.getAllAsync<StriveRow>(
            `SELECT ${selected.map((column) => `"${column}"`).join(', ')} FROM ${table}`,
          )
        : [];
    }
    return { name: asset.name, snapshot: { version: version?.user_version ?? 0, tables } };
  } catch (error) {
    // Native errors may contain file paths or query internals; expose only our validation messages.
    if (
      error instanceof Error &&
      /^(Choose a Strive|The Strive backup|This Strive backup)/.test(error.message)
    )
      throw error;
    throw new Error('Could not read the Strive backup. Export a fresh .db backup and try again.');
  } finally {
    try {
      await database?.closeAsync();
    } finally {
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        const file = new File(Paths.cache, `${name}${suffix}`);
        if (file.exists) file.delete();
      }
    }
  }
}
