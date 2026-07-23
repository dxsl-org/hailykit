import path from 'node:path';
import { resolveExecutable } from '../spawn';
import type { OcrConfig } from './config';
import type { ManifestSummary, OcrCheckResult, OcrProviderCheckEntry } from './types';

/**
 * Pure string builders for `hailykit ocr`'s human-readable output — kept
 * separate from `cmdOcr` so the command module stays orchestration-only.
 * Leaf module.
 */

export function missingPythonMessage(): string {
  return 'no python interpreter found — pass --python <path>, set ocr.python in haily.json, '
    + 'or install one at ~/.claude/skills/.venv';
}

/** `--check` report: python/docling/key availability + install guidance
 *  (never printed as anything that could install something — text only). */
export function checkReportLines(data: Partial<OcrCheckResult>, pythonPath: string, scriptPath: string): string[] {
  const lines: string[] = [
    `python: ${pythonPath} (${data.python ?? 'unknown version'})`,
    `docling: ${data.docling_installed ? `installed (${data.docling_version})` : 'NOT installed'}`,
  ];
  if (data.docling_installed) {
    lines.push(`model cache: ${data.models_cached ? 'present' : 'not yet fetched (first run downloads ~500MB)'}`);
  }
  lines.push(
    `opencv: ${data.opencv_installed ? 'installed' : 'NOT installed'}`,
    `pypdfium2: ${data.pypdfium2_installed ? 'installed' : 'NOT installed'}`,
    `GOOGLE_API_KEY: ${data.keys?.GOOGLE_API_KEY ? 'set' : 'not set'} · GEMINI_API_KEY: ${data.keys?.GEMINI_API_KEY ? 'set' : 'not set'}`,
  );
  if (!data.docling_installed || !data.opencv_installed || !data.pypdfium2_installed) {
    const reqPath = path.join(path.dirname(scriptPath), 'requirements.txt');
    lines.push('', `Install guidance: ${pythonPath} -m pip install -r ${reqPath}`);
  }
  return lines;
}

/** Structured `--check` summary of configured `providers` — presence
 *  booleans only, NEVER the key value (same contract as `data.keys` above).
 *  Feeds both `--check --json` (attached to `data.providers`) and the
 *  human-readable lines below, so the two never drift apart. */
export function providerCheckSummary(config: OcrConfig): OcrProviderCheckEntry[] {
  const providers = config.providers ?? {};
  return Object.entries(providers).map(([name, entry]) => ({
    name,
    kind: entry.kind,
    model: entry.model,
    api_key_env: entry.api_key_env,
    api_key_set: Boolean(entry.api_key_env && process.env[entry.api_key_env]),
    ...(entry.kind === 'cli' && entry.command?.[0]
      ? { command_on_path: resolveExecutable(entry.command[0]) !== null }
      : {}),
  }));
}

export function providerCheckLines(config: OcrConfig): string[] {
  const summary = providerCheckSummary(config);
  if (!summary.length) return [];
  const lines = ['', 'providers:'];
  for (const p of summary) {
    const bits = [
      `kind=${p.kind}`, `model=${p.model ?? 'unset'}`,
      `api_key_env=${p.api_key_env ?? 'none'} (${p.api_key_env ? (p.api_key_set ? 'set' : 'not set') : 'n/a'})`,
    ];
    if (p.command_on_path !== undefined) bits.push(`command[0] on PATH: ${p.command_on_path ? 'yes' : 'no'}`);
    lines.push(`  ${p.name}: ${bits.join(' ')}`);
  }
  return lines;
}

export function runSummaryLines(data: { summary: unknown; manifests: ManifestSummary[] }): string[] {
  const lines = ['ocr: run complete', JSON.stringify(data.summary)];
  for (const m of data.manifests) {
    lines.push(`manifest: ${m.totals.done}/${m.totals.pages} pages done, $${m.totals.cost_usd.toFixed(4)}`);
  }
  return lines;
}
