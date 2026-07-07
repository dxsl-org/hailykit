#!/usr/bin/env node
/**
 * haily-artifact.cjs — UserPromptSubmit/PreToolUse hook that validates
 * review artifacts before ship/push/deploy/commit operations.
 *
 * Detects the workflow stage from the prompt or bash command, resolves the
 * artifact directory, then validates 5 required JSON files exist and pass
 * schema checks. Hard stages (ship/push/pr/deploy) exit 2 on failure;
 * soft stages (commit/finalize) emit a warning and allow through.
 *
 * Config key (isHookEnabled): 'workflow-artifact-gate'
 * Exit codes: 0 = allow | 2 = BLOCK (hard stages only)
 *
 * @module haily-artifact
 */

'use strict';

try {
  const fs = require('node:fs');
  const { isHookEnabled, loadConfig } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { resolveArtifactDir } = require('./haily-artifact/locator.cjs');
  const { detectStage, isHardStage, isSoftStage } = require('./haily-artifact/stage.cjs');
  const { validateArtifacts } = require('./haily-artifact/validator.cjs');

  const GATE_DISABLED_ENV = 'HL_WORKFLOW_ARTIFACT_GATE_DISABLED';

  if (process.env[GATE_DISABLED_ENV] === '1') process.exit(0);

  // Parse CLI flags for manual --stage mode
  const args = process.argv.slice(2);
  const manualMode = args.includes('--stage') || args.includes('--artifact-dir');
  const jsonOutput = args.includes('--json');

  async function main() {
    const timer = createHookTimer('haily-artifact');
    const config = loadConfig({ includeProject: false });
    const gateConfig = config?.workflowArtifactGate || {};

    if (!manualMode && (!isHookEnabled('workflow-artifact-gate') || gateConfig.enabled === false)) {
      process.exit(0);
    }

    let payload = {};
    if (!manualMode) {
      try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
    }

    // Detect stage
    const stage = manualMode
      ? (args[args.indexOf('--stage') + 1] || null)
      : detectStage(payload, gateConfig);

    if (!stage) { timer.end({ status: 'skip', exit: 0 }); process.exit(0); }

    // Resolve artifact directory
    const artifactDirFlag = args.includes('--artifact-dir') ? args[args.indexOf('--artifact-dir') + 1] : null;
    const { artifactDir } = resolveArtifactDir({ artifactDir: artifactDirFlag, env: process.env });

    // NOTE: Absence of an artifact directory in hook mode means the user has not run
    // hc:cook or hc:fix for this change. Presence of a pointer file is the opt-in
    // signal — without it, enforcing the gate would block users who never adopted the
    // pipeline workflow. Manual mode (--stage) always validates.
    // When enforceOnMissing is true the project explicitly requires the pipeline for
    // every push/ship regardless of whether a pointer exists.
    if (!manualMode && !artifactDir) {
      if (gateConfig.enforceOnMissing === true) {
        const reason = 'No review artifacts found. Run hc:cook or hc:fix before shipping. (workflow-artifact-gate.enforceOnMissing=true)';
        process.stdout.write(JSON.stringify({ continue: false, decision: 'block', reason }) + '\n');
        process.stderr.write(`[haily-artifact] BLOCKED (${stage}): enforceOnMissing — no artifact pointer found\n`);
        timer.end({ status: 'block', exit: 2, stage });
        process.exit(2);
      }
      timer.end({ status: 'skip', exit: 0 });
      process.exit(0);
    }

    // Validate artifacts via the validateArtifacts composite — the single
    // source of truth for shape, policy, and evidence-marker rules (reading
    // artifacts and re-deriving hard/soft logic here duplicated and drifted
    // from validator.cjs; that drift is what caused the fail-open bug this
    // fixes). Manual mode (--stage) always applies hard-stage strictness —
    // CLI/test invocations expect a full pass/fail signal, never a silently
    // downgraded warning — by forcing `stage` into the hard set for this call.
    const effectiveConfig = manualMode
      ? { ...gateConfig, hardStages: Array.from(new Set([...(gateConfig.hardStages || ['ship', 'push', 'pr', 'deploy']), stage])) }
      : gateConfig;
    const hard = isHardStage(stage, effectiveConfig);
    const result = validateArtifacts({ artifactDir, stage, config: effectiveConfig });
    const toText = (issue) => `${issue.message}${issue.file ? ` (${issue.file}${issue.field ? '.' + issue.field : ''})` : ''}`;
    // Soft stages never block regardless of severity (existing contract) — fold
    // warnings in for reporting so a soft-stage issue still surfaces to the user.
    const allIssues = hard ? result.errors : [...result.errors, ...result.warnings];
    const hasErrors = allIssues.length > 0;

    if (!hasErrors) {
      const msg = `Review artifacts validated for stage: ${stage}`;
      if (jsonOutput) { process.stdout.write(JSON.stringify({ status: 'ok', stage }) + '\n'); }
      else {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg }
        }) + '\n');
      }
      timer.end({ status: 'ok', exit: 0, stage });
      process.exit(0);
    }

    const messages = allIssues.map(toText);
    const summary = `Artifact gate (${stage}): ${messages.length} issue(s):\n${messages.slice(0, 5).join('\n')}`;

    if (hard) {
      if (jsonOutput) { process.stdout.write(JSON.stringify({ status: 'block', stage, errors: allIssues }) + '\n'); }
      else {
        // NOTE: Both JSON block and exit 2 — belt-and-suspenders for hard stages
        process.stdout.write(JSON.stringify({ continue: false, decision: 'block', reason: summary }) + '\n');
      }
      process.stderr.write(`[haily-artifact] BLOCKED (${stage}): ${messages[0]}\n`);
      timer.end({ status: 'block', exit: 2, stage, errorCount: allIssues.length });
      process.exit(2);
    }

    // Soft stage — warn but allow
    const warnMsg = `Soft-stage (${stage}) artifact warning: ${messages[0]}`;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: warnMsg }
    }) + '\n');
    timer.end({ status: 'warn', exit: 0, stage, errorCount: allIssues.length });
    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-artifact', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-artifact', e); } catch { /* ignore */ }
  process.exit(0);
}
