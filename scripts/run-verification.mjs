import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { enforceVerificationBudget } from './verification-budget.mjs';

const argv = process.argv.slice(2);
if (!argv.length) throw new Error('Usage: node scripts/run-verification.mjs <command> [arguments]');
const budget = enforceVerificationBudget(argv);
process.stderr.write(
  `Forge verification: CPU affinity ${budget.selected.join(',')}; priority >=10; worker limit ${budget.workers}.\n`,
);
const localBinary = resolve('node_modules/.bin', argv[0]);
const child = spawn(existsSync(localBinary) ? localBinary : argv[0], argv.slice(1), {
  stdio: 'inherit',
  env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
