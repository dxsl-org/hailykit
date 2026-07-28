import type { EvalProvider, EvalTier, EvalUsage, HarnessVariant, RowStatus, ToolPolicyName, CriticalFlag } from './types';

export interface RunnerManifest {
  v: 1;
  kind: 'manifest';
  provider: EvalProvider;
  tier: EvalTier;
  requestedModel: string;
  variant: HarnessVariant;
  repeats: number;
  commitSha: string | null;
  fixtureDir: string;
  fixtureIds: string[];
  fixtureHash: string;
  variantHash: string;
  manifestHash: string;
  expectedKeys: string[];
  createdAt: string;
  executionMode: 'live' | 'dry-run' | 'offline-score';
  offlineSourceHash: string | null;
  approvedOfflineSource: string | null;
  live: boolean;
  dryRun: boolean;
  offlineScorePath: string | null;
}

export interface RunnerRow {
  v: 1;
  kind: 'row';
  key: string;
  fixtureId: string;
  repeat: number;
  provider: EvalProvider;
  tier: EvalTier;
  variant: HarnessVariant;
  requestedModel: string;
  modelId: string | null;
  actualPolicy: ToolPolicyName;
  policySatisfied: boolean;
  modelSatisfied: boolean;
  baselineEligible: boolean;
  commitSha: string | null;
  fixtureHash: string;
  variantHash: string;
  manifestHash: string;
  status: RowStatus;
  hardChecksPassed: number;
  hardChecksTotal: number;
  weightedScore: number | null;
  coverage: number;
  outputBytes: number;
  latencyMs: number | null;
  usage: EvalUsage;
  triggeredFlags: CriticalFlag[];
  failedChecks: string[];
  finalAnswer: string | null;
  note: string | null;
}

export interface RunnerArtifacts {
  manifest: RunnerManifest;
  rows: RunnerRow[];
  summaryMarkdown: string;
  attemptedComplete: boolean;
  baselineEligible: boolean;
}

export interface OfflineScoreEntry {
  fixtureId: string;
  repeat?: number;
  raw: string;
  modelId?: string | null;
  latencyMs?: number | null;
  actualPolicy?: ToolPolicyName;
  usage?: Partial<EvalUsage> | null;
}

export interface RunnerOptions {
  cwd: string;
  fixtures: string;
  out: string;
  provider: EvalProvider;
  tier: EvalTier;
  variant: HarnessVariant;
  repeats: number;
  /** Overrides the tier's `kit/model-map.json` entry when the mapped model is not installed. */
  model?: string;
  timeoutMs?: number;
  live: boolean;
  dryRun: boolean;
  offlineScorePath?: string;
  approvedOfflineSource?: string;
  trustPhrases?: string[];
}
