/**
 * Shared types for cross-model review. A cross review sends a plan or diff to an
 * external AI CLI whose resolved provider differs from the session's, so the
 * reviewer model is never the author model. All findings are advisory — the
 * session model adjudicates; nothing here blocks or edits. Leaf module.
 */

export type Severity = 'critical' | 'medium' | 'low';

/** The external CLIs the detection ladder walks, in priority order. */
export type LegName = 'codex' | 'gemini' | 'opencode' | 'cline' | 'ollama';

export const LADDER: readonly LegName[] = ['codex', 'gemini', 'opencode', 'cline', 'ollama'];

export type Stage = 'plan' | 'code';

export interface Finding {
  severity: Severity;
  /** Repo-relative file the finding anchors to, when the reviewer named one. */
  file?: string;
  line?: number;
  summary: string;
  /** Reviewer's supporting detail, when present. */
  evidence?: string;
}

/** Who performed the review, for provenance in the report. */
export interface Reviewer {
  cli: LegName;
  model: string;
  /** Canonical provider actually behind the model (anthropic, openai, …). */
  provider: string;
}

export interface CrossReviewResult {
  reviewer?: Reviewer;
  findings: Finding[];
  /** Present when no eligible reviewer ran; findings is then empty. */
  skipped?: { reason: string };
  /** Reviewer output that could not be parsed into findings, kept verbatim. */
  raw?: string;
}

/** `.hl.json` → `crossReview` block. Every field is an optional override. */
export interface CrossReviewConfig {
  /** Always run even without the skill flag. Consumed by skills, not this tool. */
  auto?: boolean;
  /** Force a specific reviewer leg instead of walking the ladder. */
  reviewer?: LegName;
  /** Force the reviewer model (overrides the model-map lookup). */
  model?: string;
  /** Model tier to resolve from the map (default: thinking). */
  tier?: 'fast' | 'medium' | 'thinking' | 'ultra';
  /** Turn the whole feature off for this repo. */
  disable?: boolean;
  /** Per-call timeout in ms (default 120000). */
  timeoutMs?: number;
}

/** A leg resolved to a concrete, provider-different reviewer ready to invoke. */
export interface ResolvedLeg {
  cli: LegName;
  model: string;
  provider: string;
}
