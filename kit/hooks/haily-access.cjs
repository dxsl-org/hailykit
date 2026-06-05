#!/usr/bin/env node
/**
 * haily-access.cjs — PreToolUse hook combining directory access control and
 * sensitive-file protection into a single process with one stdin read.
 *
 * Execution order (if both enabled): directory guard first → privacy check second.
 * If directory guard blocks, privacy check is skipped (tool call is already blocked).
 * Each check respects its own config key independently — one can be disabled without
 * affecting the other.
 *
 * Config keys:
 *   'scout-block'         — directory/glob guard (default: true)
 *   'privacy-block'       — sensitive-file guard (default: true)
 *   'read-scope-warn'     — also warn on Read/Glob/Grep outside CWD (default: false, opt-in)
 *   'privacy-approval-flow' — WARN tier files require AskUserQuestion approval (default: false)
 *
 * Exit codes: 0 = allow | 2 = BLOCK
 *
 * @module haily-access
 */

'use strict';

// Outer crash wrapper — any require() failure exits 0 (fail-open)
try {
  const fs   = require('node:fs');
  const path = require('node:path');
  const { isHookEnabled }                = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { checkScoutBlock }               = require('./haily-lib/directory.cjs');
  const { checkPrivacy, APPROVAL_PREFIX } = require('./haily-lib/sensitive.cjs');

  // Early exit when both guards are disabled — avoid any subprocess overhead
  const guardDir     = isHookEnabled('scout-block');
  const guardPrivacy = isHookEnabled('privacy-block');
  if (!guardDir && !guardPrivacy) process.exit(0);

  async function main() {
    const timer = createHookTimer('haily-access');

    // ── Single stdin read shared by both checks ──────────────────────────────
    let data = {};
    try {
      const raw = fs.readFileSync(0, 'utf8');
      if (!raw || !raw.trim()) {
        timer.end({ status: 'skip', exit: 0, note: 'empty-stdin' });
        process.exit(0);
      }
      data = JSON.parse(raw);
    } catch {
      timer.end({ status: 'skip', exit: 0, note: 'invalid-json' });
      process.exit(0);
    }

    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};
    const cwd = data.cwd || process.cwd();

    // ── Check 1: Directory guard (scout-block) ───────────────────────────────
    if (guardDir) {
      const result = checkScoutBlock({ toolName, toolInput, options: { cwd } });
      if (result.blocked) {
        process.stderr.write((result.message || `[BLOCKED] ${result.pattern}\n`) + '\n');
        timer.end({ status: 'block', exit: 2, check: 'dir', reason: result.reason, pattern: result.pattern });
        process.exit(2);
      }
    }

    // ── Check 2: Sensitive-file guard (privacy-block) ────────────────────────
    if (guardPrivacy) {
      // NOTE: opt-in flags — isHookEnabled returns false when DEFAULT_CONFIG value is false
      const warnReadScope     = isHookEnabled('read-scope-warn');
      const approvalFlowEnabled = isHookEnabled('privacy-approval-flow');

      const result = checkPrivacy(toolInput, toolName, cwd, { warnReadScope });

      switch (result.action) {
        case 'block': {
          process.stderr.write(
            `\x1b[31m[PRIVACY BLOCK]\x1b[0m Access denied: ${result.filePath}\n` +
            `This file type should not be accessed by AI agents.\n` +
            `To disable: set \`"privacy-block": false\` in haily.json hooks.\n`
          );
          timer.end({ status: 'block', exit: 2, check: 'privacy', filePath: result.filePath });
          process.exit(2);
          break;
        }

        case 'warn': {
          // Directory escape / read-scope: informational — always allow.
          if (result.reason === 'directory-escape') {
            process.stderr.write(
              `\x1b[33m[DIR ESCAPE]\x1b[0m Write outside project: ${result.filePath}\n` +
              `Path is outside the current working directory.\n` +
              `To disable: set \`"privacy-block": false\` in haily.json hooks.\n`
            );
            timer.end({ status: 'warn', exit: 0, check: 'privacy', filePath: result.filePath, reason: result.reason });
            process.exit(0);
            break;
          }
          if (result.reason === 'read-scope') {
            process.stderr.write(
              `\x1b[33m[DIR READ]\x1b[0m Read outside project: ${result.filePath}\n` +
              `Path is outside the current working directory.\n` +
              `To disable: set \`"read-scope-warn": false\` in haily.json hooks.\n`
            );
            timer.end({ status: 'warn', exit: 0, check: 'privacy', filePath: result.filePath, reason: result.reason });
            process.exit(0);
            break;
          }

          // Sensitive-file / bash-command warn tier.
          if (approvalFlowEnabled) {
            const filePath = result.filePath || '';
            const basename = path.basename(filePath);
            const approvedPath = APPROVAL_PREFIX + filePath;
            const promptData = {
              type: 'PRIVACY_PROMPT', file: filePath, basename,
              question: {
                header: 'File Access',
                text: `"${basename}" may contain sensitive data (credentials, tokens, history). Allow access?`,
                options: [
                  { label: 'Yes, approve', description: `Allow accessing ${basename}. Retry with path \`${approvedPath}\`` },
                  { label: 'No, skip', description: 'Continue without this file' },
                ],
              },
            };
            process.stderr.write(
              `\x1b[33m[PRIVACY APPROVAL]\x1b[0m Sensitive file requires approval: ${filePath}\n\n` +
              `@@PRIVACY_PROMPT_START@@\n${JSON.stringify(promptData, null, 2)}\n@@PRIVACY_PROMPT_END@@\n\n` +
              `If approved: retry with path \`${approvedPath}\` or run: bash cat "${filePath}"\n` +
              `If declined: continue without this file.\n`
            );
            timer.end({ status: 'approval-required', exit: 2, check: 'privacy', filePath, reason: result.reason });
            process.exit(2);
            break;
          }

          // Default: warn and continue.
          process.stderr.write(
            `\x1b[33m[PRIVACY WARN]\x1b[0m Sensitive file accessed: ${result.filePath}\n` +
            `Review the content before sharing or committing.\n`
          );
          timer.end({ status: 'warn', exit: 0, check: 'privacy', filePath: result.filePath, reason: result.reason });
          process.exit(0);
          break;
        }

        default: {
          // 'allow' or 'approved'
          timer.end({ status: 'allow', exit: 0, check: 'privacy' });
          break;
        }
      }
    }

    // ── Both checks passed ───────────────────────────────────────────────────
    timer.end({ status: 'allow', exit: 0 });
    process.exit(0);
  }

  main().catch((e) => {
    logHookCrash('haily-access', e);
    process.exit(0); // fail-open
  });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-access', e); } catch { /* ignore */ }
  process.exit(0); // fail-open — never block on crash
}
