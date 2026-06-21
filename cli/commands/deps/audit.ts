import fs from 'node:fs';
import path from 'node:path';
import { runTool } from '../../lib/spawn';
import { emit, ok, type Envelope } from '../../lib/json-output';
import { parseNpm, parsePip, parseCargo, parseGo, type Adapter } from './adapters';
import { summarize, type EcosystemResult } from './types';

/**
 * `deps-audit` — run the ecosystem's native auditor and normalize its output to
 * one advisory schema for hc-fix. Wrapper, not a replacement: the auditor must
 * be on PATH (absence yields a structured `auditor_missing`, never a crash).
 * All spawning goes through cli/lib/spawn (absolute-path resolve, scrubbed env,
 * stdout kept on non-zero exit, win32 .cmd handled).
 */

export interface DepsAuditOptions { path: string; ecosystem?: string; json: boolean; }

interface Ecosystem {
  name: string;
  /** Lockfiles whose presence selects this ecosystem. */
  lockfiles: string[];
  cmd: string;
  args: string[];
  adapter: Adapter;
}

const ECOSYSTEMS: Ecosystem[] = [
  { name: 'npm', lockfiles: ['package-lock.json', 'npm-shrinkwrap.json'], cmd: 'npm', args: ['audit', '--json'], adapter: parseNpm },
  { name: 'pip', lockfiles: ['requirements.txt', 'poetry.lock', 'Pipfile.lock', 'pyproject.toml'], cmd: 'pip-audit', args: ['-f', 'json'], adapter: parsePip },
  { name: 'cargo', lockfiles: ['Cargo.lock'], cmd: 'cargo', args: ['audit', '--json'], adapter: parseCargo },
  { name: 'go', lockfiles: ['go.sum'], cmd: 'govulncheck', args: ['-json', './...'], adapter: parseGo },
];

export function cmdDepsAudit(opts: DepsAuditOptions): number {
  const root = path.resolve(opts.path);
  const selected = ECOSYSTEMS.filter(e =>
    opts.ecosystem ? e.name === opts.ecosystem : e.lockfiles.some(f => fs.existsSync(path.join(root, f))));

  if (selected.length === 0) {
    emit(ok('deps-audit', { ecosystems: [], note: 'no recognized lockfile' }, []), opts.json, human);
    return 0;
  }

  const results: EcosystemResult[] = selected.map(e => runEcosystem(e, root));
  emit(ok('deps-audit', { ecosystems: results }, []), opts.json, human);
  return 0;
}

function runEcosystem(e: Ecosystem, root: string): EcosystemResult {
  const empty = { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0 };
  const r = runTool(e.cmd, e.args, { cwd: root });
  if (!r.ok) {
    const reason = r.error === 'tool_not_found' ? 'auditor_missing' : (r.error ?? 'spawn_failed');
    return { ecosystem: e.name, advisories: [], summary: empty, error: reason };
  }
  // Auditors signal findings via a non-zero exit — parse stdout regardless.
  try {
    const advisories = e.adapter(r.stdout);
    return { ecosystem: e.name, advisories, summary: summarize(advisories) };
  } catch {
    return { ecosystem: e.name, advisories: [], summary: empty, error: 'unparseable_output' };
  }
}

function human(env: Envelope<any>): void {
  const ecos = env.data.ecosystems ?? [];
  if (ecos.length === 0) { console.log('deps-audit: no recognized lockfile.'); return; }
  for (const r of ecos as EcosystemResult[]) {
    if (r.error) { console.log(`${r.ecosystem}: ${r.error}`); continue; }
    const s = r.summary;
    console.log(`${r.ecosystem}: ${r.advisories.length} advisories (crit ${s.critical}, high ${s.high}, mod ${s.moderate}, low ${s.low})`);
    for (const a of r.advisories.slice(0, 20)) {
      console.log(`  [${a.severity}] ${a.package}  ${a.id}  ${a.patchedIn ? `→ ${a.patchedIn}` : 'no fix'}`);
    }
  }
}
