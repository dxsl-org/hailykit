import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeClaudeDir, applyDeletions, copyDir, mergePermissionDeny, HAILYKIT_DENY_RULES, migrateSettings, removeManagedHookEntries, applyEnforcedSettings, HAILYKIT_ENFORCED_SETTINGS } from '../installer/merger';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haily-merge-'));
}

test('mergeClaudeDir syncs files, applies deletions, returns metadata', () => {
  const root = tmp();
  const src = path.join(root, 'extracted', 'kit');
  fs.mkdirSync(path.join(src, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(src, 'skills', 'a.md'), 'A');
  fs.writeFileSync(
    path.join(src, 'metadata.json'),
    JSON.stringify({ version: '1.2.3', deletions: ['claude/old.md'] }),
  );

  const target = path.join(root, 'target');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'old.md'), 'stale');

  const meta = mergeClaudeDir(path.join(root, 'extracted'), target);
  assert.equal(meta.version, '1.2.3');
  assert.equal(fs.readFileSync(path.join(target, 'skills', 'a.md'), 'utf8'), 'A');
  assert.equal(fs.existsSync(path.join(target, 'old.md')), false);
});

test('mergeClaudeDir throws when no kit/ catalog is present', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'extracted'), { recursive: true });
  assert.throws(
    () => mergeClaudeDir(path.join(root, 'extracted'), path.join(root, 't')),
    /Catalog directory not found/,
  );
});

test('applyDeletions rejects path traversal outside the target', () => {
  const root = tmp();
  const target = path.join(root, 'target');
  fs.mkdirSync(target, { recursive: true });
  const outside = path.join(root, 'secret.txt');
  fs.writeFileSync(outside, 'keep');

  applyDeletions(target, ['../secret.txt', '../../secret.txt']);
  assert.equal(fs.existsSync(outside), true);
});

test('mergePermissionDeny: creates settings.json with deny rules when absent', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(Array.isArray(s.permissions.deny), 'permissions.deny must be an array');
  // Absolute system paths use // anchor (single / is project-relative in Claude Code glob spec).
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'), '// anchored absolute path rule');
  assert.ok(s.permissions.deny.includes('Edit(//etc/**)'), 'Edit pair for absolute path rule');
  // Tilde rules written verbatim — Claude Code natively supports ~/
  assert.ok(s.permissions.deny.includes('Write(~/.ssh/**)'), 'SSH rule kept as tilde form');
  assert.ok(s.permissions.deny.includes('Edit(~/.ssh/**)'), 'Edit pair for SSH rule');
  assert.ok(s.permissions.deny.includes('Write(~/.claude/settings.json)'), 'settings.json protection');
  assert.ok(s.permissions.deny.includes('Write(~/.claude/hooks/**)'), 'hooks protection');
  // _hailykit stores the rules verbatim for diagnostics.
  assert.equal(s._hailykit.denyVersion, '1.0.0');
  assert.deepEqual(s._hailykit.deny, [...HAILYKIT_DENY_RULES]);
});

test('mergePermissionDeny: preserves existing user deny rules', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({ permissions: { deny: ['Bash(sudo *)'] } }));
  mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Bash(sudo *)'), 'user rule must be preserved');
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'), 'managed rule must be added');
  // User rule comes first
  assert.equal(s.permissions.deny[0], 'Bash(sudo *)');
});

test('mergePermissionDeny: upgrade never removes existing deny rules (never-remove policy)', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  const oldRule = 'Write(/OLD_PATH/**)';
  fs.writeFileSync(p, JSON.stringify({
    permissions: { deny: ['Bash(sudo *)', oldRule] },
    _hailykit: { denyVersion: '0.9.0', deny: [oldRule] },
  }));
  mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Bash(sudo *)'), 'user rule preserved');
  // NOTE: never-remove policy — stale rules are kept (safe: lingering deny rules cause no harm)
  assert.ok(s.permissions.deny.includes(oldRule), 'stale rule kept — never-remove policy');
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'), 'new managed rule added');
  assert.equal(s._hailykit.denyVersion, '1.0.0');
});

test('mergePermissionDeny: additionalUserRules preserved when settings.json was overwritten', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  // Simulate first-install scenario: copyDir wrote kit/settings.json (empty deny) over user file.
  fs.writeFileSync(p, JSON.stringify({ permissions: { allow: [] } }));
  mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0', ['Bash(sudo *)', 'Write(~/custom/**)']);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Bash(sudo *)'), 'pre-copy user rule preserved');
  assert.ok(s.permissions.deny.includes('Write(~/custom/**)'), 'another pre-copy user rule preserved');
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'), 'HailyKit rule also added');
});

test('mergePermissionDeny: _hailykit injection cannot remove user rules', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  // Simulate attacker writing _hailykit.deny with the user's own rule listed as "managed".
  fs.writeFileSync(p, JSON.stringify({
    permissions: { deny: ['Bash(sudo *)'] },
    _hailykit: { denyVersion: '0.9.0', deny: ['Bash(sudo *)'] },
  }));
  mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Bash(sudo *)'), 'user rule survives injection attempt');
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'), 'HailyKit rules still added');
});

test('mergePermissionDeny: handles corrupt settings.json gracefully', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, 'NOT_VALID_JSON{{{');
  assert.doesNotThrow(() => mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0'));
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'));
});

test('mergePermissionDeny: handles valid non-object JSON (number) gracefully', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, '123');
  assert.doesNotThrow(() => mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0'));
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'), 'rules applied after non-object reset');
});

test('mergePermissionDeny: handles valid JSON array gracefully', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, '[1,2,3]');
  assert.doesNotThrow(() => mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0'));
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Write(//etc/**)'), 'rules applied after array reset');
});

test('mergePermissionDeny: filters non-string entries in existing deny array', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({ permissions: { deny: ['Bash(sudo *)', 42, null] } }));
  mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('Bash(sudo *)'), 'valid user rule preserved');
  assert.equal(s.permissions.deny.includes(42), false, 'non-string entry dropped');
  assert.equal(s.permissions.deny.includes(null), false, 'null entry dropped');
});

test('mergePermissionDeny: atomic write — no .tmp file left behind', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  mergePermissionDeny(p, HAILYKIT_DENY_RULES, '1.0.0');
  assert.equal(fs.existsSync(p + '.tmp'), false, '.tmp must be cleaned up by rename');
});

// ── migrateSettings: hook consolidation tests ─────────────────────────────────

function makeOldHookCommand(script: string): string {
  return `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/${script}; [ -f "$h" ] || { h="$HOME/$h"; s="$HOME/$s"; }; bash "$h" "$s"'`;
}

test('migrateSettings: replaces directory-access-guard with haily-access', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Bash|Glob|Grep|Read|Edit|Write',
        hooks: [
          { type: 'command', command: makeOldHookCommand('directory-access-guard.cjs') },
          { type: 'command', command: makeOldHookCommand('sensitive-file-blocker.cjs') },
        ],
      }],
    },
  }));
  const n = migrateSettings(dir);
  assert.ok(n > 0, 'migration must report changes');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const hooks = s.hooks.PreToolUse[0].hooks as Array<{ command: string }>;
  assert.equal(hooks.length, 1, 'should have exactly one hook after merge');
  assert.ok(hooks[0].command.includes('haily-access.cjs'), 'should use haily-access');
  assert.ok(!hooks[0].command.includes('directory-access-guard.cjs'), 'old guard removed');
  assert.ok(!hooks[0].command.includes('sensitive-file-blocker.cjs'), 'old blocker removed');
});

test('migrateSettings: removes sensitive-file-blocker and keeps other hooks', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Bash|Glob|Grep|Read|Edit|Write',
        hooks: [
          { type: 'command', command: makeOldHookCommand('haily-artifact.cjs') },
          { type: 'command', command: makeOldHookCommand('directory-access-guard.cjs') },
          { type: 'command', command: makeOldHookCommand('sensitive-file-blocker.cjs') },
        ],
      }],
    },
  }));
  migrateSettings(dir);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const hooks = s.hooks.PreToolUse[0].hooks as Array<{ command: string }>;
  assert.equal(hooks.length, 2, 'haily-artifact + haily-access remain');
  assert.ok(hooks.some((h) => h.command.includes('haily-artifact.cjs')), 'haily-artifact kept');
  assert.ok(hooks.some((h) => h.command.includes('haily-access.cjs')), 'haily-access present');
});

test('migrateSettings: deduplicates if haily-access already present', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Bash|Glob|Grep|Read|Edit|Write',
        hooks: [
          { type: 'command', command: makeOldHookCommand('haily-access.cjs') },
          { type: 'command', command: makeOldHookCommand('directory-access-guard.cjs') },
        ],
      }],
    },
  }));
  migrateSettings(dir);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const hooks = s.hooks.PreToolUse[0].hooks as Array<{ command: string }>;
  assert.equal(hooks.length, 1, 'only one haily-access after dedup');
  assert.ok(hooks[0].command.includes('haily-access.cjs'), 'haily-access kept');
});

test('migrateSettings: no-op when old hooks not present', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  // Represents a fully-migrated settings.json: no old bare-path hooks, tracer already present.
  const original = JSON.stringify({
    hooks: {
      PreToolUse: [
        { hooks: [{ type: 'command', command: makeOldHookCommand('haily-rules.cjs') }] },
        { matcher: 'Agent', hooks: [{ type: 'command', command: makeOldHookCommand('haily-tracer.cjs') }] },
      ],
    },
  });
  fs.writeFileSync(p, original);
  const n = migrateSettings(dir);
  assert.equal(n, 0, 'returns 0 when nothing to migrate');
  assert.equal(fs.readFileSync(p, 'utf8'), original, 'file unchanged');
});

test('migrateSettings: injects haily-pii into UserPromptSubmit during consolidation', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Bash|Glob|Grep|Read|Edit|Write',
        hooks: [
          { type: 'command', command: makeOldHookCommand('directory-access-guard.cjs') },
          { type: 'command', command: makeOldHookCommand('sensitive-file-blocker.cjs') },
        ],
      }],
      UserPromptSubmit: [{
        hooks: [
          { type: 'command', command: makeOldHookCommand('haily-rules.cjs') },
        ],
      }],
    },
  }));
  const n = migrateSettings(dir);
  assert.ok(n > 0, 'migration must report changes');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const ups = s.hooks.UserPromptSubmit[0].hooks as Array<{ command: string }>;
  assert.ok(ups.some((h) => h.command.includes('haily-pii.cjs')), 'haily-pii injected into UserPromptSubmit');
});

test('migrateSettings: does not inject haily-pii if already present', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Bash|Glob|Grep|Read|Edit|Write',
        hooks: [{ type: 'command', command: makeOldHookCommand('directory-access-guard.cjs') }],
      }],
      UserPromptSubmit: [{
        hooks: [
          { type: 'command', command: makeOldHookCommand('haily-pii.cjs') },
        ],
      }],
    },
  }));
  migrateSettings(dir);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const ups = s.hooks.UserPromptSubmit[0].hooks as Array<{ command: string }>;
  const piiCount = ups.filter((h) => h.command.includes('haily-pii.cjs')).length;
  assert.equal(piiCount, 1, 'haily-pii not duplicated');
});

test('migrateSettings: skips haily-pii injection when no UserPromptSubmit group', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Bash|Glob|Grep|Read|Edit|Write',
        hooks: [{ type: 'command', command: makeOldHookCommand('directory-access-guard.cjs') }],
      }],
    },
  }));
  const n = migrateSettings(dir);
  assert.ok(n > 0, 'consolidation still reported');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(s.hooks.UserPromptSubmit, undefined, 'no UserPromptSubmit added');
});

test('copyDir with skipProtected preserves an existing settings.json', () => {
  const root = tmp();
  const src = path.join(root, 'src');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'settings.json'), 'FROM_RELEASE');
  fs.writeFileSync(path.join(src, 'other.md'), 'OTHER');

  const dest = path.join(root, 'dest');
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'settings.json'), 'USER');

  copyDir(src, dest, { skipProtected: true });
  assert.equal(fs.readFileSync(path.join(dest, 'settings.json'), 'utf8'), 'USER');
  assert.equal(fs.readFileSync(path.join(dest, 'other.md'), 'utf8'), 'OTHER');
});

// ── removeManagedHookEntries: uninstall surgical hook cleanup ──────────────────

test('removeManagedHookEntries: removes HailyKit hooks, keeps user hooks + deny rules', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  const userHook = { type: 'command', command: 'node ~/.config/my-own-hook.js' };
  fs.writeFileSync(p, JSON.stringify({
    permissions: { deny: [...HAILYKIT_DENY_RULES, 'Bash(rm -rf /)'] },
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [
          { type: 'command', command: makeOldHookCommand('haily-access.cjs') },
          userHook,
        ],
      }],
      SessionStart: [{
        matcher: 'startup',
        hooks: [{ type: 'command', command: makeOldHookCommand('haily-session.cjs') }],
      }],
    },
    _hailykit: { denyVersion: '1.0.0', deny: [...HAILYKIT_DENY_RULES] },
  }, null, 2));

  const removed = removeManagedHookEntries(dir);
  assert.equal(removed, 2, 'both HailyKit hook commands removed');

  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  // Security deny rules untouched
  assert.deepEqual(s.permissions.deny, [...HAILYKIT_DENY_RULES, 'Bash(rm -rf /)']);
  // User hook preserved; its group survives
  assert.equal(s.hooks.PreToolUse[0].hooks.length, 1);
  assert.deepEqual(s.hooks.PreToolUse[0].hooks[0], userHook);
  // Event that had only HailyKit hooks is pruned entirely
  assert.equal(s.hooks.SessionStart, undefined);
  // Tracking key dropped
  assert.equal(s._hailykit, undefined);
});

test('removeManagedHookEntries: drops empty hooks object when all were HailyKit', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: makeOldHookCommand('haily-state.cjs') }] }],
    },
  }));
  removeManagedHookEntries(dir);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(s.hooks, undefined, 'fully-empty hooks object removed');
});

test('removeManagedHookEntries: no settings.json is a no-op (returns 0)', () => {
  const dir = tmp();
  assert.equal(removeManagedHookEntries(dir), 0);
});

test('removeManagedHookEntries: malformed settings.json is left intact', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, '{ not valid json');
  assert.equal(removeManagedHookEntries(dir), 0);
  assert.equal(fs.readFileSync(p, 'utf8'), '{ not valid json', 'unparseable file never rewritten');
});

test('removeManagedHookEntries: atomic write — no .tmp left behind', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: makeOldHookCommand('haily-state.cjs') }] }] },
  }));
  removeManagedHookEntries(dir);
  assert.equal(fs.existsSync(p + '.tmp'), false);
});

// ── applyEnforcedSettings: force-set HailyKit policy keys (install + upgrade) ──

test('applyEnforcedSettings: adds workflowKeywordTriggerEnabled when absent', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({ permissions: { deny: ['X'] } }, null, 2));
  const changed = applyEnforcedSettings(p);
  assert.equal(changed, 1);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(s.workflowKeywordTriggerEnabled, false);
  assert.deepEqual(s.permissions.deny, ['X'], 'other keys untouched');
});

test('applyEnforcedSettings: OVERRIDES an explicit user true → false (enforced policy)', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({ workflowKeywordTriggerEnabled: true }));
  const changed = applyEnforcedSettings(p);
  assert.equal(changed, 1, 'user value is force-overwritten');
  assert.equal(JSON.parse(fs.readFileSync(p, 'utf8')).workflowKeywordTriggerEnabled, false);
});

test('applyEnforcedSettings: idempotent when already false (no rewrite)', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({ workflowKeywordTriggerEnabled: false }));
  const before = fs.statSync(p).mtimeMs;
  const changed = applyEnforcedSettings(p);
  assert.equal(changed, 0);
  assert.equal(fs.existsSync(p + '.tmp'), false, 'no write when already enforced');
  assert.equal(fs.statSync(p).mtimeMs, before, 'file not rewritten when nothing changes');
});

test('applyEnforcedSettings: malformed settings.json is left intact', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, '{ broken');
  assert.equal(applyEnforcedSettings(p), 0);
  assert.equal(fs.readFileSync(p, 'utf8'), '{ broken');
});

test('applyEnforcedSettings: HAILYKIT_ENFORCED_SETTINGS ships workflowKeywordTriggerEnabled=false', () => {
  assert.equal(HAILYKIT_ENFORCED_SETTINGS.workflowKeywordTriggerEnabled, false);
});

test('mergeClaudeDir force-enforces setting on upgrade even when user set it true', () => {
  const root = tmp();
  const src = path.join(root, 'extracted');
  const kit = path.join(src, 'kit');
  fs.mkdirSync(kit, { recursive: true });
  fs.writeFileSync(path.join(kit, 'metadata.json'), JSON.stringify({ version: '1.3.1' }));
  fs.writeFileSync(path.join(kit, 'settings.json'), JSON.stringify({ workflowKeywordTriggerEnabled: false }));

  const dest = tmp();
  // Existing user deliberately enabled the trigger — upgrade must flip it back.
  fs.writeFileSync(path.join(dest, 'settings.json'), JSON.stringify({
    workflowKeywordTriggerEnabled: true,
    permissions: { deny: ['Bash(sudo *)'] },
  }, null, 2));

  mergeClaudeDir(src, dest, { isUpgrade: true });

  const s = JSON.parse(fs.readFileSync(path.join(dest, 'settings.json'), 'utf8'));
  assert.equal(s.workflowKeywordTriggerEnabled, false, 'enforced false on upgrade, overriding user true');
  assert.ok(s.permissions.deny.includes('Bash(sudo *)'), 'user deny rule preserved');
});
