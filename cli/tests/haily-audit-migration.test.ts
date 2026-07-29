import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateSettings } from '../installer/merger';

// Covers the installer migration that injects haily-audit.cjs into
// upgraded (protected) settings.json — a plain `execFileSync`-on-cjs hook test
// cannot see this, since it never touches settings.json at all. Fixtures pin
// tracer/statusline as already migrated so only the audit-trail path is under
// test (isolates needsAuditInjection from the other independent migrations in
// migrateSettings).

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haily-audit-migration-'));
}

function legacyCommand(script: string): string {
  return `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/${script}; [ -f "$h" ] || { h="$HOME/$h"; s="$HOME/$s"; }; bash "$h" "$s"'`;
}

/** Settings with tracer + statusline already migrated — isolates the audit-trail migration. */
function preMigratedBase(hooksOverride: Record<string, unknown>) {
  return {
    statusLine: { type: 'command', command: legacyCommand('haily-statusline.cjs') },
    hooks: {
      PreToolUse: [
        { matcher: 'Agent', hooks: [{ type: 'command', command: legacyCommand('haily-tracer.cjs') }] },
      ],
      ...hooksOverride,
    },
  };
}

test('migrateSettings: injects haily-audit into PostToolUse "*" (replaces haily-usage, single-spawn invariant) and adds SessionEnd', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify(preMigratedBase({
    PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: legacyCommand('haily-usage.cjs') }] }],
  })));

  const n = migrateSettings(dir);
  assert.ok(n > 0, 'migration must report changes');

  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const starGroup = (s.hooks.PostToolUse as Array<{ matcher?: string; hooks: Array<{ command: string }> }>)
    .find((g) => g.matcher === '*');
  assert.ok(starGroup, 'PostToolUse "*" group present');
  assert.equal(starGroup!.hooks.length, 1, 'single-spawn invariant: exactly one hook on the "*" path');
  assert.ok(starGroup!.hooks[0].command.includes('haily-audit.cjs'), 'haily-audit.cjs now wired');
  assert.ok(!starGroup!.hooks[0].command.includes('haily-usage.cjs'), 'haily-usage.cjs replaced, not duplicated alongside it');

  assert.ok(Array.isArray(s.hooks.SessionEnd) && s.hooks.SessionEnd.length > 0, 'SessionEnd group created');
  const sessionEndGroups = s.hooks.SessionEnd as Array<{ hooks: Array<{ command: string }> }>;
  const hasAudit = sessionEndGroups.some((g) => g.hooks.some((h) => h.command.includes('haily-audit.cjs')));
  assert.ok(hasAudit, 'SessionEnd group references haily-audit.cjs');
});

test('migrateSettings: idempotent — a second run makes no further change', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify(preMigratedBase({
    PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: legacyCommand('haily-usage.cjs') }] }],
  })));

  const first = migrateSettings(dir);
  assert.ok(first > 0, 'first run migrates');
  const afterFirst = fs.readFileSync(p, 'utf8');

  const second = migrateSettings(dir);
  assert.equal(second, 0, 'second run is a no-op — needsAuditInjection is now false');
  assert.equal(fs.readFileSync(p, 'utf8'), afterFirst, 'file byte-for-byte unchanged on the second run');
});

test('migrateSettings: no-op and no duplicate when audit + SessionEnd already present', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify(preMigratedBase({
    PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: legacyCommand('haily-audit.cjs') }] }],
    SessionEnd: [{ hooks: [{ type: 'command', command: legacyCommand('haily-audit.cjs') }] }],
  })));

  const n = migrateSettings(dir);
  assert.equal(n, 0, 'already fully migrated — no changes reported');

  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const starGroup = (s.hooks.PostToolUse as Array<{ matcher?: string; hooks: unknown[] }>)
    .find((g) => g.matcher === '*');
  assert.equal(starGroup!.hooks.length, 1, 'no duplicate audit hook injected');
  assert.equal((s.hooks.SessionEnd as unknown[]).length, 1, 'no duplicate SessionEnd group injected');
});

// Regression coverage for the fix reversing an earlier "defer, marker-only"
// decision: injectAuditHook previously created the SessionEnd group only when
// the key was entirely absent, so any upgrader with a pre-existing SessionEnd
// hook (their own, or from another tool) silently never received the audit
// closure line — while migrateSettings still reported a non-zero count from
// the PostToolUse replacement alone, masking the incomplete migration.

test('migrateSettings: appends the audit SessionEnd group when SessionEnd already holds an unrelated entry', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify(preMigratedBase({
    PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: legacyCommand('haily-usage.cjs') }] }],
    SessionEnd: [{ hooks: [{ type: 'command', command: legacyCommand('third-party-hook.cjs') }] }],
  })));

  const n = migrateSettings(dir);
  assert.ok(n > 0, 'migration must report changes');

  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const sessionEndGroups = s.hooks.SessionEnd as Array<{ hooks: Array<{ command: string }> }>;
  assert.equal(sessionEndGroups.length, 2, 'pre-existing group preserved, audit group appended alongside it');
  assert.ok(
    sessionEndGroups[0].hooks.some((h) => h.command.includes('third-party-hook.cjs')),
    'pre-existing unrelated SessionEnd entry left untouched'
  );
  assert.ok(
    sessionEndGroups.some((g) => g.hooks.some((h) => h.command.includes('haily-audit.cjs'))),
    'audit SessionEnd group appended rather than silently skipped'
  );
});

test('migrateSettings: no duplicate SessionEnd audit group when one is already present alongside another hook', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify(preMigratedBase({
    PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: legacyCommand('haily-audit.cjs') }] }],
    SessionEnd: [
      { hooks: [{ type: 'command', command: legacyCommand('third-party-hook.cjs') }] },
      { hooks: [{ type: 'command', command: legacyCommand('haily-audit.cjs') }] },
    ],
  })));

  const n = migrateSettings(dir);
  assert.equal(n, 0, 'already fully migrated — no changes reported');

  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const sessionEndGroups = s.hooks.SessionEnd as Array<{ hooks: Array<{ command: string }> }>;
  assert.equal(sessionEndGroups.length, 2, 'no duplicate audit group added; unrelated group preserved');
});
