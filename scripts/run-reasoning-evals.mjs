#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'dist', 'lib', 'reasoning-harness', 'runner.js');
if (!fs.existsSync(entry)) {
  console.error('Build required: run `npm run build` before `scripts/run-reasoning-evals.mjs`.');
  process.exit(1);
}

// A bare Windows path is not a legal ESM specifier — it must be a file:// URL.
const { parseRunnerArgs, runReasoningEvals } = await import(pathToFileURL(entry).href);
const artifacts = await runReasoningEvals(parseRunnerArgs(process.argv.slice(2)));
const status = artifacts.attemptedComplete ? 'attempted-complete' : 'incomplete';
const baseline = artifacts.baselineEligible ? 'baseline-eligible' : 'baseline-ineligible';
process.stdout.write(`${status} ${baseline} ${artifacts.manifest.manifestHash}\n`);
