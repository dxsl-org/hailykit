import fs from 'node:fs';
import path from 'node:path';
import { listFiles, readText } from '../lib/fs-scan';
import { emit, ok, type Envelope } from '../lib/json-output';
import { SECRET_PATTERNS } from './scan/patterns-secrets';

/**
 * `pack` — concatenate a repo's text files into one AI-consumable blob with a
 * token estimate. A zero-dep subset of repomix (no remote repos, compression,
 * or alternate formats — use repomix for those).
 *
 * Default-DENY for secrets (security): gitignore-aware walk PLUS an explicit
 * credential-file denylist PLUS a content secret-scan — any file that looks
 * like or contains a secret is excluded and reported, so credentials never get
 * bundled into LLM context.
 */

export interface PackOptions { path: string; exclude?: string[]; json: boolean; }

interface PackData { content: string; files: string[]; excluded: Array<{ file: string; reason: string }>; tokenEst: number; }

const DENY_FILE = /(^|\/)\.env(\.|$)|\.(pem|key|p12|pfx|keystore|jks|ppk)$|(^|\/)id_(rsa|dsa|ecdsa|ed25519)$|(^|\/)\.npmrc$|(^|\/)\.netrc$/i;

export function cmdPack(opts: PackOptions): number {
  const root = path.resolve(opts.path);
  if (!fs.existsSync(root)) { console.error(`✗ Not found: ${opts.path}`); return 1; }

  const { files, warnings } = listFiles(root, { exclude: opts.exclude, respectGitignore: true });
  const parts: string[] = [];
  const included: string[] = [];
  const excluded: Array<{ file: string; reason: string }> = [];

  for (const f of files) {
    if (DENY_FILE.test(f.path)) { excluded.push({ file: f.path, reason: 'credential-file denylist' }); continue; }
    const { text, warning } = readText(f.abs, f.bytes + 1);
    if (text === null) { if (warning) warnings.push(warning); continue; }
    if (containsSecret(text)) { excluded.push({ file: f.path, reason: 'secret pattern match' }); continue; }
    parts.push(`=== ${f.path} ===\n${text}`);
    included.push(f.path);
  }

  const content = parts.join('\n\n');
  const tokenEst = Math.ceil(content.length / 4);
  emit(ok('pack', { content, files: included, excluded, tokenEst }, warnings), opts.json, human);
  return 0;
}

/** Conservative: any line matching a credential pattern excludes the whole file. */
function containsSecret(text: string): boolean {
  for (const line of text.split('\n')) {
    if (line.length > 4096) continue;
    for (const p of SECRET_PATTERNS) if (p.re.test(line)) return true;
  }
  return false;
}

function human(env: Envelope<PackData>): void {
  const d = env.data;
  // Human mode prints the packed content, then a footer summary to stderr-like tail.
  console.log(d.content);
  console.log(`\n=== pack summary: ${d.files.length} files, ~${d.tokenEst} tokens, ${d.excluded.length} excluded ===`);
  for (const e of d.excluded) console.log(`  excluded ${e.file} (${e.reason})`);
  for (const w of env.warnings ?? []) console.log(`! ${w}`);
}
