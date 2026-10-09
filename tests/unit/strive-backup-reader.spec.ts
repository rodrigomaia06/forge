import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  striveTables,
  striveColumns,
  requiredStriveColumns,
  requiredStriveTables,
} from '../../src/data/striveImport';

test('native Strive reader cancels, uses an isolated query-only database and cleans up after failures', async () => {
  const module = ts.transpileModule(readFileSync(resolve('src/data/pickStriveBackup.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const state of [
    'cancel',
    'success',
    'corrupt',
    'failure',
    'read-failure',
    'header',
    'version',
    'view',
    'missing-column',
    'optional-table',
    'oversized',
  ] as const) {
    const deleted: string[] = [],
      statements: string[] = [];
    let closed = false;
    class File {
      uri: string;
      size = state === 'oversized' ? 51 * 1024 * 1024 : 32;
      exists = true;
      constructor(...parts: Array<string | { uri: string }>) {
        this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
      }
      bytes() {
        if (state === 'read-failure') return Promise.reject(new Error('native private path'));
        if (state === 'header') return Promise.resolve(new Uint8Array(16));
        return Promise.resolve(
          Uint8Array.from('SQLite format 3\0'.split('').map((char) => char.charCodeAt(0))),
        );
      }
      write() {}
      delete() {
        deleted.push(this.uri);
      }
    }
    const exports: Record<string, unknown> = {};
    runInNewContext(module, {
      exports,
      require: (name: string) => {
        if (name === 'expo-document-picker')
          return {
            getDocumentAsync: async () => ({
              canceled: state === 'cancel',
              assets: [{ uri: 'original', name: 'source.db' }],
            }),
          };
        if (name === 'expo-file-system') return { File, Paths: { cache: { uri: 'cache' } } };
        if (name === './striveImport')
          return { striveTables, striveColumns, requiredStriveColumns, requiredStriveTables };
        if (name === 'expo-sqlite')
          return {
            openDatabaseAsync: async () => ({
              execAsync: async (sql: string) => {
                statements.push(sql);
              },
              getAllAsync: async (sql: string) => {
                if (state === 'failure') throw new Error('native private path');
                if (sql.includes('table_info')) {
                  const table = sql.match(/table_info\((\w+)\)/)![1] as keyof typeof striveColumns;
                  return striveColumns[table]
                    .filter((column) => state !== 'missing-column' || column !== 'started_at')
                    .map((name) => ({ name }));
                }
                return sql.includes('quick_check')
                  ? [{ quick_check: state === 'corrupt' ? 'invalid' : 'ok' }]
                  : [];
              },
              getFirstAsync: async (sql: string, table: string) =>
                sql.includes('user_version')
                  ? { user_version: state === 'version' ? 86 : 85 }
                  : sql.includes('sqlite_master')
                    ? state === 'optional-table' && table === 'routine_notes'
                      ? null
                      : { type: state === 'view' ? 'view' : 'table' }
                    : { count: 0 },
              closeAsync: async () => {
                closed = true;
              },
            }),
          };
        throw new Error(name);
      },
      Uint8Array,
    });
    const pick = exports.pickStriveBackup as () => Promise<unknown>;
    if (state === 'cancel') {
      expect(await pick()).toBeNull();
      expect(deleted).toEqual([]);
    } else {
      if (state === 'success' || state === 'version' || state === 'optional-table')
        expect(await pick()).toMatchObject({
          name: 'source.db',
          snapshot: { version: state === 'version' ? 86 : 85 },
        });
      else {
        const failure = await pick().then(
          () => '',
          (error: Error) => error.message,
        );
        const expected = {
          corrupt: /integrity/,
          failure: /Could not read/,
          'read-failure': /Could not read/,
          header: /not a SQLite/,
          'missing-column': /required.*started_at/,
          view: /missing/,
          oversized: /50 MB/,
        };
        expect(failure).toMatch(expected[state]);
      }
      const opened = !['read-failure', 'header', 'oversized'].includes(state);
      expect(closed).toBe(opened);
      if (opened) expect(statements[0]).toContain('query_only = ON');
      expect(deleted).toHaveLength(4);
      expect(deleted).not.toContain('original');
    }
  }
});
