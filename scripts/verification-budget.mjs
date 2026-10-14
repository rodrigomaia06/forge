import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { cpus, getPriority, setPriority } from 'node:os';

export function parseCpuList(value) {
  const ids = value
    .trim()
    .split(',')
    .flatMap((part) => {
      if (!/^\d+(?:-\d+)?$/.test(part)) throw new Error(`Invalid CPU list: ${value}`);
      const [first, last = first] = part.split('-').map(Number);
      if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first)
        throw new Error(`Invalid CPU list: ${value}`);
      return Array.from({ length: last - first + 1 }, (_, index) => first + index);
    });
  return [...new Set(ids)].sort((a, b) => a - b);
}

export function selectVerificationPool(available, baseline = available) {
  const commonPool = baseline.slice(0, Math.max(1, Math.floor((baseline.length * 2) / 3)));
  const selected = commonPool.filter((id) => available.includes(id));
  if (!selected.length) throw new Error('No CPU from the shared verification pool is available.');
  return { baseline, commonPool, selected, workers: selected.length };
}

export function assertWorkerBudget(argv, limit, hostCpuCount = cpus().length) {
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    let value;
    if (argument === '--workers' || argument === '-j') value = argv[++index];
    else if (argument.startsWith('--workers=')) value = argument.slice('--workers='.length);
    else if (/^-j\d/.test(argument)) value = argument.slice(2);
    if (value === undefined) continue;
    const requested = value.endsWith('%')
      ? Math.floor((hostCpuCount * Number.parseFloat(value)) / 100)
      : Number(value);
    if (!Number.isInteger(requested) || requested < 1 || requested > limit) {
      throw new Error(`Requested ${value} workers exceeds Forge's ${limit}-worker CPU budget.`);
    }
  }
}

/** Enforce one CPU pool for the entire verification process tree, including existing Node threads. */
export function enforceVerificationBudget(argv = process.argv.slice(2)) {
  if (process.platform !== 'linux') {
    throw new Error(
      'Forge verification requires an environment with enforceable CPU affinity. This runner supports Linux; do not run unrestricted verification on this host.',
    );
  }
  const status = readFileSync('/proc/self/status', 'utf8');
  const match = status.match(/^Cpus_allowed_list:\s*(.+)$/m);
  if (!match)
    throw new Error('Cannot read the available CPU affinity; verification was not started.');
  const available = parseCpuList(match[1]);
  const inherited = process.env.FORGE_VERIFY_BASE_CPUS;
  const baseline = inherited ? parseCpuList(inherited) : available;
  if (inherited && available.some((id) => !baseline.includes(id))) {
    throw new Error('Inherited verification CPU baseline does not match this process.');
  }
  const online = parseCpuList(readFileSync('/sys/devices/system/cpu/online', 'utf8'));
  if (baseline.some((id) => !online.includes(id))) {
    throw new Error('Verification CPU baseline contains a CPU that is not online.');
  }
  const budget = selectVerificationPool(available, baseline);
  if (inherited && available.some((id) => !budget.commonPool.includes(id))) {
    throw new Error('Inherited verification process expanded outside the shared CPU pool.');
  }
  assertWorkerBudget(argv, budget.workers);
  execFileSync(
    'taskset',
    ['--all-tasks', '--pid', '--cpu-list', budget.selected.join(','), String(process.pid)],
    { stdio: 'pipe' },
  );
  // Linux niceness is per-thread; update the V8 threads that already existed on entry too.
  for (const thread of readdirSync('/proc/self/task')) {
    try {
      const id = Number(thread);
      setPriority(id, Math.max(10, getPriority(id)));
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
  process.env.FORGE_VERIFY_BASE_CPUS = baseline.join(',');
  process.env.FORGE_VERIFY_CPUS = budget.commonPool.join(',');
  process.env.FORGE_VERIFY_WORKERS = String(budget.workers);
  return budget;
}
