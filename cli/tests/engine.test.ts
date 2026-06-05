import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Engine } from '../core-engine/engine';
import { ok, type NativeToolHandler, type Tool } from '../core-engine/types';
import { silentLogger } from '../utils/logger';

// In .test-build/tests/, __dirname is .test-build/tests/
// ../../cli/tools from .test-build/tests/ → repo-root cli/tools/ (correct)
const TOOLS_DIR = path.resolve(__dirname, '../../cli/tools');

const nativeGreet: Tool = {
  manifest: { id: 'greet', name: 'Greet', description: 'greets', version: '1.0.0', kind: 'native' },
  loadHandler: async (): Promise<NativeToolHandler> => (input) => {
    const name = (input as { name?: string }).name ?? 'world';
    return ok({ message: `hello ${name}` });
  },
};

test('runs a native tool', async () => {
  const engine = new Engine({ logger: silentLogger }).register(nativeGreet);
  const res = await engine.run('greet', { name: 'haily' });
  if (!res.ok) assert.fail(res.error.message);
  assert.deepEqual(res.value, { message: 'hello haily' });
});

test('returns E_TOOL_NOT_FOUND for an unknown tool', async () => {
  const engine = new Engine({ logger: silentLogger });
  const res = await engine.run('nope', {});
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.error.code, 'E_TOOL_NOT_FOUND');
});

test('captures a native handler throw as E_NATIVE_THROW', async () => {
  const boom: Tool = {
    manifest: { id: 'boom', name: 'Boom', description: '', version: '1.0.0', kind: 'native' },
    loadHandler: async (): Promise<NativeToolHandler> => () => { throw new Error('kaboom'); },
  };
  const engine = new Engine({ logger: silentLogger }).register(boom);
  const res = await engine.run('boom', {});
  assert.equal(!res.ok && res.error.code, 'E_NATIVE_THROW');
});

test('runs an external (polyglot) Node tool end-to-end', async () => {
  const engine = new Engine({ logger: silentLogger });
  engine.discover(TOOLS_DIR);
  assert.ok(engine.registry.size >= 2, `Expected ≥2 tools, got ${engine.registry.size} — check TOOLS_DIR path`);
  const res = await engine.run('uppercase', { text: 'haily' });
  if (!res.ok) assert.fail(res.error.message);
  assert.deepEqual(res.value, { text: 'HAILY' });
});

test('aborts an external tool when the signal is already aborted', async () => {
  const engine = new Engine({ logger: silentLogger });
  engine.discover(TOOLS_DIR);
  assert.ok(engine.registry.size >= 2, `Expected ≥2 tools, got ${engine.registry.size} — check TOOLS_DIR path`);
  const res = await engine.run('uppercase', { text: 'x' }, { signal: AbortSignal.abort() });
  assert.equal(!res.ok && res.error.code, 'E_ABORTED');
});
