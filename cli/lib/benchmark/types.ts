import type { EvalProvider, EvalTier, EvalUsage, HarnessVariant, RowStatus, ToolPolicyName } from '../reasoning-harness/types';

export type BenchmarkProvider = 'claude' | 'codex';
export type BenchmarkSource = 'benchmark_v2' | 'legacy_reasoning_v1' | 'static' | 'hook';
export type BenchmarkProvenance = 'live' | 'offline-score' | 'dry-run' | 'synthetic';
export type BenchmarkStatus = RowStatus;
export type BenchmarkStatusClass = 'measured' | 'unmeasured';
export type BenchmarkOutcomeLabel = 'pass' | 'fail' | 'inconclusive' | 'not_measured';
export type BenchmarkPairStatus = 'paired' | 'missing_pair' | 'identity_mismatch' | 'unpaired';
export type BenchmarkModelVerificationSource = 'provider_echo' | 'manifest_waiver' | 'legacy_missing' | 'unknown';
export type BenchmarkDecision = 'go' | 'no_go' | 'inconclusive';
export type BenchmarkProviderLabel = EvalProvider | 'static' | 'hook';

export interface BenchmarkFixtureMetadata {
  fixtureId: string;
  fixtureClass: string | null;
  fixtureHash: string;
  promptHash: string;
  treatmentHash: string;
  variant: HarnessVariant | null;
}

export interface InstalledArtifactSnapshotEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export interface InstalledArtifactSnapshot {
  rootDir: string;
  createdAt: string;
  entries: InstalledArtifactSnapshotEntry[];
}

export interface BenchmarkMarginRegistry {
  metric: 'outcomeScore';
  threshold: number;
  exploratoryBatches: number;
  firstDecisionBatch: number;
  frozen: boolean;
  frozenAt: string | null;
  identityHash: string;
}

export interface BenchmarkCalibrationState {
  completedLiveBatches: number;
  firstDecisionBatch: number;
}

export interface BenchmarkTokenMetrics extends EvalUsage {
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  costSource: 'provider' | 'derived' | 'unknown';
}

export interface BenchmarkMetrics {
  outcomeLabel: BenchmarkOutcomeLabel;
  outcomeScore: number | null;
  wallMs: number | null;
  ttftMs: number | null;
  outputBytes: number | null;
  tokens: BenchmarkTokenMetrics;
  contextOccupancy: number | null;
  contextCompactionBytes: number | null;
  toolCalls: number | null;
  toolErrors: number | null;
  toolRetries: number | null;
  approvals: number | null;
  subagentCount: number | null;
  subagentDepth: number | null;
  hookCalls: number | null;
  hookLatencyMs: number | null;
  hookContextBytes: number | null;
}

export interface BenchmarkMeasuredProviderMetrics {
  wallMs: number | null;
  ttftMs: number | null;
  outputBytes: number | null;
  tokens: BenchmarkTokenMetrics;
  contextOccupancy: number | null;
  contextCompactionBytes: number | null;
  toolCalls: number | null;
  toolErrors: number | null;
  toolRetries: number | null;
  approvals: number | null;
  subagentCount: number | null;
  subagentDepth: number | null;
  hookCalls: number | null;
  hookLatencyMs: number | null;
  hookContextBytes: number | null;
}

export interface BenchmarkLegacyFields {
  baselineEligible: boolean | null;
  attemptedComplete: boolean | null;
  actualPolicy: ToolPolicyName | null;
  policySatisfied: boolean | null;
  coverage: number | null;
  hardChecksPassed: number | null;
  hardChecksTotal: number | null;
  finalAnswer: string | null;
  note: string | null;
  commitSha: string | null;
}

export interface BenchmarkManifest {
  v: 2;
  kind: 'benchmark_manifest';
  source: BenchmarkSource;
  provider: BenchmarkProvider | null;
  providerLabel: BenchmarkProviderLabel;
  tier: EvalTier;
  requestedModel: string;
  fixture: BenchmarkFixtureMetadata;
  provenance: BenchmarkProvenance;
  createdAt: string;
  manifestHash: string;
  modelVerificationWaiver: boolean;
  marginRegistry: BenchmarkMarginRegistry;
  calibration: BenchmarkCalibrationState;
  snapshot: InstalledArtifactSnapshot | null;
  legacy: Pick<BenchmarkLegacyFields, 'attemptedComplete' | 'baselineEligible' | 'commitSha'>;
}

export interface BenchmarkObservation {
  v: 2;
  kind: 'benchmark_observation';
  source: BenchmarkSource;
  key: string;
  fixtureId: string;
  repeat: number;
  provider: BenchmarkProvider | null;
  providerLabel: BenchmarkProviderLabel;
  requestedModel: string;
  actualModel: string | null;
  modelSatisfied: boolean;
  modelVerified: boolean;
  modelVerificationSource: BenchmarkModelVerificationSource;
  provenance: BenchmarkProvenance;
  status: BenchmarkStatus;
  statusClass: BenchmarkStatusClass;
  decisionEligible: boolean;
  decisionIneligibleReason: string | null;
  pairId: string | null;
  blockId: string | null;
  arm: string | null;
  pairStatus: BenchmarkPairStatus;
  fixture: BenchmarkFixtureMetadata;
  manifestHash: string;
  metrics: BenchmarkMetrics;
  providerExtensions: Record<string, unknown>;
  legacy: BenchmarkLegacyFields;
}

export interface BenchmarkOutcome {
  v: 2;
  kind: 'benchmark_outcome';
  source: BenchmarkSource;
  decision: BenchmarkDecision;
  reasons: string[];
  observedMeanScore: number | null;
  threshold: number | null;
  comparedRows: number;
}

export type BenchmarkEvent = BenchmarkManifest | BenchmarkObservation | BenchmarkOutcome;
