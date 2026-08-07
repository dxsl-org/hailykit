import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { sha256 } from '../reasoning-harness/hash';
import type { InstalledArtifactSnapshot } from './types';
import type { HookFixture, HookReplayOutcome } from './hook-fixtures';

const SAFE_ENV_KEYS = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'PATH', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'TMP', 'TEMP', 'TMPDIR', 'LANG', 'TZ', 'USER', 'USERNAME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HL_CLAUDE_SETTINGS_DIR', 'HL_SESSION_ID', 'HL_ACTIVE_PLAN', 'HL_MODEL_TIER', 'SUBAGENT_DEBUG', 'CLAUDE_ENV_FILE'] as const;

export interface HookReplayOptions {
  repoRoot: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  snapshot?: InstalledArtifactSnapshot;
  allowedInstallRoot?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export interface HookReplayResult {
  fixtureId: string;
  mode: HookFixture['mode'];
  eventName: string;
  scriptLabel: string;
  outcome: HookReplayOutcome;
  exitCode: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  additionalContextBytes: number;
  wallMs: number;
  parsedOutput: Record<string, unknown> | null;
}

export function replayHookFixture(fixture: HookFixture, options: HookReplayOptions): HookReplayResult {
  const script = resolveScriptPath(fixture, options);
  const started = process.hrtime.bigint();
  const exec = spawnSync(process.execPath, [script.absolutePath], {
    cwd: options.cwd ?? script.cwd,
    env: buildChildEnv(options.env ?? process.env, fixture.env),
    input: fixture.stdin,
    encoding: 'utf8',
    shell: false,
    timeout: options.timeoutMs ?? 5000,
    maxBuffer: options.maxBufferBytes ?? 1024 * 1024,
  });
  const stdout = exec.stdout ?? '';
  const parsedOutput = parseJson(stdout);
  return {
    fixtureId: fixture.id,
    mode: fixture.mode,
    eventName: fixture.eventName,
    scriptLabel: script.scriptLabel,
    outcome: classifyOutcome(fixture, exec.status, stdout, exec.error),
    exitCode: typeof exec.status === 'number' ? exec.status : null,
    stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
    stderrBytes: Buffer.byteLength(exec.stderr ?? '', 'utf8'),
    additionalContextBytes: additionalContextBytes(parsedOutput),
    wallMs: Number(process.hrtime.bigint() - started) / 1_000_000,
    parsedOutput,
  };
}

function resolveScriptPath(fixture: HookFixture, options: HookReplayOptions) {
  const relative = normalizeRelativeScriptPath(fixture.scriptRelativePath);
  if (fixture.mode === 'claude-source') {
    const hooksRoot = path.resolve(options.repoRoot, 'kit', 'hooks');
    return { absolutePath: resolveContainedPath(hooksRoot, relative), scriptLabel: `kit/hooks/${relative}`, cwd: options.repoRoot };
  }
  if (!options.snapshot || !options.allowedInstallRoot) throw new Error(`snapshot and allowedInstallRoot required for ${fixture.id}`);
  const entry = options.snapshot.entries.find((candidate) => candidate.path === relative);
  if (!entry) throw new Error(`snapshot entry missing for ${relative}`);
  const snapshotRoot = validateInstallRoot(options.snapshot.rootDir, options.allowedInstallRoot);
  const absolutePath = resolveContainedPath(snapshotRoot, relative);
  assertTrustedSnapshotFile(snapshotRoot, relative, entry.sha256, entry.bytes);
  return { absolutePath, scriptLabel: relative, cwd: snapshotRoot };
}

function buildChildEnv(source: NodeJS.ProcessEnv, fixtureEnv: Record<string, string> | undefined): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const key of SAFE_ENV_KEYS) if (source[key]) child[key] = source[key];
  for (const [key, value] of Object.entries(fixtureEnv ?? {})) {
    if (!SAFE_ENV_KEYS.includes(key as typeof SAFE_ENV_KEYS[number])) throw new Error(`unsafe env key: ${key}`);
    child[key] = value;
  }
  return child;
}

function normalizeRelativeScriptPath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  if (!/^[A-Za-z0-9._/-]+\.cjs$/.test(normalized)) throw new Error(`unsafe script path: ${value}`);
  if (normalized.includes('../') || normalized.startsWith('/')) throw new Error(`unsafe script path: ${value}`);
  return normalized;
}

function validateInstallRoot(snapshotRoot: string, allowedInstallRoot: string): string {
  const resolvedSnapshot = path.resolve(snapshotRoot);
  const resolvedAllowed = path.resolve(allowedInstallRoot);
  const realSnapshot = fs.realpathSync.native(resolvedSnapshot);
  const realAllowed = fs.realpathSync.native(resolvedAllowed);
  const rel = path.relative(realAllowed, realSnapshot);
  if (resolvedSnapshot !== realSnapshot) throw new Error('snapshot root must not be a symlink or junction');
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('snapshot root is outside the allowed install root');
  return realSnapshot;
}

function assertTrustedSnapshotFile(rootDir: string, relativePath: string, expectedHash: string, expectedBytes: number): void {
  const absolutePath = resolveContainedPath(rootDir, relativePath);
  assertNoLinks(rootDir, relativePath);
  const realFile = fs.realpathSync.native(absolutePath);
  const rel = path.relative(rootDir, realFile);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`snapshot file escapes root: ${relativePath}`);
  const text = fs.readFileSync(realFile, 'utf8');
  if (Buffer.byteLength(text, 'utf8') !== expectedBytes || sha256(text) !== expectedHash) throw new Error(`snapshot file drifted: ${relativePath}`);
}

function assertNoLinks(rootDir: string, relativePath: string): void {
  let current = rootDir;
  for (const part of relativePath.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`snapshot path contains a symlink or junction: ${relativePath}`);
  }
}

function resolveContainedPath(rootDir: string, relativePath: string): string {
  const resolved = path.resolve(rootDir, relativePath);
  const rel = path.relative(rootDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`path escapes root: ${relativePath}`);
  return resolved;
}

function classifyOutcome(fixture: HookFixture, status: number | null, stdout: string, error: Error | undefined): HookReplayOutcome {
  if ((error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT') return 'timeout_fail_open';
  if (error) return 'crash_fail_open';
  if (typeof status === 'number' && status !== 0) return 'crash_fail_open';
  if (stdout.trim()) return 'emitted';
  if (!fixture.expectsOutput) return 'intentional_skip';
  return fixture.stdin.trim().startsWith('{') ? 'unexpected_no_output' : 'malformed_input_fail_open';
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function additionalContextBytes(parsedOutput: Record<string, unknown> | null): number {
  const context = (parsedOutput?.hookSpecificOutput as Record<string, unknown> | undefined)?.additionalContext;
  return typeof context === 'string' ? Buffer.byteLength(context, 'utf8') : 0;
}
