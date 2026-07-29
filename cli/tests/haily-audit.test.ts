import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Spawn-based coverage for the tool-call activity log hook (
// kit/hooks/haily-audit.cjs). Mirrors the harness pattern in
// haily-access-loop-guard.test.ts: spawn the real .cjs so a wiring
// regression fails a test, not a silent pass. Redaction negative-space is a
// release gate — every secret pattern
// class must prove its value never reaches the log.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-audit.cjs');
const ROTATE_BYTES = 5 * 1024 * 1024; // mirrors haily-audit.cjs's ROTATE_BYTES (not exported)
const KEEP_ARCHIVES = 5; // mirrors haily-audit.cjs's KEEP_ARCHIVES (not exported)
const MAX_TARGET_LEN = 500; // mirrors haily-audit.cjs's MAX_TARGET_LEN (not exported)

interface HookResult { status: number; stdout: string; stderr: string }
interface AuditEntry {
  ts?: string;
  sessionId?: string;
  agentType?: string;
  tool?: string;
  target?: unknown;
  event?: string;
  [key: string]: unknown;
}

function tmpCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hl-audit-'));
}

/**
 * Spawns the real hook against a fresh cwd. Seeds a fresh haily-usage quota
 * cache under HL_USAGE_CACHE_PATH so the single-spawn quota-refresh subsumption
 * (haily-audit.cjs:183) never finds a stale/absent cache and attempts a real
 * network fetch during a test run — deterministic and CI-safe regardless of
 * whether the host machine has live Claude credentials.
 */
function runHook(input: string, cwd: string, env: NodeJS.ProcessEnv = {}): HookResult {
  const usageCachePath = path.join(cwd, '.usage-cache-test.json');
  fs.writeFileSync(usageCachePath, JSON.stringify({
    ts: Date.now(), eligible: false, note: 'test-fresh', fiveHour: null, week: null, resetsAt: null,
  }));
  const mergedEnv: NodeJS.ProcessEnv = { ...process.env };
  delete mergedEnv.HL_SESSION_ID;
  delete mergedEnv.HL_AGENT_TYPE;
  mergedEnv.HL_USAGE_CACHE_PATH = usageCachePath;
  Object.assign(mergedEnv, env);
  try {
    const stdout = execFileSync(process.execPath, [HOOK_PATH], {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: mergedEnv,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { status: err.status, stdout: err.stdout, stderr: err.stderr };
  }
}

function payload(toolName: string, toolInput: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ tool_name: toolName, tool_input: toolInput, ...extra });
}

function auditPath(cwd: string): string {
  return path.join(cwd, '.logs', 'audit.jsonl');
}

/**
 * Reader contract for the NDJSON log: one JSON.parse-able line per entry, but
 * a crash mid-write (no fsync) can leave a torn trailing line — any consumer
 * must skip it rather than throw. No dedicated reader ships yet (the
 * hook is write-only); this helper is the contract every future consumer
 * (and every other assertion below) relies on.
 */
function readAuditLines(cwd: string): AuditEntry[] {
  const p = auditPath(cwd);
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.length > 0);
  const out: AuditEntry[] = [];
  for (const line of lines) {
    try { out.push(JSON.parse(line) as AuditEntry); } catch { /* torn/truncated line — skip, per NDJSON contract */ }
  }
  return out;
}

function dateStampPrefix(): string {
  return new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD, mirrors haily-audit.cjs
}

// ── Target extraction ─────────────────────────────────────────────────────

test('target extraction: Edit/Write/Read use file_path, tool recorded, exits 0', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(payload('Write', { file_path: 'notes.md' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.equal(entry.tool, 'Write');
  assert.equal(entry.target, 'notes.md');
});

test('target extraction: NotebookEdit uses notebook_path', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(payload('NotebookEdit', { notebook_path: 'analysis.ipynb', new_source: 'x' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.equal(entry.target, 'analysis.ipynb');
});

test('target extraction: sensitive path is masked via classifyPath, not logged raw', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(payload('Read', { file_path: '.env' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.ok(typeof entry.target === 'string' && (entry.target as string).startsWith('<sensitive:'), 'target masked as <sensitive:...>');
  assert.ok(!JSON.stringify(entry).includes('".env"'), 'raw .env path never appears verbatim');
});

test('target extraction: Task/Agent use subagent_type', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(payload('Task', { subagent_type: 'haily-reviewer' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.equal(entry.target, 'haily-reviewer');
});

test('target extraction: Grep/Glob use pattern', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(payload('Grep', { pattern: 'TODO' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.equal(entry.target, 'TODO');
});

test('target extraction: Grep pattern carrying a secret-shaped token is redacted like a Bash command', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const secret = 'AKIAABCDEFGHIJKLMNOP';
  const result = runHook(payload('Grep', { pattern: secret }), cwd);
  assert.equal(result.status, 0);
  const raw = fs.readFileSync(auditPath(cwd), 'utf8');
  assert.ok(!raw.includes(secret), 'secret-shaped Grep pattern must not reach the log verbatim');
  assert.ok(raw.includes('***'), 'redaction marker present for Grep pattern');
});

test('target extraction: benign Grep pattern passes through unmasked (no false-positive over-redaction)', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(payload('Grep', { pattern: 'function\\s+handleSubmit' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.equal(entry.target, 'function\\s+handleSubmit', 'benign pattern logged unchanged');
});

test('sessionId: payload session_id is short-attributed onto the log line', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(payload('Read', { file_path: 'x.txt' }, { session_id: 'abcdefgh12345' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.equal(entry.sessionId, 'abcdefgh', 'sessionId sliced to 8 chars');
});

// ── Redaction negative-space (release gate) — one case per pattern class ──

const REDACTION_CASES: Array<{ label: string; command: string; secret: string }> = [
  {
    label: 'connection-string creds',
    command: 'psql "postgres://dbuser:Sup3rSecretPW@db.example.com:5432/mydb"',
    secret: 'Sup3rSecretPW',
  },
  {
    label: 'curl basic-auth (-u user:pass)',
    command: 'curl -u admin:Str0ngPass123 https://api.example.com/v1',
    secret: 'Str0ngPass123',
  },
  {
    label: 'Authorization header value',
    command: 'curl -H "Authorization: Bearer abcXYZ789tokenvalue" https://api.example.com',
    secret: 'abcXYZ789tokenvalue',
  },
  {
    label: 'X-Api-Key header value',
    command: 'curl -H "X-Api-Key: AbCdEf123456ZzZ" https://api.example.com',
    secret: 'AbCdEf123456ZzZ',
  },
  {
    label: 'known token prefix (AKIA)',
    command: 'aws configure set aws_access_key_id AKIAABCDEFGHIJKLMNOP',
    secret: 'AKIAABCDEFGHIJKLMNOP',
  },
  {
    label: 'known token prefix (ghp_)',
    command: 'echo ghp_1234567890ABCDEFabcdefghij',
    secret: 'ghp_1234567890ABCDEFabcdefghij',
  },
  {
    label: 'env assignment (KEY/TOKEN/SECRET/PASSWORD=)',
    command: 'export DB_PASSWORD=SuperSecretValue123 && start-server',
    secret: 'SuperSecretValue123',
  },
  {
    label: 'explicit --password= flag',
    command: 'mytool --password=Tr0ub4dorAndThree --run',
    secret: 'Tr0ub4dorAndThree',
  },
  {
    label: 'explicit --token= flag (equals form)',
    command: 'mytool --token=abc123XYZ --run',
    secret: 'abc123XYZ',
  },
  {
    label: 'explicit --token flag (space-separated form)',
    command: 'mytool --token abc123XYZ --run',
    secret: 'abc123XYZ',
  },
  {
    label: 'query-string credential (?token=, lowercase)',
    command: 'curl "https://api.example.com/data?token=SECRET123"',
    secret: 'SECRET123',
  },
  {
    label: 'query-string credential (&apikey=, mixed case)',
    command: 'curl "https://api.example.com/data?foo=bar&apikey=abcDEF456"',
    secret: 'abcDEF456',
  },
  {
    label: 'high-entropy long hex run (>=32)',
    command: 'git show abcdef0123456789abcdef0123456789',
    secret: 'abcdef0123456789abcdef0123456789',
  },
  {
    label: 'high-entropy long base64-looking run (>=40)',
    command: 'echo QWxhZGRpbjpvcGVuIHNlc2FtZUZvclRlc3RpbmdPbmx5',
    secret: 'QWxhZGRpbjpvcGVuIHNlc2FtZUZvclRlc3RpbmdPbmx5',
  },
];

for (const { label, command, secret } of REDACTION_CASES) {
  test(`redaction negative-space (release gate): ${label}`, (t) => {
    const cwd = tmpCwd();
    t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
    const result = runHook(payload('Bash', { command }), cwd);
    assert.equal(result.status, 0);
    const raw = fs.readFileSync(auditPath(cwd), 'utf8');
    assert.ok(!raw.includes(secret), `secret substring must not reach the log: ${label}`);
    assert.ok(raw.includes('***'), `redaction marker must be present: ${label}`);
  });
}

// ── Length cap (all target fields, not just Bash) ─────────────────────────

test('length cap: oversized file_path is truncated in the logged line', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const oversizedPath = 'a/'.repeat(300) + 'file.ts'; // well over MAX_TARGET_LEN
  const result = runHook(payload('Read', { file_path: oversizedPath }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.ok(typeof entry.target === 'string', 'target is a string');
  const target = entry.target as string;
  assert.ok(target.length < oversizedPath.length, 'oversized file_path is shortened');
  assert.ok(target.endsWith('...(truncated)'), 'truncation marker present');
  assert.ok(target.length <= MAX_TARGET_LEN + '...(truncated)'.length, 'truncated target respects the cap plus marker');
});

test('length cap: oversized Grep pattern is truncated in the logged line', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  // Hyphen-separated segments (not a contiguous secret-shaped run) so this
  // exercises only the length cap, not the redaction rules.
  const oversizedPattern = 'abc-'.repeat(Math.ceil((MAX_TARGET_LEN + 200) / 4));
  const result = runHook(payload('Grep', { pattern: oversizedPattern }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  const target = entry.target as string;
  assert.ok(target.length < oversizedPattern.length, 'oversized pattern is shortened');
  assert.ok(target.endsWith('...(truncated)'), 'truncation marker present');
});

// ── Serialization (anti-forging) ──────────────────────────────────────────

test('serialization: control chars (\\n, ") in command yield exactly one JSON.parse-able line', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const command = 'printf "line one\nline two with a "quote" inside"';
  const result = runHook(payload('Bash', { command }), cwd);
  assert.equal(result.status, 0);
  const raw = fs.readFileSync(auditPath(cwd), 'utf8');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  assert.equal(lines.length, 1, 'embedded control chars must not fragment the NDJSON line');
  const entry = JSON.parse(lines[0]) as AuditEntry;
  assert.equal(entry.target, command, 'round-trips the original string including \\n and "');
});

// ── .gitignore enforcement ──────────────────────────────────────────────────

test('.gitignore enforcement: no .gitignore in cwd → hook creates one covering .logs/', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const gitignorePath = path.join(cwd, '.gitignore');
  assert.equal(fs.existsSync(gitignorePath), false, 'no .gitignore before the hook runs');

  const result = runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  assert.equal(result.status, 0);

  assert.equal(fs.existsSync(gitignorePath), true, '.gitignore created');
  const content = fs.readFileSync(gitignorePath, 'utf8');
  assert.ok(/^\s*\/?\.logs\/?\s*$/m.test(content), '.gitignore contains a .logs/-matching line');
});

test('.gitignore enforcement: existing .gitignore missing the entry gets it appended, prior content preserved', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const gitignorePath = path.join(cwd, '.gitignore');
  fs.writeFileSync(gitignorePath, 'node_modules/\ndist/\n');

  const result = runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  assert.equal(result.status, 0);

  const content = fs.readFileSync(gitignorePath, 'utf8');
  assert.ok(content.includes('node_modules/'), 'prior entry preserved');
  assert.ok(content.includes('dist/'), 'prior entry preserved');
  assert.ok(/^\s*\/?\.logs\/?\s*$/m.test(content), '.logs/ entry appended');
});

test('.gitignore enforcement: entry already covered → file left byte-for-byte unchanged', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const gitignorePath = path.join(cwd, '.gitignore');
  const original = 'node_modules/\n.logs/\n';
  fs.writeFileSync(gitignorePath, original);

  const result = runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  assert.equal(result.status, 0);

  const content = fs.readFileSync(gitignorePath, 'utf8');
  assert.equal(content, original, 'no rewrite when the .logs/ entry already covers it');
});

// ── Rotation ───────────────────────────────────────────────────────────────

test('rotation: seeding a live file just over the byte cap rotates it on one call (archive created, live reset)', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const logDir = path.join(cwd, '.logs');
  fs.mkdirSync(logDir, { recursive: true });
  const oversized = 'x'.repeat(ROTATE_BYTES + 1024) + '\n';
  fs.writeFileSync(auditPath(cwd), oversized);

  const result = runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  assert.equal(result.status, 0);

  const archivePath = path.join(logDir, `audit-${dateStampPrefix()}-001.jsonl`);
  assert.equal(fs.existsSync(archivePath), true, 'zero-padded archive file created (not truncated in place)');
  assert.equal(fs.readFileSync(archivePath, 'utf8'), oversized, 'archive holds the exact pre-rotation content');

  const liveEntries = readAuditLines(cwd);
  assert.equal(liveEntries.length, 1, 'live file reset to just the new entry');
  assert.ok(fs.statSync(auditPath(cwd)).size < ROTATE_BYTES, 'live file is small again after rotation');
});

test('rotation keep-count: seeding keep-count+1 archives prunes the numerically-oldest, keeps the newest', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const logDir = path.join(cwd, '.logs');
  fs.mkdirSync(logDir, { recursive: true });
  const prefix = dateStampPrefix();

  // Seed KEEP_ARCHIVES + 1 = 6 pre-existing archives (numerically 001..006).
  for (let i = 1; i <= KEEP_ARCHIVES + 1; i++) {
    const idx = String(i).padStart(3, '0');
    fs.writeFileSync(path.join(logDir, `audit-${prefix}-${idx}.jsonl`), `{"seed":${i}}\n`);
  }
  fs.writeFileSync(auditPath(cwd), 'x'.repeat(ROTATE_BYTES + 1024) + '\n');

  const result = runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  assert.equal(result.status, 0);

  // This call's rotation creates archive 007 (max existing index 006 + 1),
  // bringing the total to 7; pruning must keep only the newest 5 (003..007).
  const archives = fs.readdirSync(logDir).filter((f) => /^audit-\d{6}-\d{3}\.jsonl$/.test(f)).sort();
  assert.equal(archives.length, KEEP_ARCHIVES, 'exactly keep-count archives remain');
  assert.equal(archives[0], `audit-${prefix}-003.jsonl`, 'numerically-oldest archives (001, 002) pruned');
  assert.equal(archives[archives.length - 1], `audit-${prefix}-007.jsonl`, 'newest archive (just rotated) kept');
});

// ── Fail-open ──────────────────────────────────────────────────────────────

test('fail-open: malformed stdin never throws, always exits 0', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook('not-json', cwd);
  assert.equal(result.status, 0);
});

test('fail-open: empty stdin never throws, always exits 0', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook('', cwd);
  assert.equal(result.status, 0);
});

// ── SessionEnd ─────────────────────────────────────────────────────────────

test('SessionEnd: writes a closure line with the event marker and sessionId', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = runHook(JSON.stringify({ hook_event_name: 'SessionEnd', session_id: 'abc' }), cwd);
  assert.equal(result.status, 0);
  const [entry] = readAuditLines(cwd);
  assert.equal(entry.event, 'session-end');
  assert.equal(entry.sessionId, 'abc');
});

// ── Disabled ─────────────────────────────────────────────────────────────

test('disabled: local .claude/haily.json hooks["audit-trail"]=false suppresses the log entirely', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.claude', 'haily.json'), JSON.stringify({ hooks: { 'audit-trail': false } }));

  const result = runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(auditPath(cwd)), false, 'no audit.jsonl written when disabled');
});

// ── Reader contract ────────────────────────────────────────────────────────

test('reader contract: a torn trailing line is skipped, prior valid entries still parse', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  runHook(payload('Edit', { file_path: 'b.ts' }), cwd);
  assert.equal(readAuditLines(cwd).length, 2, 'two valid entries before corruption');

  // Simulate a crash mid-write (no fsync) leaving a torn trailing line.
  fs.appendFileSync(auditPath(cwd), '{"ts":"2026-01-01T00:00:00.000Z","tool":"Edit","targ');

  const entries = readAuditLines(cwd);
  assert.equal(entries.length, 2, 'torn trailing line skipped, not thrown');
  assert.equal(entries[0].target, 'a.ts');
  assert.equal(entries[1].target, 'b.ts');
});

// ── Lock ────────────────────────────────────────────────────────────────────

test('lock: released in finally — sequential invocations both write, no stale lock file left behind', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const r1 = runHook(payload('Edit', { file_path: 'a.ts' }), cwd);
  const r2 = runHook(payload('Edit', { file_path: 'b.ts' }), cwd);
  assert.equal(r1.status, 0);
  assert.equal(r2.status, 0);
  assert.equal(readAuditLines(cwd).length, 2, 'both invocations wrote their line — lock released between calls');
  assert.equal(fs.existsSync(auditPath(cwd) + '.lock'), false, 'lock file cleaned up (try/finally release)');
});

// ── Timing ───────────────────────────────────────────────────────────────────

test('timing: median hook invocation (no rotation) stays within a generous CI-safe bound', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const N = 11;
  const durations: number[] = [];
  for (let i = 0; i < N; i++) {
    const start = Date.now();
    const result = runHook(payload('Edit', { file_path: `file-${i}.ts` }), cwd);
    durations.push(Date.now() - start);
    assert.equal(result.status, 0);
  }
  durations.sort((a, b) => a - b);
  const median = durations[Math.floor(N / 2)];
  // Generous bound: cold Node spawn cost dominates, not hook logic — loose
  // enough to avoid CI flake on slow/Windows runners.
  assert.ok(median < 3000, `median hook invocation ${median}ms exceeds the generous 3000ms bound`);
});
