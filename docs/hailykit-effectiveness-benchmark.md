# HailyKit Effectiveness Benchmark

HailyKit now has one provider-neutral benchmark surface for before/after changes to skills, rules, agents, hooks, and the legacy reasoning harness. The V2 benchmark normalizes observations into one NDJSON schema before any GO/NO-GO decision is considered.

## Commands

- `hailykit benchmark static [repo] [--base-ref <ref>] [--claude-snapshot <file>] [--codex-snapshot <file>] [--out <file>] [--json]`
- `hailykit benchmark hooks [repo] [--out <file>] [--json]`
- `hailykit benchmark plan <manifest.json> [--repo <path>] [--json]`
- `hailykit benchmark run <manifest.json> [--backend provider|codex-app-server] [--responses <file> | --live --ack-budget] [--evidence <file>] [--repo <path>] [--out <file>] [--json]`
- `hailykit benchmark compare <artifact.ndjson> [--holdout-manifest <file>] [--holdout-artifact <file>] [--provider-footprint-artifact <static.ndjson>] [--json]`
- `hailykit benchmark report <artifact.ndjson> [--format md|json] [--out <file>] [decision options above] [--json]`
- `hailykit benchmark import-reasoning <legacy.ndjson> [--out <file>] [--json]`

`benchmark static` generates temporary Claude and Codex install snapshots by default. Passing `--claude-snapshot` and `--codex-snapshot` overrides those temp installs when you want to replay a captured footprint instead of synthesizing one.

`benchmark run` is offline by default: it replays synthetic provider responses from `--responses`. Live-equivalent runs require both `--live` and `--ack-budget`. The default backend is `provider`; `codex-app-server` is live-only and Codex-only. Before the first provider call, the runner verifies the exact CLI version and a provider-configuration fingerprint covering model, policy, config isolation, sandbox/tool restrictions, and treatment injection. If the manifest and runtime disagree, the run fails closed.

## Methodology

- Static footprint, hook replay, workflow trials, and imported V1 reasoning artifacts all normalize to V2 benchmark events.
- Quality, safety, efficiency, and provenance are reported separately.
- Quality uses complete paired denominators, bootstrap confidence intervals, permutation p-values, effective-pair counts, and flake diagnostics.
- Efficiency is kept separate from quality; cross-provider or cross-capability token deltas are descriptive only when provider identity or telemetry is incomplete.
- Codex CLI `turn.completed.usage` currently emits `input_tokens`, `cached_input_tokens`, `output_tokens`, and `reasoning_output_tokens`. HailyKit derives `totalTokens = inputTokens + outputTokens` when the provider omits total, treats cached and reasoning counters as breakdowns rather than extra total tokens, and leaves `costUsd`, cache-write bytes, and model identity null unless the provider explicitly emits them.
- The App Server backend measures only what the stream exposes: TTFT, token usage, context occupancy, tool calls/errors, approvals, output bytes, and context-compaction counts. It does not invent USD cost, cache-write bytes, or compaction bytes when those values are absent.
- Workflow treatment manifests carry an `evaluatorEvidenceHash`; `benchmark run --evidence <file>` refuses evidence whose normalized bytes do not match that hash.
- A workflow fixture may declare `localEvaluation` (`json_contract`, `text_checks`, or `text_contracts`). In `text_contracts`, `requiredAnyOf` requires an affirmed expression, `requiredNegatedAnyOf` requires a prohibition, and `forbiddenSubstrings` fails only affirmed unsafe language. The runner evaluates the provider answer in memory during the existing arm call, stores only `sha256:<digest>` plus bounded evaluation metadata, and leaves `legacy.finalAnswer` null. Complete deterministic evidence can therefore score a paired live row without a second provider/judge call; fixtures without it keep the existing `--evidence` path.
- Base and candidate `treatmentFiles` are read from their pinned commits, injected per arm, capped by file count and bytes, and represented in artifacts only by paths, size, and digest.
- Decision-grade GO requires frozen margins, calibration completion, paired observations, verified live model identity, zero critical safety flags, and a private holdout that stays hash-only in repo-facing artifacts.
- The first 2–3 live batches are exploratory and stay `INCONCLUSIVE` while margins are being calibrated.
- Synthetic, dry-run, and other non-live artifacts remain `INCONCLUSIVE` by design.

## Offline validation

Build first, then run the wrapper script:

```bash
npm run build
npm run benchmark:offline -- static . --out static.ndjson
npm run benchmark:offline -- hooks . --out hooks.ndjson
npm run benchmark:offline -- plan <manifest.json>
npm run benchmark:offline -- run <manifest.json> --responses <responses.json> --out run.ndjson
npm run benchmark:offline -- compare run.ndjson --holdout-manifest cli/tests/fixtures/benchmark/private-holdout-manifest.json --holdout-artifact run.ndjson --provider-footprint-artifact static.ndjson
npm run benchmark:offline -- report run.ndjson --holdout-manifest cli/tests/fixtures/benchmark/private-holdout-manifest.json --holdout-artifact run.ndjson --provider-footprint-artifact static.ndjson
npm run benchmark:offline -- import-reasoning legacy.ndjson --out converted.ndjson
```

`benchmark report` is the canonical local decision view. It exposes the holdout hash match, provider-footprint status, calibration status, margin identity validity, and the budget payload without surfacing private prompt text.

## Private holdout and live budgets

- Keep private holdout prompts out of repo artifacts. Only hashed identities and aggregate outcomes belong in reports.
- Treat raw provider answers as transient benchmark input: canonical workflow NDJSON and reports contain an output digest, never the answer text.
- The `--holdout-manifest` and `--holdout-artifact` flags validate a real decision-grade V2 artifact: matching fixture-set hash and prompt count, evaluated private-holdout rows, valid provenance, and no raw prompt fields.
- Live-equivalent workflow runs must acknowledge budget and set projected calls/spend plus bounded call, spend, wall-clock, and output caps in the manifest. The projected spend reserve is budget accounting, not observed cost.
- The live model-turn boundary is the first streamed provider event that proves the model ran; for CLI this is the parser's first answer-bearing output, and for App Server it is the first streamed token or delta event for the active thread/turn.
- Provider dashboards and public benchmark suites are supporting evidence only. The V2 artifact and its locked identities are the canonical local record.
