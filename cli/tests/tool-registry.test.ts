import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry } from '../core-engine/tool-registry';
import { ToolNotFoundError } from '../utils/errors';
import type { Tool } from '../core-engine/types';

const mk = (id: string): Tool => ({
  manifest: { id, name: id, description: '', version: '1.0.0', kind: 'native', entry: 'x.js' },
});

test('register / get / has / list / size', () => {
  const registry = new ToolRegistry();
  registry.register(mk('a'));
  registry.register(mk('b'));
  assert.equal(registry.size, 2);
  assert.equal(registry.has('a'), true);
  assert.equal(registry.get('a').manifest.id, 'a');
  assert.deepEqual(registry.list().map((t) => t.manifest.id), ['a', 'b']);
});

test('duplicate id throws', () => {
  const registry = new ToolRegistry();
  registry.register(mk('a'));
  assert.throws(() => registry.register(mk('a')), /Duplicate/);
});

test('missing id throws ToolNotFoundError', () => {
  const registry = new ToolRegistry();
  assert.throws(() => registry.get('nope'), ToolNotFoundError);
});
