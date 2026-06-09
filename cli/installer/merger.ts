import * as fs from 'node:fs';
import * as path from 'node:path';
import { isProtected } from './paths.js';
import { stripJsonComments } from '../utils/strip-json-comments.js';
import { resolveSkillRefs, resolveAgentRefs, resolveModel, parseFrontmatter, isProviderAllowed } from './converter.js';

/**
 * Deny rules written into settings.json on every install/upgrade.
 *
 * Path conventions (Claude Code gitignore-spec glob matcher):
 *   //path  — absolute path anchor (single / is project-root-relative, not absolute)
 *   ~/path  — home directory (natively supported by Claude Code, NOT expanded here)
 *   C:\\    — must NOT be used; Windows paths normalize to /c/ (POSIX) with // anchor
 *
 * Each protected path has both a Write() and Edit() rule — they cover different tools.
 *
 * Scope: Write/Edit tools only. Bash indirect-write attacks (tee, heredoc, python -c, symlinks)
 * require OS-level sandboxing and cannot be blocked via application-layer patterns.
 */
export const HAILYKIT_DENY_RULES: readonly string[] = [
  // Linux/macOS system dirs (// = absolute path in Claude Code's glob spec)
  'Write(//etc/**)',     'Edit(//etc/**)',
  'Write(//usr/**)',     'Edit(//usr/**)',
  'Write(//bin/**)',     'Edit(//bin/**)',
  'Write(//sbin/**)',    'Edit(//sbin/**)',
  'Write(//boot/**)',    'Edit(//boot/**)',
  'Write(//System/**)',  'Edit(//System/**)',
  // Windows system dir (POSIX-normalized: C: → /c, must use // anchor)
  'Write(//c/Windows/**)', 'Edit(//c/Windows/**)',
  // User credential paths (~ natively supported by Claude Code — do not expand)
  'Write(~/.ssh/**)',          'Edit(~/.ssh/**)',
  'Write(~/.gnupg/**)',        'Edit(~/.gnupg/**)',
  'Write(~/.aws/credentials)', 'Edit(~/.aws/credentials)',
  'Write(~/.aws/config)',      'Edit(~/.aws/config)',
  // Protect HailyKit's own security config — AI agent must not remove deny rules
  'Write(~/.claude/settings.json)',       'Edit(~/.claude/settings.json)',
  'Write(~/.claude/settings.local.json)', 'Edit(~/.claude/settings.local.json)',
  // Protect hook files — installer writes these via fs, not Claude Code tools
  'Write(~/.claude/hooks/**)', 'Edit(~/.claude/hooks/**)',
] as const;

/**
 * HailyKit-ENFORCED settings.json values, applied on every install AND upgrade.
 *
 * These keys are FORCE-SET to HailyKit's value, overriding any prior user value.
 * Installing HailyKit is a deliberate opt-in to this policy. Rationale: the key
 * below gates token-expensive auto-behaviors that must be explicit, not
 * auto-detected — anyone who genuinely wants them invokes the command directly
 * (`/deep-research`, `/workflows`, `/effort ultracode`), keeping token spend
 * under their own control.
 *
 * `workflowKeywordTriggerEnabled: false` — stop natural-language prompts
 * ("research X", "use a workflow") and the `ultracode` keyword from
 * auto-triggering Claude Code's built-in `/deep-research` and dynamic workflows.
 */
export const HAILYKIT_ENFORCED_SETTINGS: Readonly<Record<string, unknown>> = {
  workflowKeywordTriggerEnabled: false,
};

export interface ClaudeMetadata {
  version?: string;
  buildDate?: string;
  deletions?: string[];
  [key: string]: unknown;
}

/**
 * Read metadata.json from a .claude/ directory.
 * Returns an empty object on missing file or parse errors — callers treat
 * this as "no metadata declared" rather than a hard failure.
 *
 * @param claudeDir - Absolute path to the .claude/ directory.
 */
export function readMetadata(claudeDir: string): ClaudeMetadata {
  const p = path.join(claudeDir, 'metadata.json');
  try {
    return JSON.parse(stripJsonComments(fs.readFileSync(p, 'utf8'))) as ClaudeMetadata;
  } catch {
    return {};
  }
}

/**
 * Remove stale files listed in the release's metadata.json `deletions[]` array.
 * Rejects paths that escape targetClaudeDir to prevent directory traversal.
 *
 * @param targetClaudeDir - Absolute path to the user's .claude/ directory.
 * @param deletions       - Relative paths from metadata.json deletions[].
 */
export function applyDeletions(targetClaudeDir: string, deletions: string[] = []): void {
  const resolvedBase = path.resolve(targetClaudeDir);
  let n = 0;
  for (const raw of deletions) {
    // Normalize: strip leading .claude/ or claude/ prefix if present.
    const rel = raw.replace(/^\.?claude\//, '');
    const full = path.resolve(targetClaudeDir, rel);
    // Reject paths that escape targetClaudeDir (e.g. "../../.ssh/authorized_keys").
    if (full !== resolvedBase && !full.startsWith(resolvedBase + path.sep)) {
      console.warn(`  Skipped unsafe deletion path: ${raw}`);
      continue;
    }
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      n++;
    }
  }
  if (n) console.log(`  Removed ${n} stale file(s)`);
}

/**
 * Migrate settings.json hook commands from old-style bare paths to
 * dynamic local-vs-global resolution.
 *
 * Also consolidates split file-access hooks and injects new hooks:
 *   Migration 1: bare path → dynamic local-vs-global resolution
 *   Migration 2: [directory-access-guard.cjs, sensitive-file-blocker.cjs] → [haily-access.cjs]
 *   Migration 3: inject haily-pii.cjs into UserPromptSubmit (added alongside sensitive-file-blocker removal)
 *
 * @param targetClaudeDir - Absolute path to the user's .claude/ directory.
 * @returns Number of hook commands migrated.
 */
export function migrateSettings(targetClaudeDir: string): number {
  const settingsPath = path.join(targetClaudeDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) return 0;

  let raw: string;
  try { raw = fs.readFileSync(settingsPath, 'utf8'); } catch { return 0; }

  const needsBarePathMigration = raw.includes('"bash .claude/hooks/haily-node.sh ');
  const needsConsolidation = raw.includes('directory-access-guard.cjs') || raw.includes('sensitive-file-blocker.cjs');
  // Inject haily-pii only when consolidating from old guards and it isn't already present.
  const needsPiiGuardInjection = needsConsolidation && !raw.includes('haily-pii.cjs');
  if (!needsBarePathMigration && !needsConsolidation) return 0;

  let settings: unknown;
  try { settings = JSON.parse(stripJsonComments(raw)); } catch { return 0; }

  if (typeof settings !== 'object' || settings === null) return 0;

  let count = 0;

  // ── Migration 1: bare path → dynamic local-vs-global resolution ─────────────
  function rewriteCommand(cmd: string): string {
    const m = cmd.match(/^bash (\.claude\/hooks\/haily-node.sh) (\.claude\/.+\.cjs)$/);
    if (!m) return cmd;
    count++;
    const runner = m[1];
    const script = m[2];
    return `bash -c 'h=${runner}; s=${script}; [ -f "$h" ] || { h="$HOME/$h"; s="$HOME/$s"; }; bash "$h" "$s"'`;
  }

  function walkHooks(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(walkHooks); return; }
    const record = obj as Record<string, unknown>;
    if (typeof record.command === 'string') {
      record.command = rewriteCommand(record.command);
    }
    for (const val of Object.values(record)) {
      if (typeof val === 'object') walkHooks(val);
    }
  }

  // ── Migration 2: consolidate file-access hooks ────────────────────────────────
  // Replaces directory-access-guard → haily-access; removes sensitive-file-blocker
  // (both are now handled by the single haily-access.cjs hook).
  function consolidateHooksArray(arr: unknown[]): void {
    const seen = new Set<string>();
    const keep: unknown[] = [];

    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') { keep.push(entry); continue; }
      const e = entry as Record<string, unknown>;
      if (typeof e.command !== 'string') { keep.push(entry); continue; }

      const cmd = e.command as string;
      if (cmd.includes('sensitive-file-blocker.cjs')) {
        count++; // removed
        continue;
      }
      if (cmd.includes('directory-access-guard.cjs')) {
        e.command = cmd.replace('directory-access-guard.cjs', 'haily-access.cjs');
        count++;
      }

      // Deduplicate: skip if haily-access.cjs already added to this array.
      const finalCmd = e.command as string;
      if (finalCmd.includes('haily-access.cjs') && seen.has('haily-access')) {
        count++;
        continue;
      }
      if (finalCmd.includes('haily-access.cjs')) seen.add('haily-access');

      keep.push(entry);
    }

    if (keep.length !== arr.length) {
      arr.length = 0;
      arr.push(...keep);
    }
  }

  function walkForConsolidation(hooksRoot: unknown): void {
    if (!hooksRoot || typeof hooksRoot !== 'object') return;
    for (const eventGroups of Object.values(hooksRoot as Record<string, unknown>)) {
      if (!Array.isArray(eventGroups)) continue;
      for (const group of eventGroups) {
        if (!group || typeof group !== 'object') continue;
        const g = group as Record<string, unknown>;
        if (Array.isArray(g.hooks)) consolidateHooksArray(g.hooks);
      }
    }
  }

  // ── Migration 3: inject haily-pii into UserPromptSubmit ──────────────────────
  // haily-pii.cjs is a new UserPromptSubmit hook that ships alongside the
  // sensitive-file-blocker removal. Fresh installs get it via settings.json copy;
  // upgrades need explicit injection since settings.json is preserved.
  function injectPiiGuardHook(hooksRoot: unknown): boolean {
    if (!hooksRoot || typeof hooksRoot !== 'object') return false;
    const hooks = hooksRoot as Record<string, unknown>;
    const groups = hooks['UserPromptSubmit'];
    if (!Array.isArray(groups) || groups.length === 0) return false;

    // Target: the matcher-less group (applies to all prompts)
    const target = groups.find((g: unknown) => {
      if (!g || typeof g !== 'object') return false;
      const gr = g as Record<string, unknown>;
      return Array.isArray(gr.hooks) && !gr.matcher;
    }) as Record<string, unknown> | undefined;
    if (!target) return false;

    const arr = target.hooks as unknown[];
    const PII_CMD = `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/haily-pii.cjs; [ -f "$h" ] || { h="$HOME/$h"; s="$HOME/$s"; }; bash "$h" "$s"'`;
    arr.push({ type: 'command', command: PII_CMD });
    return true;
  }

  const s = settings as Record<string, unknown>;
  if (needsBarePathMigration) {
    if (s.hooks) walkHooks(s.hooks);
    if (s.statusLine) walkHooks(s.statusLine);
  }
  if (needsConsolidation && s.hooks) {
    walkForConsolidation(s.hooks);
  }
  if (needsPiiGuardInjection && s.hooks) {
    if (injectPiiGuardHook(s.hooks)) count++;
  }

  if (count > 0) {
    // Write atomically: temp file on the same filesystem then rename, so a
    // crash mid-write cannot leave a half-written settings.json.
    const tmp = settingsPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, settingsPath);
    console.log(`  Migrated ${count} hook command(s) in settings.json`);
  }
  return count;
}

export interface CopyDirOptions {
  skipProtected?: boolean;
  /** When true, apply {skill:x:y} → /hc:cook Claude slash syntax in .md files. */
  resolveSkillRefsForClaude?: boolean;
  /** When set, skill directories whose `providers` frontmatter excludes this provider are skipped. */
  providerName?: string;
  /** Internal — tracks the base dir for protected-path resolution across recursion. */
  _base?: string | null;
}

/**
 * Recursively copy src into dest, returning the number of files copied.
 * When skipProtected is true, files whose relative path matches PROTECTED_PATHS are skipped.
 *
 * @param src  - Source directory.
 * @param dest - Destination directory (created if absent).
 */
export function copyDir(src: string, dest: string, options: CopyDirOptions = {}): number {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });

  const { skipProtected = false, resolveSkillRefsForClaude = false, providerName, _base = null } = options;
  const base = _base ?? dest;
  let n = 0;

  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, ent.name);
    const destPath = path.join(dest, ent.name);
    const rel = path.relative(base, destPath).replace(/\\/g, '/');

    if (skipProtected && isProtected(rel)) continue;

    if (ent.isDirectory()) {
      // Provider filter: if this is a skill dir (contains SKILL.md), check the providers restriction.
      if (providerName) {
        const skillMd = path.join(srcPath, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          const parsed = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
          if (!isProviderAllowed(parsed, providerName)) continue;
        }
      }
      n += copyDir(srcPath, destPath, { skipProtected, resolveSkillRefsForClaude, providerName, _base: base });
    } else if (resolveSkillRefsForClaude && ent.name.endsWith('.md')) {
      // Resolve {skill:hc-cook} → /hc-cook and {agent:X} → Task tool syntax,
      // plus model tier → opus/sonnet/haiku for Claude.
      let content = fs.readFileSync(srcPath, 'utf8');
      content = resolveAgentRefs(content, (type, roles) => {
        if (type === 'agent-result') return '';
        if (type === 'agents') {
          return `Spawn in parallel:\n${roles.map((r) => `- Task(subagent_type="${r}")`).join('\n')}`;
        }
        return `Delegate to a **${roles[0]}** subagent — use \`Task(subagent_type="${roles[0]}")\`.`;
      });
      content = resolveSkillRefs(content, (p, name) => `/${p}-${name}`);
      content = resolveModel(content, 'claude');
      fs.writeFileSync(destPath, content, 'utf8');
      n++;
    } else {
      fs.copyFileSync(srcPath, destPath);
      n++;
    }
  }
  return n;
}

// Marker present in every HailyKit hook command (the wrapper invocation).
// User-authored hooks never reference this — making it a safe surgical filter.
const HAILYKIT_HOOK_MARKER = 'haily-node.sh';

/**
 * Surgically remove HailyKit-managed hook entries from settings.json on uninstall.
 *
 * Removes only hook commands referencing the HailyKit wrapper (`haily-node.sh`) and
 * drops the `_hailykit` tracking key. Leaves everything else untouched — crucially,
 * `permissions.deny` (the security rules) and any user-authored hooks. This avoids
 * dangling references to the deleted `hooks/` dir without weakening the user's
 * security posture or risking removal of rules the user may rely on.
 *
 * Empty hook groups and empty event arrays are pruned; a fully-empty `hooks` object
 * is removed. Malformed or non-object settings.json is left intact (returns 0).
 * Atomic write via `.tmp` + rename.
 *
 * @param claudeDir - Absolute path to the .claude/ (or project .claude/) directory.
 * @returns Number of HailyKit hook commands removed.
 */
export function removeManagedHookEntries(claudeDir: string): number {
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) return 0;

  let settings: unknown;
  try {
    settings = JSON.parse(stripJsonComments(fs.readFileSync(settingsPath, 'utf8')));
  } catch {
    return 0; // malformed — never rewrite a file we can't safely parse
  }
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return 0;

  const s = settings as Record<string, unknown>;
  let removed = 0;

  const hooks = s.hooks;
  if (hooks && typeof hooks === 'object' && !Array.isArray(hooks)) {
    const hooksObj = hooks as Record<string, unknown>;
    for (const event of Object.keys(hooksObj)) {
      const groups = hooksObj[event];
      if (!Array.isArray(groups)) continue;

      const keptGroups: unknown[] = [];
      for (const group of groups) {
        if (!group || typeof group !== 'object' || !Array.isArray((group as Record<string, unknown>).hooks)) {
          keptGroups.push(group);
          continue;
        }
        const g = group as Record<string, unknown>;
        const keptHooks = (g.hooks as unknown[]).filter((h) => {
          const cmd = h && typeof h === 'object' ? (h as Record<string, unknown>).command : undefined;
          const isHaily = typeof cmd === 'string' && cmd.includes(HAILYKIT_HOOK_MARKER);
          if (isHaily) removed++;
          return !isHaily;
        });
        if (keptHooks.length > 0) keptGroups.push({ ...g, hooks: keptHooks });
        // else: group had only HailyKit hooks — drop the whole group
      }

      if (keptGroups.length > 0) hooksObj[event] = keptGroups;
      else delete hooksObj[event]; // event had only HailyKit hooks — drop the event
    }
    if (Object.keys(hooksObj).length === 0) delete s.hooks;
  }

  // `_hailykit` is HailyKit-owned tracking metadata — unambiguously safe to drop.
  if ('_hailykit' in s) delete s._hailykit;

  const tmp = settingsPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, settingsPath);
  return removed;
}

/**
 * Force HailyKit-enforced values into settings.json on install AND upgrade.
 *
 * Each enforced key is OVERWRITTEN to HailyKit's value regardless of any prior
 * user value — installing HailyKit opts into this policy (see
 * `HAILYKIT_ENFORCED_SETTINGS`). A user who re-enables a key manually will have
 * it flipped back on the next upgrade; that is intentional. Idempotent: rewrites
 * only when a value actually differs. No-op on malformed JSON (never rewrites a
 * file it cannot parse). Atomic write via `.tmp` + rename.
 *
 * @param settingsPath - Absolute path to settings.json.
 * @param enforced     - Managed key/value pairs to force-set.
 * @returns Number of keys changed.
 */
export function applyEnforcedSettings(
  settingsPath: string,
  enforced: Readonly<Record<string, unknown>> = HAILYKIT_ENFORCED_SETTINGS,
): number {
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const parsed: unknown = JSON.parse(stripJsonComments(fs.readFileSync(settingsPath, 'utf8')));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return 0;
      settings = parsed as Record<string, unknown>;
    } catch {
      return 0; // malformed — never rewrite a file we can't safely parse
    }
  }

  let changed = 0;
  for (const [key, value] of Object.entries(enforced)) {
    if (settings[key] !== value) { settings[key] = value; changed++; }
  }
  if (changed === 0) return 0; // already enforced — leave the file (and its mtime) alone

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const tmp = settingsPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, settingsPath);
  return changed;
}

/**
 * Merge HailyKit-managed deny rules into settings.json without touching user rules.
 * Never removes existing rules — only union-adds. Rules are written verbatim (no
 * tilde expansion — Claude Code natively supports `~/`; `//` anchors absolute paths).
 * Creates the file (and parent dirs) if absent. Atomic write via `.tmp` + rename.
 *
 * @param settingsPath        - Absolute path to settings.json.
 * @param rules               - Managed rules to add (written verbatim, no path expansion).
 * @param version             - HailyKit version stored in `_hailykit.denyVersion`.
 * @param additionalUserRules - Pre-existing user deny rules to preserve even if settings.json
 *                              was overwritten by copyDir on first install.
 */
export function mergePermissionDeny(
  settingsPath: string,
  rules: readonly string[],
  version: string,
  additionalUserRules: readonly string[] = [],
): void {
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const parsed: unknown = JSON.parse(stripJsonComments(fs.readFileSync(settingsPath, 'utf8')));
      // NOTE: reject non-object JSON (numbers, strings, arrays, null) — treat as empty.
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        settings = parsed as Record<string, unknown>;
      }
    } catch { /* treat corrupt file as empty — overwrite with clean state */ }
  }

  const permissions =
    typeof settings.permissions === 'object' && settings.permissions !== null
      ? { ...(settings.permissions as Record<string, unknown>) }
      : {};
  // Filter to strings only — non-string entries in deny[] would corrupt the security file.
  const existingDeny: string[] = Array.isArray(permissions.deny)
    ? (permissions.deny as unknown[]).filter((r): r is string => typeof r === 'string')
    : [];

  // Union of: file's current deny rules + pre-copy user rules (survives first-install overwrite).
  const safeAdditional = additionalUserRules.filter((r): r is string => typeof r === 'string');
  const allUserRules = [...new Set([...existingDeny, ...safeAdditional])];

  // NOTE: never remove existing deny rules — only union-add. Removal based on _hailykit.deny
  // is vulnerable to injection: an AI agent could write _hailykit.deny with user rules to
  // cause them to be treated as "stale managed" and dropped on the next upgrade.
  const newDeny = [...allUserRules, ...rules.filter(r => !allUserRules.includes(r))];

  settings.permissions = { ...permissions, deny: newDeny };
  // NOTE: _hailykit is a tracking key only — Claude Code ignores unknown top-level keys.
  const prevMeta = typeof settings._hailykit === 'object' && settings._hailykit !== null
    ? (settings._hailykit as Record<string, unknown>)
    : {};
  settings._hailykit = { ...prevMeta, denyVersion: version, deny: [...rules] };

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const tmp = settingsPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, settingsPath);
  console.log(`  Applied ${rules.length} security deny rule(s) to settings.json`);
}

export interface MergeOptions {
  isUpgrade?: boolean;
}

/**
 * Merge the `kit/` catalog from the extracted release into the user's `.claude/`
 * directory. Applies deletions from metadata.json, copies files, then migrates
 * old hook commands.
 *
 * @param extractedRoot   - Repo root inside the extracted release.
 * @param targetClaudeDir - User's .claude/ directory (global or project).
 * @throws When `kit/` does not exist in the extracted release.
 */
export function mergeClaudeDir(
  extractedRoot: string,
  targetClaudeDir: string,
  options: MergeOptions = {},
): ClaudeMetadata {
  const srcKit = path.join(extractedRoot, 'kit');
  if (!fs.existsSync(srcKit)) {
    throw new Error('Catalog directory not found in extracted release (looked for kit/)');
  }

  const meta = readMetadata(srcKit);

  if (meta.deletions?.length) {
    applyDeletions(targetClaudeDir, meta.deletions);
  }

  // Save the user's existing deny rules before copyDir. On first install (skipProtected=false),
  // copyDir copies kit/settings.json over the user's file — their custom deny rules would be
  // lost. We re-inject them via additionalUserRules after the copy.
  const settingsPath = path.join(targetClaudeDir, 'settings.json');
  let preCopyUserDeny: string[] = [];
  if (fs.existsSync(settingsPath)) {
    try {
      const pre: unknown = JSON.parse(stripJsonComments(fs.readFileSync(settingsPath, 'utf8')));
      if (typeof pre === 'object' && pre !== null && !Array.isArray(pre)) {
        const perms = (pre as Record<string, unknown>).permissions;
        if (typeof perms === 'object' && perms !== null) {
          const deny = (perms as Record<string, unknown>).deny;
          if (Array.isArray(deny)) {
            preCopyUserDeny = deny.filter((r): r is string => typeof r === 'string');
          }
        }
      }
    } catch { /* unreadable — nothing to save */ }
  }

  const n = copyDir(srcKit, targetClaudeDir, {
    skipProtected: options.isUpgrade,
    resolveSkillRefsForClaude: true,
    providerName: 'claude',
  });
  console.log(`  Synced ${n} file(s) → ${targetClaudeDir}`);

  // Migrate old hook commands in protected settings.json (runs on both install and upgrade).
  migrateSettings(targetClaudeDir);

  // Apply HailyKit-managed deny rules (runs on both install and upgrade).
  // Pass preCopyUserDeny so rules that survived in the user's file before install are preserved.
  mergePermissionDeny(
    settingsPath,
    HAILYKIT_DENY_RULES,
    meta.version ?? '0.0.0',
    preCopyUserDeny,
  );

  // Force HailyKit-enforced settings on both install and upgrade (overrides prior
  // user value — installing HailyKit opts into this; see HAILYKIT_ENFORCED_SETTINGS).
  const enforced = applyEnforcedSettings(settingsPath);
  if (enforced > 0) {
    console.log(`  Enforced ${enforced} HailyKit setting(s) in settings.json`);
  }

  return meta;
}
