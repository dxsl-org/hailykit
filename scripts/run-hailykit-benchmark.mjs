#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliEntry = path.join(repoRoot, 'dist', 'bin.js');
if (!fs.existsSync(cliEntry)) {
  exitWith('Build required: run `npm run build` before `scripts/run-hailykit-benchmark.mjs`.');
}

const args = process.argv.slice(2);
if (!args.length) {
  exitWith('Usage: node scripts/run-hailykit-benchmark.mjs <benchmark subcommand> [...]');
}

const run = spawnSync(process.execPath, [cliEntry, 'benchmark', ...args], {
  cwd: repoRoot,
  stdio: 'inherit',
});
process.exit(run.status ?? 1);

function exitWith(message) {
  console.error(message);
  process.exit(1);
}
