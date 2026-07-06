import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLeg, canonicalProvider, type ResolveDeps } from '../lib/cross-review/resolve';
import type { CrossReviewConfig, LegName } from '../lib/cross-review/types';

const MAP: Record<string, Record<string, string>> = {
  codex: { thinking: 'gpt-5.5', medium: 'gpt-5.4', fast: 'gpt-5.4-mini', ultra: 'gpt-5.5' },
  gemini: { thinking: 'gemini-3.1-pro-preview', medium: 'gemini-3.5-flash', fast: 'x', ultra: 'y' },
  opencode: { thinking: 'anthropic/claude-opus-4-8', medium: 'a/b', fast: 'a/b', ultra: 'a/b' },
  cline: { thinking: 'anthropic/claude-opus-4-8', medium: 'a/b', fast: 'a/b', ultra: 'a/b' },
  ollama: { thinking: 'qwen2.5-coder:32b', medium: 'x', fast: 'y', ultra: 'z' },
};

function deps(overrides: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    getMap: (p) => MAP[p] ?? {},
    ollamaModels: () => ['qwen2.5-coder:32b', 'llama3.2'],
    ...overrides,
  };
}

const ALL: LegName[] = ['codex', 'gemini', 'opencode', 'cline', 'ollama'];

test('canonicalProvider folds aliases', () => {
  assert.equal(canonicalProvider('claude'), 'anthropic');
  assert.equal(canonicalProvider('openai'), 'openai');
  assert.equal(canonicalProvider('codex'), 'openai');
  assert.equal(canonicalProvider('gemini'), 'google');
  assert.equal(canonicalProvider('ollama'), 'local');
  assert.equal(canonicalProvider('deepseek'), 'deepseek');
});

test('session=claude picks codex first (provider differs)', () => {
  const out = resolveLeg(ALL, 'claude', {}, deps());
  assert.equal(out.leg?.cli, 'codex');
  assert.equal(out.leg?.provider, 'openai');
});

test('session=codex skips codex, picks gemini', () => {
  const out = resolveLeg(ALL, 'codex', {}, deps());
  assert.equal(out.leg?.cli, 'gemini');
  assert.equal(out.leg?.provider, 'google');
});

test('gateway model colliding with session swaps to a non-session alternate', () => {
  // session=claude, only opencode available; its mapped model is anthropic/* → collision.
  const out = resolveLeg(['opencode'], 'claude', {}, deps());
  assert.equal(out.leg?.cli, 'opencode');
  assert.notEqual(out.leg?.provider, 'anthropic');
  assert.match(out.leg!.model, /^deepseek\//);
});

test('forced model that shares session provider makes the leg ineligible', () => {
  const cfg: CrossReviewConfig = { model: 'anthropic/claude-opus-4-8' };
  const out = resolveLeg(['opencode'], 'claude', cfg, deps());
  assert.equal(out.leg, undefined);
  assert.equal(out.rejected.length, 1);
  assert.match(out.rejected[0].reason, /shares session provider/);
});

test('gateway alternate is re-checked against the session provider', () => {
  // session=deepseek: opencode default anthropic differs, but if we forced a
  // deepseek collision the alternate (also deepseek) must NOT be used.
  const cfg: CrossReviewConfig = { model: 'deepseek/deepseek-chat' };
  const out = resolveLeg(['opencode'], 'deepseek', cfg, deps());
  assert.equal(out.leg, undefined);
  assert.match(out.rejected[0].reason, /shares session provider/);
});

test('config.reviewer forces a specific leg', () => {
  const out = resolveLeg(ALL, 'claude', { reviewer: 'gemini' }, deps());
  assert.equal(out.leg?.cli, 'gemini');
});

test('config.reviewer that shares session provider yields no leg', () => {
  const out = resolveLeg(ALL, 'gemini', { reviewer: 'gemini' }, deps());
  assert.equal(out.leg, undefined);
});

test('ollama uses mapped hint when pulled, else first installed', () => {
  const pulled = resolveLeg(['ollama'], 'claude', {}, deps());
  assert.equal(pulled.leg?.model, 'qwen2.5-coder:32b');
  const other = resolveLeg(['ollama'], 'claude', {}, deps({ ollamaModels: () => ['llama3.2'] }));
  assert.equal(other.leg?.model, 'llama3.2');
});

test('ollama with no models pulled is rejected', () => {
  const out = resolveLeg(['ollama'], 'claude', {}, deps({ ollamaModels: () => [] }));
  assert.equal(out.leg, undefined);
  assert.match(out.rejected[0].reason, /no local ollama model/);
});

test('tier override selects a different mapped model', () => {
  const out = resolveLeg(['codex'], 'claude', { tier: 'medium' }, deps());
  assert.equal(out.leg?.model, 'gpt-5.4');
});
