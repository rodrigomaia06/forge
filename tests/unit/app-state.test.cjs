const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => mocks[name] ?? {} });
  return exports;
}
const { appStateKeys, migrateAppState, prepareRestoredAppState } = load('src/data/appStateMigration.ts');
const { registerPersistenceFlush, flushPersistence, subscribePersistenceReset, notifyPersistenceReset } = load('src/data/persistenceLifecycle.ts');
function fixture() {
  const connection = new DatabaseSync(':memory:');
  connection.exec('CREATE TABLE forge_meta (key TEXT PRIMARY KEY, value TEXT);');
  let failAt = '';
  const db = {
    execAsync: async sql => connection.exec(sql),
    getFirstAsync: async (sql, ...args) => connection.prepare(sql).get(...args) ?? null,
    runAsync: async (sql, ...args) => {
      if (args[0] === failAt) throw new Error('interrupted write');
      return connection.prepare(sql).run(...args);
    },
    withTransactionAsync: async work => {
      connection.exec('BEGIN');
      try { await work(); connection.exec('COMMIT'); }
      catch (error) { connection.exec('ROLLBACK'); throw error; }
    },
  };
  const values = Object.fromEntries(Object.values(appStateKeys).map((key, index) => [key, JSON.stringify({ saved: index })]));
  const storage = {
    multiGet: async keys => keys.map(key => [key, values[key] ?? null]),
    multiRemove: async keys => keys.forEach(key => delete values[key]),
  };
  return { db, values, storage, fail: key => { failAt = key; }, rows: () => connection.prepare('SELECT * FROM app_state ORDER BY key').all() };
}
test('migrates all auxiliary state and cleans up only after success', async () => {
  const f = fixture();
  const original = { ...f.values };
  await migrateAppState(f.db, f.storage);
  assert.equal(f.rows().length, 4);
  for (const row of f.rows()) assert.equal(row.value_json, original[row.key]);
  assert.deepEqual(f.values, {});
  await migrateAppState(f.db, f.storage);
  assert.equal(f.rows().length, 4);
});
test('interrupted transaction rolls back and retains every legacy source for retry', async () => {
  const f = fixture();
  f.fail(appStateKeys.timer);
  await assert.rejects(migrateAppState(f.db, f.storage), /interrupted/);
  assert.equal(f.rows().length, 0);
  assert.equal(Object.keys(f.values).length, 4);
  f.fail('');
  await migrateAppState(f.db, f.storage);
  assert.equal(f.rows().length, 4);
});
test('cleanup failure can retry without replacing newer database values', async () => {
  const f = fixture();
  await assert.rejects(migrateAppState(f.db, { ...f.storage, multiRemove: async () => { throw new Error('cleanup unavailable'); } }));
  await f.db.runAsync('UPDATE app_state SET value_json = ? WHERE key = ?', '"new"', appStateKeys.dashboard);
  await migrateAppState(f.db, f.storage);
  assert.equal(f.rows().find(row => row.key === appStateKeys.dashboard).value_json, '"new"');
  assert.deepEqual(f.values, {});
});
test('malformed legacy JSON never gets deleted or partially imported', async () => {
  const f = fixture(); f.values[appStateKeys.timer] = '{broken';
  await assert.rejects(migrateAppState(f.db, f.storage));
  assert.equal(f.rows().length, 0);
  assert.equal(f.values[appStateKeys.timer], '{broken');
});
test('older backup starts with defaults and cannot import destination legacy state', async () => {
  const f = fixture();
  await prepareRestoredAppState(f.db);
  await migrateAppState(f.db, f.storage);
  assert.equal(f.rows().length, 0);
  assert.deepEqual(f.values, {});
});
test('new backup preparation retains every restored value', async () => {
  const f = fixture(); await migrateAppState(f.db, f.storage);
  const original = f.rows();
  await prepareRestoredAppState(f.db);
  assert.deepEqual(f.rows(), original);
});
test('backup flush waits for pending edits and propagates failures; reset unsubscribes', async () => {
  let finish; let saved = false;
  const release = registerPersistenceFlush(() => new Promise(resolve => { finish = () => { saved = true; resolve(); }; }));
  const flushing = flushPersistence();
  assert.equal(saved, false); finish(); await flushing;
  assert.equal(saved, true); release();
  const remove = registerPersistenceFlush(async () => { throw new Error('disk full'); });
  await assert.rejects(flushPersistence(), /disk full/); remove();
  let resets = 0;
  const unsubscribe = subscribePersistenceReset(() => resets++);
  notifyPersistenceReset(); unsubscribe(); notifyPersistenceReset();
  assert.equal(resets, 1);
});


test('full backup drains edits, restores every auxiliary value and preferences, and deletion clears them', async () => {
  const os = require('node:os');
  const path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-backup-test-'));
  const files = new Map();
  const databases = new Set();
  let serial = 0;
  const open = bytes => {
    const filename = path.join(directory, `${serial++}.sqlite`);
    if (bytes) fs.writeFileSync(filename, bytes);
    let connection = new DatabaseSync(filename);
    const db = {
      execAsync: async sql => connection.exec(sql),
      getFirstAsync: async (sql, ...args) => connection.prepare(sql).get(...args) ?? null,
      getAllAsync: async (sql, ...args) => connection.prepare(sql).all(...args),
      runAsync: async (sql, ...args) => connection.prepare(sql).run(...args),
      withTransactionAsync: async work => {
        connection.exec('BEGIN');
        try { await work(); connection.exec('COMMIT'); }
        catch (error) { connection.exec('ROLLBACK'); throw error; }
      },
      serializeAsync: async () => fs.readFileSync(filename),
      closeAsync: async () => { connection.close(); databases.delete(db); },
      replace: async bytes => { connection.close(); fs.writeFileSync(filename, bytes); connection = new DatabaseSync(filename); },
    };
    databases.add(db);
    return db;
  };
  class File {
    constructor(...parts) { this.uri = parts.map(part => part.uri ?? part).join('/'); }
    get exists() { return files.has(this.uri); }
    create() { files.set(this.uri, new Uint8Array()); }
    write(bytes) { files.set(this.uri, bytes); }
    delete() { files.delete(this.uri); }
  }
  let shared;
  const live = open();
  await live.execAsync(`
    CREATE TABLE forge_meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE preferences (id INTEGER PRIMARY KEY, value_json TEXT);
    CREATE TABLE workouts (id TEXT PRIMARY KEY, is_active INTEGER);
    CREATE TABLE plans (id TEXT PRIMARY KEY);
    CREATE TABLE routines (id TEXT PRIMARY KEY);
    CREATE TABLE custom_exercises (id TEXT PRIMARY KEY, archived INTEGER);
    CREATE TABLE workout_types (id TEXT PRIMARY KEY);
    CREATE TABLE set_measurements (id TEXT PRIMARY KEY);
    CREATE TABLE set_targets (id TEXT PRIMARY KEY);
    INSERT INTO preferences VALUES (1, '{"appearance":"dark","units":"imperial"}');
  `);
  const legacy = fixture();
  await migrateAppState(live, legacy.storage);
  const unregister = registerPersistenceFlush(async () => {
    await live.runAsync('UPDATE app_state SET value_json = ? WHERE key = ?', '"latest note"', appStateKeys.dashboard);
  });
  const repository = load('src/data/backupRepository.ts', {
    './database': { withDatabaseMaintenance: operation => operation(live) },
    './persistenceLifecycle': { flushPersistence, notifyPersistenceReset },
    './appStateMigration': { prepareRestoredAppState },
    'expo-file-system': { File, Paths: { cache: { uri: 'cache' } } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async uri => { shared = files.get(uri); } },
    'expo-sqlite': {
      openDatabaseAsync: async name => open(files.get(`cache/${name}`)),
      backupDatabaseAsync: async ({ sourceDatabase, destDatabase }) => destDatabase.replace(await sourceDatabase.serializeAsync()),
    },
    '@react-native-async-storage/async-storage': { multiRemove: async () => undefined },
  });
  try {
    await repository.createSqliteBackup();
    unregister();
    const original = await live.getAllAsync('SELECT * FROM app_state ORDER BY key');
    await live.execAsync('DELETE FROM app_state; DELETE FROM preferences;');
    await repository.restoreSqliteBackup({ bytes: shared });
    assert.deepEqual(await live.getAllAsync('SELECT * FROM app_state ORDER BY key'), original);
    assert.equal((await live.getFirstAsync('SELECT value_json FROM preferences')).value_json, '{"appearance":"dark","units":"imperial"}');
    const old = open(shared);
    await old.execAsync('DROP TABLE app_state;');
    await repository.restoreSqliteBackup({ bytes: await old.serializeAsync() });
    assert.equal((await live.getAllAsync('SELECT * FROM app_state')).length, 0);
    await live.runAsync('INSERT INTO app_state VALUES (?, ?)', appStateKeys.dashboard, '"destination"');
    await live.runAsync('INSERT OR REPLACE INTO forge_meta VALUES (?, ?)', 'csv-exercise-mappings-v1', '{"exercise":"custom"}');
    await repository.eraseAllForgeData();
    assert.equal((await live.getAllAsync('SELECT * FROM app_state')).length, 0);
    assert.equal((await live.getAllAsync('SELECT * FROM preferences')).length, 0);
    assert.equal(await live.getFirstAsync('SELECT value FROM forge_meta WHERE key = ?', 'csv-exercise-mappings-v1'), null);
  } finally {
    unregister();
    for (const db of [...databases]) await db.closeAsync();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


test('repository updates serialize concurrent changes and deletion removes the saved row', async () => {
  const f = fixture(); await prepareRestoredAppState(f.db);
  let queue = Promise.resolve();
  const schedule = operation => {
    const next = queue.then(operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const repository = load('src/data/appStateRepository.ts', {
    './database': {
      withDatabaseMaintenance: operation => schedule(() => operation(f.db)),
      withDatabaseTransaction: operation => schedule(() => f.db.withTransactionAsync(() => operation(f.db))),
    },
    './appStateMigration': { appStateKeys },
  });
  await Promise.all(Array.from({ length: 4 }, () => repository.updateAppState(appStateKeys.backupHistory, raw => String(Number(raw ?? 0) + 1))));
  assert.equal(await repository.loadAppState(appStateKeys.backupHistory), '4');
  await assert.rejects(repository.updateAppState(appStateKeys.backupHistory, () => { throw new Error('failed update'); }));
  assert.equal(await repository.loadAppState(appStateKeys.backupHistory), '4');
  await repository.saveAppState(appStateKeys.backupHistory, null);
  assert.equal(await repository.loadAppState(appStateKeys.backupHistory), null);
});
