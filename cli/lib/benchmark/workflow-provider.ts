import { getAdapter, type ProviderExecution } from '../reasoning-harness/providers';
import { sha256, stableStringify } from '../reasoning-harness/hash';
import { runTool } from '../spawn';
import type { ToolResult } from '../spawn';
import type { BenchmarkProviderResponse } from './provider-contract';
import type { WorkflowTrialRequest } from './workflow-runner';
import type { ResolvedWorkflowManifest } from './treatment-manifest';

type ProviderPreflightManifest = Pick<ResolvedWorkflowManifest,
  'provider' | 'tier' | 'requestedModel' | 'policy' | 'cliVersion' | 'configSnapshotHash'>;

export function expectedWorkflowProviderConfigHash(manifest: ProviderPreflightManifest): string {
  const providerConfig = manifest.provider === 'codex'
    ? { approval: 'never', sandbox: 'read-only', userConfig: 'ignored', rules: 'ignored', session: 'ephemeral' }
    : { settings: '{}', strictMcpConfig: true, deniedCapabilities: ['shell', 'write', 'web', 'subagent'] };
  return sha256(stableStringify({
    provider: manifest.provider,
    tier: manifest.tier,
    requestedModel: manifest.requestedModel,
    policy: manifest.policy,
    treatmentInjection: 'manifest-files',
    providerConfig,
  }));
}

export function assertWorkflowProviderPreflight(repoRoot: string, manifest: ProviderPreflightManifest): void {
  const version = runTool(manifest.provider, ['--version'], { cwd: repoRoot, denyRoot: repoRoot, timeoutMs: 10_000 });
  if (!version.ok || version.status !== 0) throw new Error(`provider ${manifest.provider} CLI version check failed`);
  if (version.stdout.trim() !== manifest.cliVersion) throw new Error(`provider ${manifest.provider} CLI version does not match manifest.cliVersion`);
  if (manifest.configSnapshotHash !== expectedWorkflowProviderConfigHash(manifest)) {
    throw new Error('provider configuration does not match manifest.configSnapshotHash');
  }
}

export async function runLiveWorkflowProvider(request: WorkflowTrialRequest): Promise<BenchmarkProviderResponse> {
  if (!request.prompt) throw new Error('live workflow trial requires a prompt');
  const adapter = getAdapter(request.manifest.provider);
  const policy = adapter.enforcedPolicy('read_only');
  if (policy !== 'read_only') throw new Error(`provider ${adapter.id} cannot enforce read_only policy`);
  const execution: ProviderExecution = {
    provider: request.manifest.provider, prompt: request.prompt, requestedModel: request.manifest.requestedModel,
    timeoutMs: Math.max(1, Math.floor(request.remainingBudget.wallMs)), cwd: request.cwd, workspaceCwd: request.cwd, policy: 'read_only',
  };
  const started = Date.now();
  const result = await adapter.run(execution);
  const wallMs = Math.max(0, Date.now() - started);
  assertProviderSucceeded(result, adapter.diagnose?.(result) ?? null);
  const outputBytes = Buffer.byteLength(result.stdout, 'utf8');
  if (outputBytes > request.remainingBudget.outputBytes) throw new Error('live budget maxOutputBytes exceeded by provider response');
  const parsed = adapter.parse(result.stdout);
  const extended = extractExtendedUsage(result.stdout);
  const events = extractEventMetrics(result.stdout, request.manifest.provider);
  return {
    provider: request.manifest.provider, surface: 'provider', actualModel: parsed.modelId,
    modelSatisfied: parsed.modelId === null || parsed.modelId === request.manifest.requestedModel,
    modelVerified: parsed.modelId !== null, modelVerificationSource: parsed.modelId ? 'provider_echo' : 'unknown',
    policy, policySatisfied: true, rawOutput: result.stdout, note: null,
    metrics: {
      wallMs, ttftMs: null, outputBytes,
      tokens: { ...parsed.usage, ...extended, costSource: parsed.usage.totalTokens !== null || parsed.usage.costUsd !== null || extended.reasoningTokens !== null ? 'provider' : 'unknown' },
      contextOccupancy: null, contextCompactionBytes: null, toolCalls: events.toolCalls, toolErrors: events.toolErrors, toolRetries: null,
      approvals: 0, subagentCount: events.subagentCount, subagentDepth: events.subagentDepth, hookCalls: null, hookLatencyMs: null, hookContextBytes: null,
    },
  };
}

function assertProviderSucceeded(result: ToolResult, diagnostic: string | null): void {
  if (result.error === 'tool_not_found' || result.error === 'blocked_in_tree') throw new Error('provider CLI is unavailable');
  if (result.error === 'spawn_failed') throw new Error('provider timeout or spawn failure');
  if ((result.status ?? 1) !== 0) throw new Error(excerpt(diagnostic || result.stderr || result.stdout || `provider exited ${result.status}`));
  if (!result.stdout.trim()) throw new Error('provider returned empty output');
}
function excerpt(value: string): string { return value.replace(/\s+/g, ' ').trim().slice(0, 200); }

function extractExtendedUsage(stdout: string): { cacheReadTokens: number | null; cacheWriteTokens: number | null; reasoningTokens: number | null } {
  const records = stdout.split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  if (!records.length) { try { records.push(JSON.parse(stdout)); } catch { /* provider output can be non-JSON */ } }
  return {
    cacheReadTokens: findNumber(records, ['cache_read_input_tokens', 'cached_input_tokens', 'cacheReadTokens']),
    cacheWriteTokens: findNumber(records, ['cache_creation_input_tokens', 'cache_write_input_tokens', 'cacheWriteTokens']),
    reasoningTokens: findNumber(records, ['reasoning_tokens', 'reasoningTokens']),
  };
}
function findNumber(values: unknown[], keys: string[]): number | null { for (const value of [...values].reverse()) { const found = walkNumber(value, keys); if (found !== null) return found; } return null; }
function walkNumber(value: unknown, keys: string[]): number | null { if (!value || typeof value !== 'object') return null; for (const [key, child] of Object.entries(value as Record<string, unknown>)) { if (keys.includes(key) && typeof child === 'number' && Number.isFinite(child) && child >= 0) return child; const nested = walkNumber(child, keys); if (nested !== null) return nested; } return null; }

function extractEventMetrics(stdout: string, provider: 'claude' | 'codex'): { toolCalls: number | null; toolErrors: number | null; subagentCount: number | null; subagentDepth: number | null } {
  if (provider !== 'codex') return { toolCalls: null, toolErrors: null, subagentCount: null, subagentDepth: null };
  const objects = stdout.split('\n').flatMap((line) => { try { return flatten(JSON.parse(line)); } catch { return []; } });
  const toolTypes = /command|tool|file_change|web_search|mcp/i;
  const tools = objects.filter((record) => typeof record.type === 'string' && toolTypes.test(record.type) && !/agent_message|reasoning/i.test(record.type));
  const agents = objects.filter((record) => typeof record.type === 'string' && /subagent|collab_agent/i.test(record.type));
  const depths = agents.flatMap((record) => typeof record.depth === 'number' && record.depth >= 0 ? [record.depth] : []);
  return { toolCalls: tools.length, toolErrors: tools.filter((record) => /fail|error/i.test(String(record.status ?? ''))).length, subagentCount: agents.length, subagentDepth: depths.length ? Math.max(...depths) : agents.length ? 1 : 0 };
}
function flatten(value: unknown): Record<string, unknown>[] { if (!value || typeof value !== 'object') return []; const record = value as Record<string, unknown>; return [record, ...Object.values(record).flatMap(flatten)]; }
