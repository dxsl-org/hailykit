export type FixtureClass =
  | 'framing_trap'
  | 'discriminating_test_trap'
  | 'exact_constraint_trap'
  | 'evidence_trap'
  | 'escalation_trap'
  | 'rollback_trap';

export type Verdict = 'pass' | 'fail';
export type ToolCapability = 'read_repo' | 'write_repo' | 'network' | 'spawn_agent' | 'escalated_fs';
export type ToolPolicyName = 'none' | 'read_only';
export type CriticalFlag =
  | 'prompt_echo'
  | 'malformed_json'
  | 'unknown_field'
  | 'missing_evidence'
  | 'unsafe_tool_policy'
  | 'unsafe_escalation'
  | 'missed_rollback'
  | 'failed_hard_check';
export type HardCheckKind =
  | 'verdict_matches'
  | 'summary_contains_all'
  | 'evidence_keys_present'
  | 'evidence_value_contains'
  | 'escalation_requested'
  | 'rollback_required';

export interface HardCheck {
  id: string;
  kind: HardCheckKind;
  phrases?: string[];
  keys?: string[];
  key?: string;
  value?: boolean;
}

export interface ToolPolicySpec {
  policy: ToolPolicyName;
  allowed: ToolCapability[];
  forbidden: ToolCapability[];
}

export interface ReasoningFixture {
  id: string;
  class: FixtureClass;
  prompt: string;
  allowed_tools: ToolPolicySpec;
  expected_verdict: Verdict;
  decisive_evidence_keys: string[];
  hard_checks: HardCheck[];
  critical_failure_flags: CriticalFlag[];
  scoring_weights: Record<'verdict' | 'evidence' | 'checks' | 'safety', number>;
}

export interface FixtureAnswer {
  verdict: Verdict;
  summary: string;
  evidence: Record<string, string>;
  escalation: { requested: boolean; justification: string | null };
  rollback: { required: boolean; scope: string[] };
}

export interface ProviderPolicy {
  id: string;
  enforced: ToolPolicyName;
  capabilities: ToolCapability[];
}

export interface EvaluationResult {
  accepted: boolean;
  score: number;
  triggeredFlags: CriticalFlag[];
  failedChecks: string[];
}

export type HarnessVariant = 'none' | 'legacy' | 'ultra-baseline' | 'proposed' | 'proposed-compressed' | 'full-injection' | 'econ-only' | 'full-minus-econ';
export type EvalProvider = 'codex' | 'gemini' | 'ollama';
export type EvalTier = 'fast' | 'medium' | 'thinking' | 'ultra';
export type RowStatus =
  | 'success'
  | 'dry_run'
  | 'unavailable_cli'
  | 'auth_failure'
  | 'timeout'
  | 'non_zero_exit'
  | 'empty_output'
  | 'parse_failure'
  | 'truncation'
  /** The runner refused to persist the output (prompt echo or secret match) — not a model score. */
  | 'scan_rejected'
  | 'model_mismatch'
  | 'incomplete';

export interface VariantSpec {
  name: HarnessVariant;
  tier: EvalTier;
  thinkSection: string;
  reasonSection: string;
  description: string;
}

export interface EvalUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
}

export type {
  RunnerManifest, RunnerRow, RunnerArtifacts, OfflineScoreEntry, RunnerOptions,
} from './runner-types';
