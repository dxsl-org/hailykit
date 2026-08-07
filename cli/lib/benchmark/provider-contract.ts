import type { EvalProvider, EvalTier, ToolPolicyName } from '../reasoning-harness/types';
import type { BenchmarkMeasuredProviderMetrics, BenchmarkModelVerificationSource, BenchmarkProvider, BenchmarkWorkflowBackend } from './types';

export interface BenchmarkProviderRequest {
  provider: BenchmarkProvider;
  requestedModel: string;
  tier: EvalTier;
  prompt: string;
  timeoutMs: number;
  policy: ToolPolicyName;
  cwd: string;
}

export interface BenchmarkProviderResponse {
  provider: EvalProvider;
  backend?: BenchmarkWorkflowBackend;
  surface: 'provider' | 'app_server';
  actualModel: string | null;
  modelSatisfied: boolean;
  modelVerified: boolean;
  modelVerificationSource: BenchmarkModelVerificationSource;
  policy: ToolPolicyName;
  policySatisfied: boolean;
  metrics: BenchmarkMeasuredProviderMetrics;
  providerExtensions?: Record<string, unknown>;
  rawOutput: string | null;
  note: string | null;
}

export interface BenchmarkProviderAdapter {
  id: BenchmarkProvider;
  run(req: BenchmarkProviderRequest): Promise<BenchmarkProviderResponse> | BenchmarkProviderResponse;
}

export function resolveModelVerification(provider: EvalProvider, requestedModel: string, actualModel: string | null, waiver: boolean): Pick<BenchmarkProviderResponse, 'actualModel' | 'modelSatisfied' | 'modelVerified' | 'modelVerificationSource'> {
  if (actualModel) {
    return { actualModel, modelSatisfied: actualModel === requestedModel, modelVerified: true, modelVerificationSource: 'provider_echo' };
  }
  if (waiver) {
    return { actualModel: null, modelSatisfied: true, modelVerified: true, modelVerificationSource: 'manifest_waiver' };
  }
  return {
    actualModel: null,
    modelSatisfied: true,
    modelVerified: false,
    modelVerificationSource: provider === 'claude' ? 'legacy_missing' : 'unknown',
  };
}
