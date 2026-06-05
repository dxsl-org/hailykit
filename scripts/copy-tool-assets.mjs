#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC  = join(ROOT, 'cli', 'tools');
const DEST = join(ROOT, 'dist', 'tools');

if (!existsSync(SRC)) {
  console.log('No cli/tools/ dir found — skipping asset copy.');
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, {
  recursive: true,
  // cpSync filter runs for directories AND files. Always pass directories
  // through to avoid pruning subtrees; skip .ts files (tsc handles those).
  filter: (src) => statSync(src).isDirectory() || !src.endsWith('.ts'),
});
console.log('Copied tool assets: cli/tools/ → dist/tools/');
