import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureInstalledArtifactSnapshot } from '../lib/benchmark/artifact-snapshot';
import { buildCanonicalHookFixtures, HOOK_EVENTS_IN_SETTINGS, type HookFixture } from '../lib/benchmark/hook-fixtures';
import { parseBenchmarkNdjson, stringifyBenchmarkNdjson } from '../lib/benchmark/ndjson';
import { toHookBenchmarkObservation } from '../lib/benchmark/hook-observation';
import { replayHookFixture } from '../lib/benchmark/hook-replay';
import { validateBenchmarkObservation } from '../lib/benchmark/schema';
import { installHookWrappers, wrapperFilename } from '../installer/providers/codex-hook-compat';

function tmp(prefix: string): string { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function envFor(homeDir: string): NodeJS.ProcessEnv {
  return { ...process.env, HOME: homeDir, USERPROFILE: homeDir, HL_CLAUDE_SETTINGS_DIR: path.join(homeDir, '.claude'), SECRET_CANARY: 'leakme' };
}
function snapshot(rootDir: string, relativePaths: string[]) { return captureInstalledArtifactSnapshot(rootDir, relativePaths); }
function installed(scriptRelativePath: string, stdin: string, expectsOutput: boolean, env?: Record<string, string>): HookFixture {
  return { id: scriptRelativePath, mode: 'codex-installed', eventName: 'fixture', scriptRelativePath, stdin, expectsOutput, env };
}
function writeScript(rootDir: string, name: string, source: string): string {
  fs.writeFileSync(path.join(rootDir, name), source, 'utf8');
  return name;
}
function copyInstalledSubagent() {
  const rootDir = tmp('benchmark-hooks-installed-');
  const hooksDir = path.join(rootDir, 'hooks');
  fs.cpSync(path.join(process.cwd(), 'kit', 'hooks'), hooksDir, { recursive: true });
  installHookWrappers(hooksDir);
  const wrapperPath = path.posix.join('hooks', wrapperFilename(path.join(hooksDir, 'haily-subagent.cjs')));
  return { rootDir, wrapperPath, snap: snapshot(rootDir, ['hooks/haily-subagent.cjs', wrapperPath]) };
}

test('fixture bank tracks every hook event declared in kit/settings.json', () => {
  const events = Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'kit', 'settings.json'), 'utf8')).hooks).sort();
  assert.deepEqual([...HOOK_EVENTS_IN_SETTINGS].sort(), events);
  assert.deepEqual([...new Set(buildCanonicalHookFixtures().map((fixture) => fixture.eventName))].sort(), events);
});

test('source hook replay covers every configured event with stable taxonomy', () => {
  const repoRoot = process.cwd();
  const cwd = tmp('benchmark-hooks-source-');
  for (const fixture of buildCanonicalHookFixtures()) {
    const result = replayHookFixture(fixture, { repoRoot, cwd, env: envFor(cwd) });
    assert.equal(result.outcome, fixture.expectedOutcome ?? 'emitted', fixture.id);
    assert.equal(result.stdoutBytes > 0, fixture.expectsOutput, fixture.id);
  }
});

test('codex wrapper replay preserves additionalContext only for allowlist events and adapts to V2', () => {
  const { rootDir, wrapperPath, snap } = copyInstalledSubagent();
  const allowFixture = installed(wrapperPath, JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: 'haily-researcher', agent_id: 'agent-1', session_id: 'sess-bench' }), true);
  const blockFixture = installed(wrapperPath, JSON.stringify({ hook_event_name: 'Stop', agent_type: 'haily-researcher', agent_id: 'agent-1', session_id: 'sess-bench' }), true);
  const allow = replayHookFixture(allowFixture, { repoRoot: process.cwd(), cwd: rootDir, env: envFor(rootDir), snapshot: snap, allowedInstallRoot: rootDir });
  const blocked = replayHookFixture(blockFixture, { repoRoot: process.cwd(), cwd: rootDir, env: envFor(rootDir), snapshot: snap, allowedInstallRoot: rootDir });
  const observation = toHookBenchmarkObservation(allow, allowFixture);
  assert.equal(allow.outcome, 'emitted');
  assert.ok(allow.additionalContextBytes > 0);
  assert.equal(blocked.additionalContextBytes, 0);
  assert.equal(((blocked.parsedOutput?.hookSpecificOutput as Record<string, unknown> | undefined)?.additionalContext), undefined);
  assert.equal(observation.source, 'hook');
  assert.equal(observation.decisionEligible, false);
  assert.match(((observation.providerExtensions.hookReplay as Record<string, unknown>).outputDigest as string), /^sha256:/);
  assert.equal((observation.providerExtensions as Record<string, unknown>).parsedOutput, undefined);
});

test('malformed input, timeout, crash, maxBuffer, and no-output paths classify distinctly', () => {
  const repoRoot = process.cwd();
  const cwd = tmp('benchmark-hooks-failures-');
  const malformed = replayHookFixture({ id: 'malformed-source', mode: 'claude-source', eventName: 'SubagentStart', scriptRelativePath: 'haily-subagent.cjs', stdin: 'not json', expectsOutput: true }, { repoRoot, cwd, env: envFor(cwd) });
  assert.equal(malformed.outcome, 'malformed_input_fail_open');
  const rootDir = tmp('benchmark-hooks-fixtures-');
  for (const name of ['no-output.cjs', 'crash.cjs', 'timeout.cjs']) fs.copyFileSync(path.join(process.cwd(), 'cli', 'tests', 'fixtures', 'benchmark', 'hooks', name), path.join(rootDir, name));
  writeScript(rootDir, 'big-output.cjs', `process.stdout.write(${JSON.stringify('x'.repeat(2048))});`);
  const snap = snapshot(rootDir, ['no-output.cjs', 'crash.cjs', 'timeout.cjs', 'big-output.cjs']);
  const opts = { repoRoot, cwd: rootDir, env: envFor(rootDir), snapshot: snap, allowedInstallRoot: rootDir };
  assert.equal(replayHookFixture(installed('no-output.cjs', '{}', true), opts).outcome, 'unexpected_no_output');
  assert.equal(replayHookFixture(installed('crash.cjs', '{}', true), opts).outcome, 'crash_fail_open');
  assert.equal(replayHookFixture(installed('timeout.cjs', '{}', true), { ...opts, timeoutMs: 50 }).outcome, 'timeout_fail_open');
  assert.equal(replayHookFixture(installed('big-output.cjs', '{}', true), { ...opts, maxBufferBytes: 64 }).outcome, 'crash_fail_open');
});

test('runner filters env and rejects swapped or linked install roots', () => {
  const repoRoot = process.cwd();
  const rootDir = tmp('benchmark-hooks-safe-');
  writeScript(rootDir, 'env.cjs', 'process.stdout.write(JSON.stringify({ secret: process.env.SECRET_CANARY ?? null, home: process.env.HOME ?? null }))');
  const snap = snapshot(rootDir, ['env.cjs']);
  const fixture = installed('env.cjs', '{}', true, { HOME: 'fixture-home' });
  const result = replayHookFixture(fixture, { repoRoot, cwd: rootDir, env: envFor(rootDir), snapshot: snap, allowedInstallRoot: rootDir });
  assert.equal((result.parsedOutput as Record<string, unknown>).secret, null);
  assert.equal((result.parsedOutput as Record<string, unknown>).home, 'fixture-home');
  assert.throws(() => replayHookFixture(fixture, { repoRoot, cwd: rootDir, env: envFor(rootDir), snapshot: snap, allowedInstallRoot: tmp('other-root-') }), /outside the allowed install root/);
  const realRoot = tmp('benchmark-hooks-real-');
  writeScript(realRoot, 'env.cjs', 'process.stdout.write("{}")');
  const linkRoot = tmp('benchmark-hooks-link-parent-');
  const linkPath = path.join(linkRoot, 'junction');
  try { fs.symlinkSync(realRoot, linkPath, 'junction'); } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'UNKNOWN') return;
    throw error;
  }
  assert.throws(
    () => replayHookFixture(installed('env.cjs', '{}', true), { repoRoot, cwd: linkPath, env: envFor(linkPath), snapshot: snapshot(linkPath, ['env.cjs']), allowedInstallRoot: linkPath }),
    /symlink or junction/,
  );
});

test('replay runner rejects metacharacter and traversal script paths before spawn', () => {
  const repoRoot = process.cwd();
  const snap = snapshot(tmp('benchmark-hooks-paths-'), []);
  assert.throws(() => replayHookFixture(installed('../escape.cjs', '{}', false), { repoRoot, cwd: repoRoot, env: envFor(repoRoot), snapshot: snap, allowedInstallRoot: repoRoot }), /unsafe script path/);
  assert.throws(() => replayHookFixture(installed('noop.cjs & whoami', '{}', false), { repoRoot, cwd: repoRoot, env: envFor(repoRoot), snapshot: snap, allowedInstallRoot: repoRoot }), /unsafe script path/);
});

test('hook observation adapter stays schema-valid for every replay outcome and NDJSON round-trips', () => {
  const outcomes = [
    'emitted',
    'intentional_skip',
    'malformed_input_fail_open',
    'timeout_fail_open',
    'crash_fail_open',
    'unexpected_no_output',
  ] as const;
  const observations = outcomes.map((outcome) => {
    const fixture = installed(`fixture-${outcome}.cjs`, '{}', outcome === 'emitted');
    const result = {
      fixtureId: fixture.id,
      mode: fixture.mode,
      eventName: 'Fixture',
      scriptLabel: fixture.scriptRelativePath,
      outcome,
      exitCode: outcome === 'crash_fail_open' ? 1 : 0,
      stdoutBytes: outcome === 'emitted' ? 10 : 0,
      stderrBytes: 0,
      additionalContextBytes: 0,
      wallMs: 12.5,
      parsedOutput: outcome === 'emitted' ? { ok: true } : null,
    };
    return validateBenchmarkObservation(toHookBenchmarkObservation(result, fixture));
  });
  const malformed = observations.find((entry) => {
    const replay = entry.providerExtensions.hookReplay as Record<string, unknown>;
    return replay.outcome === 'malformed_input_fail_open';
  });
  assert.equal(malformed?.status, 'incomplete');
  assert.equal(malformed?.statusClass, 'unmeasured');
  const roundTrip = parseBenchmarkNdjson(stringifyBenchmarkNdjson(observations));
  assert.equal(roundTrip.length, outcomes.length);
});
