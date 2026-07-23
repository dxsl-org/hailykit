import path from 'node:path';
import type { ManifestSummary, OcrCheckResult } from './types';

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

export function runSummaryLines(data: { summary: unknown; manifests: ManifestSummary[] }): string[] {
  const lines = ['ocr: run complete', JSON.stringify(data.summary)];
  for (const m of data.manifests) {
    lines.push(`manifest: ${m.totals.done}/${m.totals.pages} pages done, $${m.totals.cost_usd.toFixed(4)}`);
  }
  return lines;
}
