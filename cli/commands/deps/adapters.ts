import { normalizeSeverity, type Advisory } from './types';

/**
 * Pure parsers: vendor auditor stdout (JSON text) → common Advisory[]. No I/O,
 * so they are unit-tested against captured fixtures (CI needs no real auditors).
 * Each tolerates a non-zero exit that still produced valid JSON (npm audit exits
 * 1 when vulns exist) — the caller passes stdout regardless of exit code.
 */

export type Adapter = (stdout: string) => Advisory[];

/** npm audit --json (npm v7+ schema). */
export const parseNpm: Adapter = (stdout) => {
  const j = JSON.parse(stdout);
  const out: Advisory[] = [];
  const vulns = j.vulnerabilities ?? {};
  for (const [name, v] of Object.entries<any>(vulns)) {
    const fix = v.fixAvailable;
    out.push({
      package: name,
      severity: normalizeSeverity(v.severity),
      id: firstViaId(v.via) ?? name,
      vulnerableRange: typeof v.range === 'string' ? v.range : null,
      patchedIn: fix && typeof fix === 'object' ? `${fix.name}@${fix.version}` : (fix === true ? 'available' : null),
      direct: v.isDirect === true,
    });
  }
  return out;
};

function firstViaId(via: unknown): string | null {
  if (!Array.isArray(via)) return null;
  for (const item of via) if (item && typeof item === 'object' && (item.url || item.source)) return String(item.url ?? item.source);
  return null;
}

/** pip-audit -f json ({ dependencies: [{ name, version, vulns: [{id, fix_versions}] }] }). */
export const parsePip: Adapter = (stdout) => {
  const j = JSON.parse(stdout);
  const deps = Array.isArray(j) ? j : (j.dependencies ?? []);
  const out: Advisory[] = [];
  for (const d of deps) {
    for (const v of d.vulns ?? []) {
      out.push({
        package: d.name,
        severity: normalizeSeverity(v.severity ?? v.aliases?.[0]?.severity),
        id: v.id ?? (v.aliases?.[0] ?? 'unknown'),
        vulnerableRange: d.version ? `==${d.version}` : null,
        patchedIn: Array.isArray(v.fix_versions) && v.fix_versions.length ? v.fix_versions.join(', ') : null,
        direct: true,
      });
    }
  }
  return out;
};

/** cargo audit --json ({ vulnerabilities: { list: [{ advisory, package, versions }] } }). */
export const parseCargo: Adapter = (stdout) => {
  const j = JSON.parse(stdout);
  const list = j.vulnerabilities?.list ?? [];
  return list.map((entry: any) => ({
    package: entry.package?.name ?? 'unknown',
    severity: normalizeSeverity(entry.advisory?.severity ?? cvssToSeverity(entry.advisory?.cvss)),
    id: entry.advisory?.id ?? 'unknown',
    vulnerableRange: entry.package?.version ? `=${entry.package.version}` : null,
    patchedIn: Array.isArray(entry.versions?.patched) && entry.versions.patched.length ? entry.versions.patched.join(', ') : null,
    direct: true,
  }));
};

function cvssToSeverity(cvss: number | undefined): string {
  if (typeof cvss !== 'number') return 'unknown';
  if (cvss >= 9) return 'critical';
  if (cvss >= 7) return 'high';
  if (cvss >= 4) return 'moderate';
  return 'low';
}

/** govulncheck -json (stream of JSON objects; collect OSV findings). */
export const parseGo: Adapter = (stdout) => {
  const seen = new Map<string, Advisory>();
  for (const obj of streamJson(stdout)) {
    const osv = obj.osv;
    if (osv?.id) {
      const aff = osv.affected?.[0];
      seen.set(osv.id, {
        package: aff?.package?.name ?? osv.id,
        severity: normalizeSeverity(osv.database_specific?.severity),
        id: osv.id,
        vulnerableRange: null,
        patchedIn: null,
        direct: true,
      });
    }
  }
  return [...seen.values()];
};

/** Parse a stream of concatenated/whitespace-separated JSON objects. */
function streamJson(raw: string): any[] {
  const objs: any[] = [];
  let depth = 0, start = -1;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') { depth--; if (depth === 0 && start >= 0) { try { objs.push(JSON.parse(raw.slice(start, i + 1))); } catch { /* skip */ } start = -1; } }
  }
  return objs;
}
