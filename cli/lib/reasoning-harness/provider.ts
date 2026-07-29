import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ToolResult } from '../spawn';
import { parseAnswer } from './fixtures';
import { stableStringify } from './hash';
import { getAdapter, type ProviderExecution } from './providers';
import type { EvalProvider, EvalUsage, ReasoningFixture, RowStatus, ToolPolicyName } from './types';

const MAX_OUTPUT_BYTES = 64 * 1024;

/** Prompt text must state the policy the runner actually enforces — a `none` row that
 *  advertises repo access would score a hallucinated file citation as legitimate. */
const POLICY_TEXT: Record<ToolPolicyName, string> = {
  none: 'Tool policy: no tools, no repo access, no network. Answer only from the text in this prompt.',
  read_only: 'Tool policy: read-only repo access only; no approvals, no writes, no extra tools.',
};

export interface PromptBundle {
  prelude: string;
  policy: string;
  instruction: string;
  fixturePrompt: string;
  full: string;
}

export interface ProviderOutcome {
  status: RowStatus;
  finalAnswer: string | null;
  modelId: string | null;
  actualPolicy: ToolPolicyName;
  usage: EvalUsage;
  latencyMs: number | null;
  note: string | null;
  outputBytes: number;
}

export interface ProviderRequest {
  provider: EvalProvider;
  prompt: string;
  requestedModel: string;
  timeoutMs: number;
  /** Repo root. Stays the planted-binary deny root even when execution runs elsewhere. */
  cwd: string;
  /** Policy this row must actually run under, not merely claim in the prompt. */
  policy: ToolPolicyName;
}

export interface LiveProviderDeps {
  clock?: () => number;
  runner?: (req: ProviderExecution) => ToolResult | Promise<ToolResult>;
}

/**
 * The envelope shape is stated in full, including the required evidence keys, so a score
 * reflects reasoning rather than schema guesswork — a weak model that must infer key names
 * fails on format before its verdict is ever measured. Naming the keys does not leak the
 * answer: the hard checks still test the verdict and the content of each evidence value.
 * Identical across variants, so it cannot bias the harness-versus-no-harness comparison.
 */
function buildInstruction(fixture: ReasoningFixture): string {
  return [
    'Reply with exactly one JSON object and nothing else. No prose, no markdown fence.',
    'Required shape:',
    '  "verdict": "pass" or "fail"',
    '  "summary": string',
    `  "evidence": object whose keys are exactly ${fixture.decisive_evidence_keys.map((key) => `"${key}"`).join(', ')}, each mapped to a non-empty string`,
    '  "escalation": object with "requested" (boolean) and "justification" (string or null)',
    '  "rollback": object with "required" (boolean) and "scope" (array of strings)',
    'Add no other keys. Do not reveal chain-of-thought or hidden reasoning.',
    'Do not echo the prompt, prelude, policy, or instructions.',
  ].join('\n');
}

export function buildPromptBundle(fixture: ReasoningFixture, prelude: string): PromptBundle {
  const policy = POLICY_TEXT[fixture.allowed_tools.policy];
  const instruction = buildInstruction(fixture);
  const full = [prelude, policy, instruction, fixture.prompt].filter(Boolean).join('\n\n');
  return { prelude, policy, instruction, fixturePrompt: fixture.prompt, full };
}

/**
 * Identity of the prompt template itself. Without this in the manifest, editing the
 * instruction text would silently change what a baseline measured while the run still
 * resumed against, and compared with, rows captured under the old wording.
 */
export function promptTemplateHash(fixtures: ReasoningFixture[]): string {
  return stableStringify({ policy: POLICY_TEXT, instructions: fixtures.map((fixture) => buildInstruction(fixture)) });
}

/**
 * Run one fixture against the provider under the row's declared tool policy.
 * A `none` row executes in a fresh empty directory so the model genuinely has no
 * repo to read; the directory is removed before this returns, pass or fail.
 */
export async function runLiveProvider(fixture: ReasoningFixture, req: ProviderRequest, deps: LiveProviderDeps = {}): Promise<ProviderOutcome> {
  const workspaceCwd = req.policy === 'none' ? fs.mkdtempSync(path.join(os.tmpdir(), 'reasoning-eval-noaccess-')) : req.cwd;
  try {
    return await execute(fixture, { ...req, workspaceCwd }, deps);
  } finally {
    // Cleanup must never replace the outcome. A throw from `finally` discards the value the
    // try block produced, and Windows raises EPERM here whenever the child still holds a handle
    // on the directory — which recorded a completed measurement as a model `parse_failure`,
    // scored zero, and counted it. A leaked directory under the OS temp root is harmless by
    // comparison; losing the measurement is not.
    if (workspaceCwd !== req.cwd) {
      try { fs.rmSync(workspaceCwd, { recursive: true, force: true }); } catch { /* the OS reclaims it */ }
    }
  }
}

async function execute(fixture: ReasoningFixture, req: ProviderExecution, deps: LiveProviderDeps): Promise<ProviderOutcome> {
  const adapter = getAdapter(req.provider);
  const actualPolicy = adapter.enforcedPolicy(req.policy);
  const now = deps.clock ?? Date.now;
  const start = now();
  const res = await (deps.runner ?? adapter.run)(req);
  const latencyMs = Math.max(0, now() - start);
  const fail = (status: RowStatus, note: string, outputBytes = 0): ProviderOutcome =>
    ({ status, finalAnswer: null, modelId: null, actualPolicy, usage: emptyUsage(), latencyMs, note, outputBytes });
  const raw = res.stdout.trim();
  const stderr = res.stderr.trim();
  if (res.error === 'tool_not_found' || res.error === 'blocked_in_tree') return fail('unavailable_cli', `provider CLI unavailable: ${excerpt(stderr)}`);
  if (res.error === 'spawn_failed') return fail('timeout', `provider execution failed or exceeded ${req.timeoutMs}ms: ${excerpt(stderr)}`);
  if (!raw) return fail(looksAuthFailure(stderr) ? 'auth_failure' : (res.status ?? 0) !== 0 ? 'non_zero_exit' : 'empty_output', `provider produced no output: ${excerpt(stderr)}`);
  if (Buffer.byteLength(raw, 'utf8') > MAX_OUTPUT_BYTES) return fail('truncation', `provider output exceeded ${MAX_OUTPUT_BYTES} bytes`, MAX_OUTPUT_BYTES);
  // Parse before classifying a refusal. A fixture about credentials or scope makes the model
  // legitimately write words like "unauthorized" or "api key" INTO its answer, so scanning raw
  // stdout ahead of the parse misread valid answers as quota refusals.
  const parsed = adapter.parse(raw);
  if (!parsed.answer) {
    if (looksAuthFailure(`${stderr}\n${raw}`)) return fail('auth_failure', `provider auth or quota refusal: ${excerpt(stderr || raw)}`);
    return fail((res.status ?? 0) === 0 ? 'parse_failure' : 'non_zero_exit', `provider exited ${res.status} without parseable final JSON`, Buffer.byteLength(raw, 'utf8'));
  }
  try { parseAnswer(parsed.answer, fixture.prompt); } catch (error) { return fail('parse_failure', String((error as Error).message), Buffer.byteLength(parsed.answer, 'utf8')); }
  const base = { finalAnswer: parsed.answer, modelId: parsed.modelId, actualPolicy, usage: parsed.usage, latencyMs, outputBytes: Buffer.byteLength(parsed.answer, 'utf8') };
  if (parsed.modelId && parsed.modelId !== req.requestedModel) {
    return { ...base, status: 'model_mismatch', note: `model mismatch: wanted ${req.requestedModel}, got ${parsed.modelId}` };
  }
  return { ...base, status: 'success', note: null };
}

/**
 * Length-capped diagnostic line. Prefers a line that looks like a failure over the first
 * line present, because CLIs open with benign preamble — the gemini CLI always prints
 * "Loaded cached credentials." first, which masked a real "you have exhausted your capacity"
 * message behind a note that read "provider produced no output".
 */
function excerpt(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  // Two tiers, because the specific cause rarely comes first. "Error when talking to Gemini
  // API" matches any generic error pattern while saying nothing; the line after it carries
  // the quota and its reset time. Named causes win over the generic banner.
  const cause = /exhaust|quota|capacity|rate limit|usage limit|unauthor|forbidden|api key|denied|not found|unexpected argument|invalid/i;
  const generic = /error|fail|refus/i;
  const pick = lines.find((line) => cause.test(line)) ?? lines.find((line) => generic.test(line)) ?? lines[0];
  return pick?.slice(0, 200) ?? 'no diagnostic output';
}

/**
 * Provider-side refusals that mean "the call never reached the model", so the cell was not
 * measured. Capacity and quota wording is included because a provider that has run out is
 * an environment fault, not a model answering badly — misfiling it as a non-zero exit is
 * what made an exhausted quota look like an unexplained empty response.
 */
function looksAuthFailure(text: string): boolean {
  return /unauthorized|forbidden|api key|please (?:log|sign) in|authentication failed|usage limit|rate limit|quota|exhausted (?:your )?capacity|resource[_ ]exhausted|insufficient[_ ]quota/i.test(text);
}

function emptyUsage(): EvalUsage {
  return { inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null };
}

export type { ProviderExecution };
