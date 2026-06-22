#!/usr/bin/env node
/**
 * haily-session.cjs — SessionStart hook that initialises the HL_* env-var contract.
 *
 * Fires on startup|resume|clear|compact. Detects project type, resolves the active
 * plan, writes all 35 HL_* env vars, and emits a context summary to stdout.
 *
 * Config key (isHookEnabled): 'session-init'  ← old name preserved as user config contract
 * Exit codes: 0 always (fail-open, non-blocking)
 *
 * @module haily-session
 */

'use strict';

try {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');

  const {
    isHookEnabled, loadConfig, writeEnv,
    getGitBranch, getGitRoot, resolvePlanPath,
    resolveNamingPattern, getReportsPath, normalizePath, extractTaskListId
  } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { formatModelDisplay } = require('./haily-lib/model.cjs');
  const { detectProject, buildStaticEnv, getCodingLevelStyleName } = require('./haily-lib/project.cjs');
  const { updateSessionState } = require('./haily-lib/session.cjs');
  const { readActivitySnapshot, writeActivitySnapshot, createEmptyActivitySnapshot } = require('./haily-lib/statusline.cjs');
  const { cleanupShadowedSkills, detectAgentTeam, formatTeamContextLine } = require('./haily-lib/cleanup.cjs');
  const { loadState } = require('./haily-lib/state.cjs');

  // NOTE: config key 'session-init' preserved — user-facing contract
  if (!isHookEnabled('session-init')) process.exit(0);

  async function main() {
    const timer = createHookTimer('haily-session');
    let data;
    try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

    const sessionId = data.session_id || '';
    const source = data.source || 'startup';
    // SessionStart is the only hook event that receives `model` — persist it
    // (env + session state) so PreToolUse hooks like haily-tracer can read it.
    const sessionModel = typeof data.model === 'string' ? data.model : (data.model?.id || '');
    const envFile = process.env.CLAUDE_ENV_FILE;
    const baseDir = process.cwd();

    const config = loadConfig();
    const detections = detectProject(baseDir);
    const staticEnv = buildStaticEnv(baseDir);
    const resolved = resolvePlanPath(sessionId, config);
    const gitBranch = staticEnv.gitBranch || getGitBranch() || '';
    const namePattern = resolveNamingPattern(config.plan, gitBranch);
    const reportsPath = getReportsPath(resolved.path, resolved.resolvedBy, config.plan, config.paths, baseDir);
    const codingLevel = config.codingLevel ?? 5;
    const codingLevelStyle = getCodingLevelStyleName(codingLevel);
    const teamInfo = detectAgentTeam(sessionId);
    const taskListId = extractTaskListId(config);

    // ── Write all 35 HL_* env vars ─────────────────────────────────────────
    if (envFile) {
      // Session & Plan Config (6)
      writeEnv(envFile, 'HL_SESSION_ID', sessionId);
      writeEnv(envFile, 'HL_SESSION_MODEL', sessionModel);
      writeEnv(envFile, 'HL_PLAN_NAMING_FORMAT', config.plan?.namingFormat || '{date}-{issue}-{slug}');
      writeEnv(envFile, 'HL_PLAN_DATE_FORMAT', config.plan?.dateFormat || 'YYMMDD-HHmm');
      writeEnv(envFile, 'HL_PLAN_ISSUE_PREFIX', config.plan?.issuePrefix || '');
      writeEnv(envFile, 'HL_PLAN_REPORTS_DIR', config.plan?.reportsDir || 'reports');
      // Naming & Plan Resolution (3)
      writeEnv(envFile, 'HL_NAME_PATTERN', namePattern);
      writeEnv(envFile, 'HL_ACTIVE_PLAN', resolved.resolvedBy === 'session' ? resolved.path : '');
      writeEnv(envFile, 'HL_SUGGESTED_PLAN', resolved.resolvedBy === 'branch' ? resolved.path : '');
      // Claude Tasks (1)
      if (taskListId) writeEnv(envFile, 'CLAUDE_CODE_TASK_LIST_ID', taskListId);
      // Paths (5)
      writeEnv(envFile, 'HL_GIT_ROOT', staticEnv.gitRoot || getGitRoot() || '');
      writeEnv(envFile, 'HL_REPORTS_PATH', reportsPath);
      writeEnv(envFile, 'HL_DOCS_PATH', path.join(baseDir, normalizePath(config.paths?.docs) || 'docs'));
      writeEnv(envFile, 'HL_PLANS_PATH', path.join(baseDir, normalizePath(config.paths?.plans) || '.agents'));
      writeEnv(envFile, 'HL_PROJECT_ROOT', baseDir);
      // Project Detection (3)
      writeEnv(envFile, 'HL_PROJECT_TYPE', detections.type || '');
      writeEnv(envFile, 'HL_PACKAGE_MANAGER', detections.pm || '');
      writeEnv(envFile, 'HL_FRAMEWORK', detections.framework || '');
      // Static Environment (7)
      writeEnv(envFile, 'HL_NODE_VERSION', process.version);
      writeEnv(envFile, 'HL_OS_PLATFORM', process.platform);
      writeEnv(envFile, 'HL_GIT_BRANCH', gitBranch);
      writeEnv(envFile, 'HL_USER', staticEnv.user || process.env.USERNAME || process.env.USER || os.userInfo().username || '');
      writeEnv(envFile, 'HL_LOCALE', staticEnv.locale || process.env.LANG || '');
      writeEnv(envFile, 'HL_TIMEZONE', staticEnv.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      writeEnv(envFile, 'HL_CLAUDE_SETTINGS_DIR', path.resolve(__dirname, '..'));
      // Locale (2, conditional)
      if (config.locale?.thinkingLanguage) writeEnv(envFile, 'HL_THINKING_LANGUAGE', config.locale.thinkingLanguage);
      if (config.locale?.responseLanguage) writeEnv(envFile, 'HL_RESPONSE_LANGUAGE', config.locale.responseLanguage);
      // Plan Validation (4)
      writeEnv(envFile, 'HL_VALIDATION_MODE', config.plan?.validation?.mode || 'prompt');
      writeEnv(envFile, 'HL_VALIDATION_MIN_QUESTIONS', config.plan?.validation?.minQuestions ?? 3);
      writeEnv(envFile, 'HL_VALIDATION_MAX_QUESTIONS', config.plan?.validation?.maxQuestions ?? 8);
      writeEnv(envFile, 'HL_VALIDATION_FOCUS_AREAS', (config.plan?.validation?.focusAreas || []).join(','));
      // Coding Level (2)
      writeEnv(envFile, 'HL_CODING_LEVEL', codingLevel);
      writeEnv(envFile, 'HL_CODING_LEVEL_STYLE', codingLevelStyle);
      // Agent Teams (2, conditional)
      if (teamInfo.isTeamMember) {
        writeEnv(envFile, 'HL_AGENT_TEAM', teamInfo.teamName);
        writeEnv(envFile, 'HL_AGENT_TEAM_MEMBERS', teamInfo.memberCount);
      }
    }

    // ── Update session state ────────────────────────────────────────────────
    updateSessionState(sessionId, (state) => ({
      ...state,
      model: sessionModel || state?.model || null,
      sessionOrigin: source,
      activePlan: resolved.resolvedBy === 'session' ? resolved.path : (state?.activePlan || null),
      suggestedPlan: resolved.resolvedBy === 'branch' ? resolved.path : null,
      gitBranch,
      timestamp: new Date().toISOString(),
      source,
      statusline: state?.statusline || createEmptyActivitySnapshot(),
    }));

    // ── One-time cleanup (Issue #422) ────────────────────────────────────────
    const cleanup = cleanupShadowedSkills();
    if (cleanup.recovered.length > 0) {
      process.stdout.write(`Recovered ${cleanup.recovered.length} shadowed skill(s): ${cleanup.recovered.join(', ')}\n`);
    }

    // ── Compaction recovery output (Issue #277) ──────────────────────────────
    if (source === 'compact') {
      process.stdout.write(`\nWARN: Context was compacted — any pending AskUserQuestion approval gates may have been bypassed.\n`);
      const savedState = loadState(sessionId);
      if (savedState) {
        process.stdout.write(`\n--- Session State (Post-Compaction Recovery) ---\n${savedState}\n--- End Session State ---\n`);
        process.stdout.write('Context was compacted. Above is your last saved progress. Resume from where you left off.\n');
        process.stdout.write('IMPORTANT: Re-read active plan files and todo list. Do NOT re-do completed work.\n');
      }
    } else if (source === 'startup' || source === 'resume') {
      const savedState = loadState(sessionId);
      if (savedState) {
        process.stdout.write(`\n--- Previous Session State ---\n${savedState}\n--- End Session State ---\n`);
        process.stdout.write('Review above state from your last session. Continue where you left off or start fresh.\n');
      }
    }

    // ── Context summary ─────────────────────────────────────────────────────
    const lines = [
      `Session startup. Project: ${detections.type || 'unknown'} | PM: ${detections.pm || 'unknown'}`,
      `Plan naming: ${namePattern} | Root: ${baseDir}`,
    ];
    if (sessionModel) lines.unshift(`🤖 Session starting: ${formatModelDisplay(sessionModel)}`);
    if (teamInfo.isTeamMember) lines.push(formatTeamContextLine(teamInfo));
    if (resolved.path) lines.push(`Active plan: ${resolved.path} (via ${resolved.resolvedBy})`);
    process.stdout.write(lines.join(' | ') + '\n');

    // ── Agent trace instruction (model-tracer) ───────────────────────────────
    // Injected when model-tracer is enabled so Claude self-announces in response
    // text — the only mechanism that renders visibly in the VSCode extension.
    if (isHookEnabled('model-tracer')) {
      try {
        const settingsDir = process.env.HL_CLAUDE_SETTINGS_DIR || path.join(os.homedir(), '.claude');
        const agentDir = path.join(settingsDir, 'agents');
        const agentMap = {};
        if (fs.existsSync(agentDir)) {
          for (const file of fs.readdirSync(agentDir)) {
            if (!file.endsWith('.md')) continue;
            try {
              const content = fs.readFileSync(path.join(agentDir, file), 'utf8');
              const m = content.match(/^model:\s*(.+)$/m);
              // Agents without a model pin inherit the session model — list them
              // too so Claude announces every Agent call, not just pinned ones.
              agentMap[file.replace('.md', '')] = m ? m[1].trim() : 'inherit';
            } catch { /* skip unreadable */ }
          }
        }
        const sessionLabel = sessionModel
          ? `${formatModelDisplay(sessionModel)} (${sessionModel})`
          : 'the session model';
        const mapStr = Object.entries(agentMap).map(([k, v]) => `${k}=${v}`).join(', ');
        const announce = `AGENT TRACE: At the start of your first reply this session, write "🤖 Session starting: ${sessionModel ? formatModelDisplay(sessionModel) : '<your model name>'}" on its own line. `;
        const instruction = announce + (mapStr
          ? `For each Agent tool call, write ⚡ [subagent_type] → [model] on its own line in your response text before the tool call — including when the model equals the session model. inherit = ${sessionLabel}. Model map: ${mapStr}`
          : `For each Agent tool call, write ⚡ [subagent_type] → ${sessionLabel} on its own line in your response text before the tool call.`);
        process.stdout.write(instruction + '\n');
      } catch { /* fail-open — tracer instruction is best-effort */ }
    }

    timer.end({ status: 'ok', exit: 0, source, sessionId: sessionId.slice(0, 8) });
    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-session', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-session', e); } catch { /* ignore */ }
  process.exit(0);
}
