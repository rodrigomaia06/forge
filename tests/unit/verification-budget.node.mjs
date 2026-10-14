import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  parseCpuList,
  selectVerificationPool,
  assertWorkerBudget,
} from '../../scripts/verification-budget.mjs';

const guard = resolve('scripts/run-verification.mjs');
const baseline = process.env.FORGE_VERIFY_BASE_CPUS;
const pool = process.env.FORGE_VERIFY_CPUS;
assert.ok(
  baseline && pool,
  'Run with npm run verify:run -- node --test tests/unit/verification-budget.node.mjs',
);

const probe = `
  const fs = require('node:fs');
  const os = require('node:os');
  const snapshot = () => ({
    affinity: fs.readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\\s*(.+)$/m)[1],
    baseline: process.env.FORGE_VERIFY_BASE_CPUS,
    pool: process.env.FORGE_VERIFY_CPUS,
    workers: Number(process.env.FORGE_VERIFY_WORKERS),
    threads: fs.readdirSync('/proc/self/task').flatMap(tid => {
      try { return [{ priority: os.getPriority(Number(tid)), affinity: fs.readFileSync('/proc/self/task/' + tid + '/status', 'utf8').match(/^Cpus_allowed_list:\\s*(.+)$/m)[1] }]; }
      catch (error) { if (error.code === 'ESRCH' || error.code === 'ENOENT') return []; throw error; }
    })
  });
`;

function guarded(args, env = process.env) {
  return spawnSync(process.execPath, [guard, ...args], { encoding: 'utf8', env });
}

function checkSnapshot(snapshot) {
  const permitted = parseCpuList(pool);
  assert.deepEqual(parseCpuList(snapshot.affinity), permitted);
  assert.equal(snapshot.baseline, baseline);
  assert.equal(snapshot.pool, pool);
  assert.equal(snapshot.workers, permitted.length);
  assert.ok(snapshot.threads.length > 0);
  for (const thread of snapshot.threads) {
    assert.ok(thread.priority >= 10);
    assert.deepEqual(parseCpuList(thread.affinity), permitted);
  }
}

test('CPU lists preserve actual noncontiguous IDs and reject malformed ranges', () => {
  assert.deepEqual(parseCpuList('2,4-6,4,11'), [2, 4, 5, 6, 11]);
  for (const invalid of ['', '-1', '4-2', 'a', '2.5', '1-2-3', '1,'])
    assert.throws(() => parseCpuList(invalid));
  assert.deepEqual(selectVerificationPool([9]).selected, [9]);
  assert.equal(selectVerificationPool([9]).workers, 1);
  const selected = selectVerificationPool([2, 4, 7, 9, 11, 14]);
  assert.deepEqual(selected.selected, [2, 4, 7, 9]);
  assert.deepEqual(selectVerificationPool([7, 9], [2, 4, 7, 9, 11, 14]).selected, [7, 9]);
  assert.throws(() => selectVerificationPool([11, 14], [2, 4, 7, 9, 11, 14]));
});

test('all Playwright worker override forms respect the integer allowance', () => {
  for (const argv of [
    ['--workers', '17'],
    ['--workers=17'],
    ['-j', '17'],
    ['-j17'],
    ['--workers=100%'],
    ['--workers=1.5'],
  ]) {
    assert.throws(() => assertWorkerBudget(argv, 16, 24));
  }
  for (const argv of [['--workers=16'], ['-j8'], ['--workers', '66%'], ['--workers=50%']]) {
    assert.doesNotThrow(() => assertWorkerBudget(argv, 16, 24));
  }
});

test('nested wrappers keep the shared pool and reduce priority on every existing V8 thread', () => {
  const result = guarded([
    process.execPath,
    guard,
    process.execPath,
    '-e',
    `${probe} console.log(JSON.stringify(snapshot()));`,
  ]);
  assert.equal(result.status, 0, result.stderr);
  checkSnapshot(JSON.parse(result.stdout));
});

test('children and grandchildren inherit the exact pool and reduced priority', () => {
  const descendant = `${probe} console.log(JSON.stringify(snapshot()));`;
  const parent = `${probe}
    const child = require('node:child_process').spawnSync(process.execPath, ['-e', ${JSON.stringify(descendant)}], { encoding: 'utf8' });
    if (child.status !== 0) throw new Error(child.stderr);
    console.log(JSON.stringify({ self: snapshot(), child: JSON.parse(child.stdout) }));
  `;
  const result = guarded([process.execPath, '-e', parent]);
  assert.equal(result.status, 0, result.stderr);
  const snapshots = JSON.parse(result.stdout);
  checkSnapshot(snapshots.self);
  checkSnapshot(snapshots.child);
});

test('invalid inherited baselines and oversized CLI overrides fail before launching their command', () => {
  const online = parseCpuList(readFileSync('/sys/devices/system/cpu/online', 'utf8'));
  const nonexistent = Math.max(...online) + 1;
  const invalidBaseline = `${baseline},${nonexistent}`;
  const result = guarded([process.execPath, '-e', 'console.log("SHOULD_NOT_START")'], {
    ...process.env,
    FORGE_VERIFY_BASE_CPUS: invalidBaseline,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not online/);
  assert.doesNotMatch(result.stdout, /SHOULD_NOT_START/);
  const excessive = guarded([
    process.execPath,
    '-e',
    'console.log("SHOULD_NOT_START")',
    '--workers=999',
  ]);
  assert.notEqual(excessive.status, 0);
  assert.doesNotMatch(excessive.stdout, /SHOULD_NOT_START/);
});

test('narrowing affinity reuses the original shared budget instead of applying two thirds again', () => {
  const firstCpu = parseCpuList(pool)[0];
  const result = spawnSync(
    'taskset',
    [
      '--cpu-list',
      String(firstCpu),
      process.execPath,
      guard,
      process.execPath,
      '-e',
      `${probe} console.log(JSON.stringify(snapshot()));`,
    ],
    { encoding: 'utf8', env: process.env },
  );
  assert.equal(result.status, 0, result.stderr);
  const snapshot = JSON.parse(result.stdout);
  assert.deepEqual(parseCpuList(snapshot.affinity), [firstCpu]);
  assert.equal(snapshot.workers, 1);
  assert.equal(snapshot.baseline, baseline);
  assert.equal(snapshot.pool, pool);
});

test('a process cannot expand its inherited pool before invoking the guard again', (context) => {
  const expanded = parseCpuList(baseline).find((id) => !parseCpuList(pool).includes(id));
  if (expanded === undefined) {
    context.skip('Single-core minimum leaves no outside CPU');
    return;
  }
  const result = spawnSync(
    'taskset',
    [
      '--cpu-list',
      String(expanded),
      process.execPath,
      guard,
      process.execPath,
      '-e',
      'console.log("SHOULD_NOT_START")',
    ],
    { encoding: 'utf8', env: process.env },
  );
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /SHOULD_NOT_START/);
  assert.match(result.stderr, /shared verification pool|expanded outside/);
});
