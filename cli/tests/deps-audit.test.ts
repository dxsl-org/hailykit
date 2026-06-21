import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseNpm, parsePip, parseCargo, parseGo } from '../commands/deps/adapters';
import { cmdDepsAudit } from '../commands/deps/audit';

// Captured fixture outputs — CI parses these without needing real auditors.

test('parseNpm: normalizes v7 schema (non-zero-exit JSON still parses)', () => {
  const stdout = JSON.stringify({
    vulnerabilities: {
      lodash: {
        name: 'lodash', severity: 'high', isDirect: true, range: '<4.17.21',
        via: [{ url: 'https://github.com/advisories/GHSA-x', source: 123 }],
        fixAvailable: { name: 'lodash', version: '4.17.21' },
      },
    },
    metadata: { vulnerabilities: { high: 1, total: 1 } },
  });
  const [a] = parseNpm(stdout);
  assert.equal(a.package, 'lodash');
  assert.equal(a.severity, 'high');
  assert.equal(a.patchedIn, 'lodash@4.17.21');
  assert.equal(a.direct, true);
  assert.equal(a.id, 'https://github.com/advisories/GHSA-x');
});

test('parsePip: normalizes dependency vulns', () => {
  const stdout = JSON.stringify({ dependencies: [{ name: 'flask', version: '0.12', vulns: [{ id: 'PYSEC-1', fix_versions: ['1.0'] }] }] });
  const [a] = parsePip(stdout);
  assert.equal(a.package, 'flask');
  assert.equal(a.id, 'PYSEC-1');
  assert.equal(a.patchedIn, '1.0');
});

test('parseCargo: derives severity from CVSS', () => {
  const stdout = JSON.stringify({ vulnerabilities: { list: [{ advisory: { id: 'RUSTSEC-1', cvss: 9.1 }, package: { name: 'foo', version: '0.1.0' }, versions: { patched: ['>=0.2.0'] } }] } });
  const [a] = parseCargo(stdout);
  assert.equal(a.id, 'RUSTSEC-1');
  assert.equal(a.severity, 'critical');
  assert.equal(a.patchedIn, '>=0.2.0');
});

test('parseGo: collects OSV findings from the JSON stream', () => {
  const stdout = '{"config":{"x":1}}\n{"osv":{"id":"GO-2023-1","affected":[{"package":{"name":"golang.org/x/net"}}],"database_specific":{"severity":"HIGH"}}}\n{"finding":{"osv":"GO-2023-1"}}';
  const advs = parseGo(stdout);
  assert.equal(advs.length, 1);
  assert.equal(advs[0].id, 'GO-2023-1');
  assert.equal(advs[0].package, 'golang.org/x/net');
  assert.equal(advs[0].severity, 'high');
});

test('deps-audit: no recognized lockfile exits 0 with empty result', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-deps-none-'));
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  let code: number;
  try { code = cmdDepsAudit({ path: dir, json: true }); } finally { console.log = orig; fs.rmSync(dir, { recursive: true, force: true }); }
  const env = JSON.parse(lines.join('\n'));
  assert.equal(code, 0);
  assert.equal(env.ok, true);
  assert.deepEqual(env.data.ecosystems, []);
});
