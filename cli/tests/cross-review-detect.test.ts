import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLegs, type DetectDeps } from '../lib/cross-review/detect';

function deps(overrides: Partial<DetectDeps> = {}): DetectDeps {
  return {
    hasExecutable: () => true,
    env: {},
    homeDir: '/home/test',
    exists: () => false,
    ollamaReachable: () => false,
    ...overrides,
  };
}

test('a leg needs both an executable and auth readiness', () => {
  // gemini executable present but no key and no creds file → not ready.
  const out = detectLegs(deps({ hasExecutable: (b) => b === 'gemini' }));
  assert.deepEqual(out, []);
});

test('gemini becomes eligible with an API key', () => {
  const out = detectLegs(deps({
    hasExecutable: (b) => b === 'gemini',
    env: { GEMINI_API_KEY: 'x' },
  }));
  assert.deepEqual(out, ['gemini']);
});

test('ordering follows the ladder; gateways accept any provider key', () => {
  // OPENAI_API_KEY satisfies codex AND the gateways (opencode/cline accept any
  // provider key); ollama still needs its daemon, so it stays out.
  const out = detectLegs(deps({
    hasExecutable: () => true,
    env: { OPENAI_API_KEY: 'x', GEMINI_API_KEY: 'y' },
  }));
  assert.deepEqual(out, ['codex', 'gemini', 'opencode', 'cline']);
});

test('ollama eligible only when the daemon is reachable', () => {
  const down = detectLegs(deps({ hasExecutable: (b) => b === 'ollama' }));
  assert.deepEqual(down, []);
  const up = detectLegs(deps({ hasExecutable: (b) => b === 'ollama', ollamaReachable: () => true }));
  assert.deepEqual(up, ['ollama']);
});

test('auth via credential file (no env key)', () => {
  const out = detectLegs(deps({
    hasExecutable: (b) => b === 'codex',
    exists: (p) => p.includes('.codex'),
  }));
  assert.deepEqual(out, ['codex']);
});

test('nothing installed → empty ladder', () => {
  const out = detectLegs(deps({ hasExecutable: () => false }));
  assert.deepEqual(out, []);
});
