import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractContracts } from '../commands/contracts/extract';

function mk(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function find(files: any[], file: string) {
  return files.find(f => f.file === file)?.symbols ?? [];
}

test('contracts: extracts TS exports, signatures, and routes', () => {
  const dir = mk('hl-contracts-ts-');
  try {
    fs.writeFileSync(path.join(dir, 'api.ts'), [
      '// a comment',
      'export function add(a: number, b: number): number { return a + b; }',
      'export const VERSION = "1";',
      'export interface User { id: string; }',
      'export class Service {}',
      "router.get('/users', handler);",
      "@Post('/login')",
    ].join('\n'));
    const { files } = extractContracts(dir);
    const syms = find(files, 'api.ts');
    const byName = (n: string) => syms.find((s: any) => s.name === n);
    assert.ok(byName('add')?.kind === 'function' && byName('add')?.signature?.includes('a: number'));
    assert.ok(byName('VERSION')?.kind === 'const');
    assert.ok(byName('User')?.kind === 'interface');
    assert.ok(byName('Service')?.kind === 'class');
    const ep = syms.filter((s: any) => s.kind === 'endpoint');
    assert.ok(ep.some((s: any) => s.method === 'GET' && s.signature === '/users'));
    assert.ok(ep.some((s: any) => s.method === 'POST' && s.signature === '/login'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('contracts: extracts Python top-level defs/classes and FastAPI routes', () => {
  const dir = mk('hl-contracts-py-');
  try {
    fs.writeFileSync(path.join(dir, 'svc.py'), [
      'def public_fn(x):',
      '    return x',
      '    def _nested(): pass',  // indented → not top-level
      'class Handler:',
      '    def method(self): pass',  // method, not top-level
      '@app.get("/ping")',
      'async def ping(): ...',
    ].join('\n'));
    const { files } = extractContracts(dir);
    const syms = find(files, 'svc.py');
    const names = syms.map((s: any) => s.name);
    assert.ok(names.includes('public_fn'));
    assert.ok(names.includes('Handler'));
    assert.ok(!names.includes('method'), 'class methods are not top-level surface');
    assert.ok(syms.some((s: any) => s.kind === 'endpoint' && s.method === 'GET' && s.signature === '/ping'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('contracts: extracts exported Go funcs/types (capitalized only)', () => {
  const dir = mk('hl-contracts-go-');
  try {
    fs.writeFileSync(path.join(dir, 'h.go'), [
      'func Public() error { return nil }',
      'func private() {}',
      'type Config struct {}',
      'mux.HandleFunc("/health", handler)',
      'r.GET("/v1/items", list)',
    ].join('\n'));
    const { files } = extractContracts(dir);
    const syms = find(files, 'h.go');
    const names = syms.map((s: any) => s.name);
    assert.ok(names.includes('Public'));
    assert.ok(!names.includes('private'), 'unexported (lowercase) funcs are not public surface');
    assert.ok(syms.some((s: any) => s.kind === 'type' && s.name === 'Config'));
    assert.ok(syms.some((s: any) => s.kind === 'endpoint' && s.signature === '/health'));
    assert.ok(syms.some((s: any) => s.kind === 'endpoint' && s.method === 'GET' && s.signature === '/v1/items'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('contracts: --lang filter restricts to selected languages', () => {
  const dir = mk('hl-contracts-filter-');
  try {
    fs.writeFileSync(path.join(dir, 'a.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'b.go'), 'func Y() {}\n');
    const { files } = extractContracts(dir, { langs: ['go'] });
    assert.ok(files.every(f => f.file.endsWith('.go')), 'only Go files when --lang go');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
