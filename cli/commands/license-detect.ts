import fs from 'node:fs';
import path from 'node:path';
import { emit, ok, type Envelope } from '../lib/json-output';

/**
 * `license-detect` — classify a source's license into a port mode for hc-cop.
 * Cross-checks the LICENSE text against the declared `package.json` license; a
 * conflict (or anything unknown/ambiguous) resolves to `rewrite` — the safer
 * legal posture. Never let a single self-reported field downgrade to `adapt`.
 */

export interface LicenseDetectOptions { path: string; json: boolean; }

type Mode = 'adapt' | 'rewrite';
interface LicenseData { spdx: string | null; declared: string | null; mode: Mode; reason: string; }

/** SPDX → permissive (adapt). Everything else (copyleft/unknown) → rewrite. */
const PERMISSIVE = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense', 'MIT-0']);

const SIGNATURES: Array<[RegExp, string]> = [
  [/\bGNU AFFERO GENERAL PUBLIC LICENSE\b/i, 'AGPL-3.0'],
  [/\bGNU LESSER GENERAL PUBLIC LICENSE\b/i, 'LGPL-3.0'],
  [/\bGNU GENERAL PUBLIC LICENSE\b/i, 'GPL-3.0'],
  [/\bMozilla Public License\b/i, 'MPL-2.0'],
  [/\bApache License,?\s+Version 2\.0\b/i, 'Apache-2.0'],
  [/\bPermission is hereby granted, free of charge\b/i, 'MIT'],
  [/\bRedistribution and use in source and binary forms\b[\s\S]*\bneither the name\b/i, 'BSD-3-Clause'],
  [/\bRedistribution and use in source and binary forms\b/i, 'BSD-2-Clause'],
  [/\bISC License\b|\bPermission to use, copy, modify\b/i, 'ISC'],
  [/\bThis is free and unencumbered software released into the public domain\b/i, 'Unlicense'],
];

export function cmdLicenseDetect(opts: LicenseDetectOptions): number {
  const root = path.resolve(opts.path);
  const text = readLicenseText(root);
  const declared = readDeclared(root);
  const spdx = text ? matchSpdx(text) : null;

  const data = classify(spdx, declared);
  emit(ok('license-detect', data, []), opts.json, human);
  return 0;
}

function classify(spdx: string | null, declared: string | null): LicenseData {
  if (!spdx && !declared) return { spdx, declared, mode: 'rewrite', reason: 'no license found — assume all rights reserved' };
  // Conflict: declared permissive but the LICENSE text says copyleft (or vice-versa).
  if (spdx && declared && normalize(spdx) !== normalize(declared) && !(PERMISSIVE.has(spdx) && PERMISSIVE.has(declared))) {
    return { spdx, declared, mode: 'rewrite', reason: `conflict: LICENSE text is ${spdx} but package.json declares ${declared}` };
  }
  const effective = spdx ?? declared!;
  if (PERMISSIVE.has(normalizeSpdx(effective))) return { spdx, declared, mode: 'adapt', reason: `${effective} is permissive` };
  return { spdx, declared, mode: 'rewrite', reason: `${effective} is copyleft or unrecognized` };
}

function readLicenseText(root: string): string | null {
  for (const n of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING']) {
    try { return fs.readFileSync(path.join(root, n), 'utf8'); } catch { /* next */ }
  }
  return null;
}

function readDeclared(root: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return typeof pkg.license === 'string' ? pkg.license : null;
  } catch { return null; }
}

function matchSpdx(text: string): string | null {
  for (const [re, id] of SIGNATURES) if (re.test(text)) return id;
  return null;
}

function normalize(s: string): string { return normalizeSpdx(s); }
function normalizeSpdx(s: string): string { return s.replace(/-only$|-or-later$/i, '').trim(); }

function human(env: Envelope<LicenseData>): void {
  const d = env.data;
  console.log(`license: ${d.spdx ?? d.declared ?? 'none'} → mode: ${d.mode}`);
  console.log(`reason: ${d.reason}`);
}
