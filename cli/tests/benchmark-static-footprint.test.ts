import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyBenchmarkNdjson } from '../lib/benchmark/ndjson';
import { parseBenchmarkNdjson } from '../lib/benchmark/ndjson';
import { collectStaticFootprint } from '../lib/benchmark/static-footprint';
import { listStaticInventory } from '../lib/benchmark/static-inventory';
import type { BenchmarkObservation } from '../lib/benchmark/types';
import type { InstalledArtifactSnapshot } from '../lib/benchmark/types';
import { sha256 } from '../lib/reasoning-harness/hash';

const FIXTURE_ROOT = path.join(process.cwd(), 'cli/tests/fixtures/benchmark/static/source-template');

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-static-'));
  fs.cpSync(FIXTURE_ROOT, dir, { recursive: true });
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'bench@example.com'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Benchmark'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function snapshot(rootDir: string, entries: Record<string, string>): InstalledArtifactSnapshot {
  return {
    rootDir,
    createdAt: '2026-08-07T00:00:00.000Z',
    entries: Object.entries(entries).map(([entryPath, content]) => ({
      path: entryPath,
      sha256: sha256(content),
      bytes: Buffer.byteLength(content, 'utf8'),
    })),
  };
}

function staticMeta(row: BenchmarkObservation): Record<string, unknown> {
  return row.providerExtensions.static as Record<string, unknown>;
}

function descriptionBytes(text: string): number {
  const match = /^description:\s*"([^"]*(?:\\.[^"]*)*)"/m.exec(text);
  return Buffer.byteLength(match?.[1] ?? '', 'utf8');
}

test('inventory includes agents, hooks, and split skill description/body entries', () => {
  const inventory = listStaticInventory(FIXTURE_ROOT);
  assert.ok(inventory.some((entry) => entry.relativePath === 'kit/agents/sample-agent.md' && entry.componentClass === 'agent'));
  assert.ok(inventory.some((entry) => entry.relativePath === 'kit/hooks/sample-hook.cjs' && entry.componentClass === 'hook-source'));
  assert.ok(inventory.some((entry) => entry.relativePath === 'kit/skills/sample-skill/SKILL.md' && entry.componentClass === 'skill-description'));
  assert.ok(inventory.some((entry) => entry.relativePath === 'kit/skills/sample-skill/SKILL.md' && entry.componentClass === 'skill-body'));
});

test('collector emits V2 static observations and treats CRLF-only changes as zero semantic delta', () => {
  const repo = tempRepo();
  const rulePath = path.join(repo, 'kit/rules/sample-rule.md');
  fs.writeFileSync(rulePath, '# Sample rule\r\n\r\nUse {skill:hc-plan} before major changes.\r\n', 'utf8');
  const artifact = collectStaticFootprint({
    repoRoot: repo,
    baseRef: 'HEAD',
    claudeSnapshot: snapshot('C:\\temp\\claude', { 'rules/haily-coding.md': 'alpha', 'hooks/wrapper.js': 'beta' }),
    codexSnapshot: snapshot('C:\\temp\\codex', { 'rules/haily-coding.md': 'gamma' }),
  });
  const text = stringifyBenchmarkNdjson([artifact.manifest, ...artifact.observations, artifact.outcome]);
  assert.equal(parseBenchmarkNdjson(text).length, artifact.observations.length + 2);
  const ruleRow = artifact.observations.find((row) => row.fixtureId === 'kit/rules/sample-rule.md' && staticMeta(row).representation === 'source');
  assert.ok(ruleRow);
  assert.equal(staticMeta(ruleRow).normalizedBytes, Buffer.byteLength('# Sample rule\n\nUse {skill:hc-plan} before major changes.\n', 'utf8'));
  assert.equal(staticMeta(ruleRow).normalizedByteDelta, 0);
  assert.ok(typeof staticMeta(ruleRow).rawByteDelta === 'number');
  assert.equal(ruleRow.metrics.outputBytes, Buffer.byteLength('# Sample rule\r\n\r\nUse {skill:hc-plan} before major changes.\r\n', 'utf8'));
  const installedRow = artifact.observations.find((row) => staticMeta(row).provider === 'claude');
  assert.equal(staticMeta(installedRow!).providerFootprintStatus, 'present');
  assert.equal(artifact.outcome.decision, 'inconclusive');
  const skillRows = artifact.observations.filter((row) => row.fixtureId === 'kit/skills/sample-skill/SKILL.md');
  const descriptionRow = skillRows.find((row) => staticMeta(row).componentClass === 'skill-description');
  const bodyRow = skillRows.find((row) => staticMeta(row).componentClass === 'skill-body');
  const skillText = fs.readFileSync(path.join(repo, 'kit/skills/sample-skill/SKILL.md'), 'utf8');
  assert.ok(descriptionRow && bodyRow);
  assert.equal(descriptionRow.metrics.outputBytes, descriptionBytes(skillText));
  assert.ok(descriptionRow.metrics.outputBytes! < bodyRow.metrics.outputBytes!);
});

test('manifest hash changes when source content drifts', () => {
  const repo = tempRepo();
  const first = collectStaticFootprint({ repoRoot: repo, baseRef: 'HEAD' });
  fs.writeFileSync(path.join(repo, 'kit/agents/sample-agent.md'), '---\nmodel: fast\n---\n\n# Sample agent\n\nChanged report contract.\n', 'utf8');
  const second = collectStaticFootprint({ repoRoot: repo, baseRef: 'HEAD' });
  assert.notEqual(first.manifest.manifestHash, second.manifest.manifestHash);
});

test('collector rejects dotfile secrets, snapshot path escape, bad sha, duplicate paths, and junction traversal', () => {
  const repo = tempRepo();
  assert.throws(
    () => collectStaticFootprint({ repoRoot: repo, inventory: [{ relativePath: '.env', componentClass: 'harness-docs', contentMode: 'full' }] }),
    /secret-like path is forbidden/,
  );
  assert.throws(
    () => collectStaticFootprint({ repoRoot: repo, codexSnapshot: snapshot('C:\\temp\\codex', { '../escape.txt': 'bad' }) }),
    /invalid relative path/,
  );
  assert.throws(
    () => collectStaticFootprint({ repoRoot: repo, claudeSnapshot: { rootDir: 'C:\\temp\\claude', createdAt: '2026-08-07T00:00:00.000Z', entries: [{ path: 'rules/a.md', sha256: 'bad', bytes: 1 }] } }),
    /64 hex characters/,
  );
  assert.throws(
    () => collectStaticFootprint({ repoRoot: repo, claudeSnapshot: { rootDir: 'C:\\temp\\claude', createdAt: '2026-08-07T00:00:00.000Z', entries: [{ path: 'rules/a.md', sha256: sha256('a'), bytes: 1 }, { path: 'rules/a.md', sha256: sha256('b'), bytes: 1 }] } }),
    /duplicate path/,
  );
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-static-outside-'));
  fs.writeFileSync(path.join(outsideDir, 'linked.md'), 'outside', 'utf8');
  const junctionDir = path.join(repo, 'kit/rules/junction-dir');
  fs.symlinkSync(outsideDir, junctionDir, 'junction');
  assert.throws(
    () => collectStaticFootprint({ repoRoot: repo, inventory: [{ relativePath: 'kit/rules/junction-dir/linked.md', componentClass: 'rule', contentMode: 'full' }] }),
    /symlink or junction is forbidden/,
  );
});

test('measure-kit-overhead script keeps the legacy table shape', () => {
  const output = execFileSync('node', ['scripts/measure-kit-overhead.mjs'], { cwd: process.cwd(), encoding: 'utf8' });
  assert.match(output, /^# Kit overhead measurement — 2026-08-07/m);
  assert.match(output, /^\| Cost class \| Before \(bytes \/ est\. tokens\) \| After \(bytes \/ est\. tokens\) \| Delta \|$/m);
  assert.match(output, /^\| Rules \(one-time cacheable prefix\) \| /m);
  assert.match(output, /^\| Standards \(recurring, claude only\) \| /m);
  assert.match(output, /^\| Skill descriptions \(recurring, all providers\) \| /m);
});
