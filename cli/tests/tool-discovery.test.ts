import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverTools } from '../core-engine/tool-discovery';
import { InvalidManifestError } from '../utils/errors';

function tmpToolRoot(manifest: object, files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'haily-disc-'));
  const dir = path.join(root, 'tk');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'tool.json'), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return root;
}

test('discovers an external tool and absolutizes bundled script args', () => {
  const root = tmpToolRoot(
    {
      id: 'up', name: 'Up', description: '', version: '1.0.0',
      kind: 'external', command: 'node', args: ['run.js'],
    },
    { 'run.js': '// noop' },
  );
  const [tool] = discoverTools(root);
  assert.equal(tool.manifest.id, 'up');
  // Bundled script resolved to an absolute path; bare PATH command left as-is.
  assert.equal(path.isAbsolute(tool.manifest.args![0]), true);
  assert.equal(tool.manifest.command, 'node');
});

test('throws on invalid manifest (external missing command)', () => {
  const root = tmpToolRoot({
    id: 'x', name: 'X', description: '', version: '1.0.0', kind: 'external',
  });
  assert.throws(() => discoverTools(root), InvalidManifestError);
});

test('returns empty array for a nonexistent directory', () => {
  assert.deepEqual(discoverTools(path.join(os.tmpdir(), 'nope-haily-xyz')), []);
});
