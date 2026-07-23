/**
 * Shared TypeScript mirror of the Python engine's schema v1
 * (`cli/tools/ocr/job_config.py`, `manifest.py`, `batch.py`). Field names are
 * locked to the Python side — do not rename without updating both. Leaf
 * module (no imports beyond nothing).
 */

/** One `providers` entry — an adapter binding a tier can point to via
 *  `tier_provider`. Only `kind`, `model`, `api_key_env`, `base_url`, and
 *  `command` are ever accepted — an inline key VALUE (`api_key`/`key`/
 *  `apikey`) is never a recognized field and is dropped by `config.ts`'s
 *  sanitizer, never forwarded to the job JSON the Python engine reads. */
export interface OcrProviderEntry {
  kind: 'gemini' | 'openai' | 'cli';
  /** Model name/id passed to the adapter (Gemini/OpenAI model, or the
   *  `{model}` placeholder value for a `cli` command template). */
  model?: string;
  /** Name of the environment variable holding the API key — NEVER the key
   *  value itself. Read by the Python engine via `os.environ`. */
  api_key_env?: string;
  /** OpenAI-compatible base URL (`kind: "openai"` only). A user-configured
   *  egress endpoint — page images are sent there; not validated/blocked. */
  base_url?: string;
  /** Argv template for `kind: "cli"` — `{model}`/`{prompt}`/`{image}`
   *  placeholders substituted per call, run with `shell=False`. */
  command?: string[];
}

/** Maps escalation tiers to a `providers` entry name. Absent/empty means
 *  every tier uses native Gemini with `models.flash`/`models.pro` — the
 *  pre-provider-abstraction default, unchanged. */
export interface OcrTierProvider {
  flash?: string;
  pro?: string;
}

/** Config block accepted inside a job file's `config` key. Snake_case keys
 *  are intentional: this object is serialized verbatim into the job JSON
 *  the Python engine reads, so there is no translation layer to keep in sync. */
export interface OcrJobConfig {
  blur_min?: number;
  escalate_below_grade?: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  route_tables_to_vlm?: boolean;
  models?: { flash?: string; pro?: string };
  max_tier?: 'local' | 'flash' | 'pro';
  ocr_lang?: string[];
  long_edge_min?: number;
  /** Gemini requests-per-minute throttle (consumed by phase 2's client). */
  rpm?: number;
  /** Named VLM adapters a tier can be routed to (see `OcrProviderEntry`). */
  providers?: Record<string, OcrProviderEntry>;
  /** Which named `providers` entry each tier resolves to (see `OcrTierProvider`). */
  tier_provider?: OcrTierProvider;
  /** Forward-compat no-op today (phase 1 engine ignores unknown keys and
   *  already resumes naturally from an existing manifest); phase 3's batch
   *  runner reads this to decide retry-vs-skip semantics explicitly. */
  resume?: boolean;
  /** Phase 6: submit flagged pages as async Gemini Batch jobs (50% cost)
   *  instead of calling flash/pro synchronously. Mutually exclusive with the
   *  sync escalation path per run — this flag wins when both could apply. */
  batch_api?: boolean;
  /** Phase 6: poll/collect outstanding batch jobs for this input/output
   *  instead of running the local+escalation pipeline at all. */
  collect?: boolean;
}

/** The job file written to a temp path and passed to the engine via `--job`. */
export interface OcrJob {
  input: string;
  output: string;
  config: OcrJobConfig;
}

/** One configured `providers` entry as reported by `--check` — presence
 *  booleans only, NEVER the key value (security contract, mirrors `keys`
 *  below and `gemini_client.py`'s never-print-values rule). */
export interface OcrProviderCheckEntry {
  name: string;
  kind: string;
  model?: string;
  api_key_env?: string;
  api_key_set: boolean;
  /** Only set for `kind: "cli"` — whether `command[0]` resolves on PATH. */
  command_on_path?: boolean;
}

/** `ocr_engine.py --check` result shape (`run_check()`), plus the TS-side
 *  `providers` summary `ocr.ts` attaches from the loaded `haily.json`/
 *  `--config` (the Python engine has no job at `--check` time to read
 *  `providers` from, so this field is populated entirely on the TS side). */
export interface OcrCheckResult {
  ok: boolean;
  python: string;
  docling_installed: boolean;
  docling_version: string | null;
  models_cached: boolean;
  opencv_installed: boolean;
  pypdfium2_installed: boolean;
  keys: { GEMINI_API_KEY: boolean; GOOGLE_API_KEY: boolean };
  providers?: OcrProviderCheckEntry[];
}

/** Per-page confidence block (`manifest.py` page entry). */
export interface ManifestPageConfidence {
  layout: number;
  ocr: number;
  grade: string | null;
}

/** Per-page quality metrics (`quality_gate.py` output, embedded in the manifest). */
export interface ManifestPageQuality {
  blur?: number;
  skew_deg?: number;
  dpi?: number | null;
}

/** One `manifest.pages[]` entry — field names locked by `manifest.py`'s
 *  write-order contract (a page is "done" only once its artifacts are durable). */
export interface ManifestPage {
  page: number;
  status: 'pending' | 'done' | 'failed';
  tier: 'local' | 'flash' | 'pro' | null;
  engine: string | null;
  confidence: ManifestPageConfidence;
  quality: ManifestPageQuality;
  content: string[];
  cost_usd: number;
  attempts: number;
  flags: string[];
  output: string | null;
  figures: string[];
}

export interface ManifestTotals {
  pages: number;
  done: number;
  failed: number;
  cost_usd: number;
  by_tier: { local: number; flash: number; pro: number };
}

/** One `manifest.batch_jobs[]` entry (phase 6, additive v1 field — see
 *  `manifest.py`'s `add_batch_job`/`update_batch_job`). `state` starts at
 *  `"submitted"`, moves to `"running"` while polling, and ends at
 *  `"collected"` (written) or `"failed"`/`"expired"` (pages returned to
 *  `pending` with a `batch:expired` flag). */
export interface ManifestBatchJob {
  job_id: string;
  model: string;
  tier: 'flash' | 'pro';
  submitted_at: string;
  state: 'submitted' | 'running' | 'collected' | 'failed' | 'expired';
  page_refs: number[];
}

export interface ManifestJobRecord {
  input: string;
  output: string;
  config: Record<string, unknown>;
  file_sha256: string;
  created: string;
}

/** Full `manifest.json` shape (schema v1, `manifest.py:load_or_init`). */
export interface ManifestSummary {
  v: number;
  job: ManifestJobRecord;
  totals: ManifestTotals;
  pages: ManifestPage[];
  /** Additive phase-6 field — absent on a manifest written before this
   *  phase; always guard with `?? []`, never assume presence. */
  batch_jobs?: ManifestBatchJob[];
}

/** NDJSON progress line emitted on the engine's stderr (`batch.py`/
 *  `batch_collect.py`, `json.dumps` only — never hand-formatted). Optional
 *  fields beyond `ev` reflect that most event payloads aren't fully locked —
 *  treat anything past `ev` as best-effort data, never as a filesystem path
 *  or a format to parse further. Phase 6 adds `batch_submitted` (a job was
 *  submitted), `batch_state` (poll result: running/failed/expired), and
 *  `batch_collected` (one page written from a completed job). */
export interface ProgressEvent {
  ev: 'page' | 'doc_done' | 'doc_skipped' | 'summary' | 'batch_submitted' | 'batch_state' | 'batch_collected' | string;
  doc?: string;
  page?: number;
  tier?: 'local' | 'flash' | 'pro' | null;
  status?: 'pending' | 'done' | 'failed';
  cost_usd?: number;
  [extra: string]: unknown;
}
