import fs from 'node:fs';
import path from 'node:path';
import { extractContracts } from './extract';
import { emit, ok, type Envelope } from '../../lib/json-output';
import type { FileContract } from './types';

/**
 * `contracts` — extract the public surface (exported symbols, signatures, HTTP
 * endpoints) of a codebase via deterministic per-language regex. Lets hc-scout
 * read a contract map instead of spawning extraction subagents. TS/JS, Python,
 * and Go are supported; a fast surface map, not a parser.
 */

export interface ContractsOptions {
  path: string;
  json: boolean;
  langs?: string[];
  exclude?: string[];
}

interface ContractsData {
  files: FileContract[];
  totals: { files: number; symbols: number; endpoints: number };
}

export function cmdContracts(opts: ContractsOptions): number {
  const root = path.resolve(opts.path);
  if (!fs.existsSync(root)) {
    console.error(`✗ Not found: ${opts.path}`);
    return 1;
  }

  const { files, warnings } = extractContracts(root, { langs: opts.langs, exclude: opts.exclude });
  let symbols = 0, endpoints = 0;
  for (const f of files) for (const s of f.symbols) { symbols++; if (s.kind === 'endpoint') endpoints++; }

  emit(ok('contracts', { files, totals: { files: files.length, symbols, endpoints } }, warnings), opts.json, human);
  return 0;
}

function human(env: Envelope<ContractsData>): void {
  const { files, totals } = env.data;
  for (const f of files) {
    console.log(`\n${f.file}`);
    for (const s of f.symbols) {
      const loc = `:${s.line}`;
      if (s.kind === 'endpoint') console.log(`  ${s.method} ${s.signature}${loc}`);
      else console.log(`  ${s.kind} ${s.name}${s.signature ?? ''}${loc}`);
    }
  }
  console.log(`\n${totals.files} files, ${totals.symbols} symbols, ${totals.endpoints} endpoints`);
  for (const w of env.warnings ?? []) console.log(`! ${w}`);
}
