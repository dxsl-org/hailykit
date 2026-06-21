import fs from 'node:fs';
import path from 'node:path';
import { emit, ok, type Envelope } from '../lib/json-output';

/**
 * `adr-next` — compute the next ADR number and filename by scanning a decisions
 * directory. Empty dir → 0001. Follows the existing numbering scheme (bare
 * `NNNN-` or `ADR-NNNN-`); warns on a mixed scheme. Slug is sanitized for
 * cross-platform filenames (Windows-reserved chars stripped).
 */

export interface AdrNextOptions { dir: string; slug: string; json: boolean; }

interface AdrNextData { next: number; padded: string; filename: string; scheme: string; existing: number; }

const ADR_RE = /^(adr-)?(\d+)[-_]/i;

export function cmdAdrNext(opts: AdrNextOptions): number {
  const dir = path.resolve(opts.dir);
  const warnings: string[] = [];

  let max = 0, count = 0, prefixed = 0, bare = 0, width = 4;
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      const m = ADR_RE.exec(name);
      if (!m) continue;
      count++;
      if (m[1]) prefixed++; else bare++;
      width = Math.max(width, m[2].length);
      const n = Number.parseInt(m[2], 10);
      if (n > max) max = n;
    }
  }
  if (prefixed > 0 && bare > 0) warnings.push('mixed ADR numbering scheme detected — normalize for consistency');

  const scheme = prefixed >= bare && prefixed > 0 ? 'ADR-' : '';
  const next = max + 1;
  const padded = String(next).padStart(width, '0');
  const slug = slugify(opts.slug);
  const filename = `${scheme}${padded}${slug ? '-' + slug : ''}.md`;

  emit(ok('adr-next', { next, padded, filename, scheme: scheme || 'bare', existing: count }, warnings), opts.json, human);
  return 0;
}

/** Lowercase, ASCII-only kebab; strips Windows-reserved chars (: ? * < > | " / \\). */
function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function human(env: Envelope<AdrNextData>): void {
  const d = env.data;
  console.log(d.filename);
  for (const w of env.warnings ?? []) console.log(`! ${w}`);
}
