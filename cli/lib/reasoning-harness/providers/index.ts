import type { ToolResult } from '../../spawn';
import type { EvalProvider, EvalUsage, ToolPolicyName } from '../types';
import { codexAdapter } from './codex';
import { geminiAdapter } from './gemini';
import { ollamaAdapter } from './ollama';

export interface ProviderExecution {
  provider: EvalProvider;
  prompt: string;
  requestedModel: string;
  timeoutMs: number;
  /** Repo root. Stays the planted-binary deny root even when execution runs elsewhere. */
  cwd: string;
  /** Policy this row must actually run under, not merely claim in the prompt. */
  policy: ToolPolicyName;
  /** Resolved sandbox root — an empty throwaway directory for `none` rows. */
  workspaceCwd: string;
}

export interface ParsedOutput {
  answer: string | null;
  modelId: string | null;
  usage: EvalUsage;
}

export interface ProviderAdapter {
  id: EvalProvider;
  /**
   * The policy this adapter actually achieves for a requested policy. Returning a
   * *less* permissive policy than requested is allowed and safe; returning a more
   * permissive one fails the row's `policySatisfied` check. Each implementation
   * documents the enforcement mechanism.
   */
  enforcedPolicy(requested: ToolPolicyName): ToolPolicyName;
  run(req: ProviderExecution): ToolResult | Promise<ToolResult>;
  parse(stdout: string): ParsedOutput;
}

const ADAPTERS: Record<EvalProvider, ProviderAdapter> = {
  codex: codexAdapter,
  gemini: geminiAdapter,
  ollama: ollamaAdapter,
};

export function getAdapter(provider: EvalProvider): ProviderAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`unknown eval provider: ${provider}`);
  return adapter;
}
