import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_BYTES = 32_527;
const MAX_TOTAL_BYTES = 19_500;
const FILES = {
  ocr: 'kit/skills/hl-ocr/SKILL.md',
  optimize: 'kit/skills/hc-optimize/SKILL.md',
  security: 'kit/skills/hc-security/SKILL.md',
  test: 'kit/skills/hc-test/SKILL.md',
} as const;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function bytes(relativePath: string): number {
  return Buffer.byteLength(read(relativePath), 'utf8');
}

test('ops/quality skill frontmatter stays byte-identical', () => {
  const expected = new Map([
    [FILES.ocr, `---
name: hl-ocr
description: "Bulk OCR for PDFs and scanned images to Markdown via a tiered docling-to-VLM ladder (Gemini by default; any OpenAI-compatible API or a CLI transport is configurable per tier), with multimodal sample verification and a cost/quality report."
when_to_use: "Invoke when converting a batch of scanned PDFs or images to Markdown at scale, needing tiered escalation cost control and fidelity verification against the source pages."
user-invocable: true
argument-hint: "<input> --out <dir> [--max-tier local|flash|pro] [--lang <list>] [--batch-api] [--collect] [--resume] [--check] [--config <path>]"
metadata:
  category: workflow
  keywords: [ocr, pdf, scan, docling, gemini, batch-api, transcription, markdown, multimodal-verify]
---
`],
    [FILES.optimize, `---
name: hc-optimize
description: "Iterative metric-driven optimization. Auto-runs N iterations, keeps/discards by score."
when_to_use: "Invoke when autonomously optimizing a measurable metric (coverage, bundle size, lint errors) over N iterations."
user-invocable: true
argument-hint: "[Objective/Metric description] or inline config block"
metadata:
  category: workflow
  keywords: [optimize, iteration, metrics, coverage, bundle-size]
---
`],
    [FILES.security, `---
name: hc-security
description: "STRIDE + OWASP audit with severity-ranked findings report. --quick for fast secret/dep scan; --deep for refuter-voted Critical findings; --fix to apply remediation iteratively."
when_to_use: "Invoke when running a STRIDE/OWASP audit, secret scan, or vulnerability check."
user-invocable: true
argument-hint: "[<scope glob | 'full'>] [--quick] [--deep] [--fix] [--iterations N] [--cross]"
metadata:
  attribution: "Security audit pattern adapted from autoresearch by Udit Goenka (MIT)"
  category: security
  keywords: [security, STRIDE, OWASP, audit, secrets, vulnerabilities, scan]
---
`],
    [FILES.test, `---
name: hc-test
description: "Run unit/integration/e2e tests with coverage analysis and build verification. Supports JS/TS, Python, Go, Rust, Flutter. --web activates Playwright, k6, a11y, visual regression, and Core Web Vitals testing."
when_to_use: "Invoke when running test suites, measuring coverage, or writing new tests."
user-invocable: true
argument-hint: "[scope] [--web] [--mutation]"
metadata:
  category: workflow
  keywords: [test, unit, integration, e2e, coverage, playwright, k6, a11y, visual-regression, mutation]
---
`],
  ]);

  for (const [file, frontmatter] of expected) {
    assert.ok(read(file).startsWith(frontmatter), `${file} frontmatter changed`);
  }
});

test('ops/quality skills retain safety, stop, and workflow contracts', () => {
  const ocr = read(FILES.ocr);
  for (const marker of [
    '**Required — check-first:**',
    '**Required — data-egress:**',
    '**Required — untrusted-transcription:**',
    '`--batch-api`',
    '`--collect`',
    '`--resume`',
    'never auto-promote',
    '10+10 on a corpus\'s first wave',
    'offer to re-run only the failed pages',
    'persist tuned thresholds',
    'keys stay env-only',
    'references/verify-protocol.md',
  ]) assert.ok(ocr.includes(marker), `hl-ocr lost: ${marker}`);

  const optimize = read(FILES.optimize);
  for (const marker of [
    '**Required — mechanical metric:**',
    'single number',
    '**Required — git clean working tree:**',
    '**Required — scope boundary:**',
    'AskUserQuestion',
    'Commit BEFORE measuring',
    'Prefer `git revert` over `git reset`',
    '4 consecutive discards',
    '8 consecutive discards',
    'STOP — write findings report',
    'references/loop-protocol.md',
    'references/multi-metric.md',
  ]) assert.ok(optimize.includes(marker), `hc-optimize lost: ${marker}`);

  const security = read(FILES.security);
  for (const marker of [
    '**Required — recon-first:**',
    '`--quick`',
    '`--deep`',
    '`--fix`',
    'Critical → High → Medium → Low → Info',
    'Critical finding gets refuter votes',
    'block release',
    'redact actual values',
    'A finding that fails to survive votes demotes to advisory',
    '`hailykit cross-review --stage code`',
    'Skips silently when no eligible reviewer CLI is installed',
    'references/quality-stride-owasp.md',
    'references/tech-secret-patterns.md',
    'references/tech-vulnerability-patterns.md',
  ]) assert.ok(security.includes(marker), `hc-security lost: ${marker}`);

  const skillTest = read(FILES.test);
  for (const marker of [
    '**Required — never-ignore-failures:**',
    '**Required — evidence-before-claims:**',
    'typecheck → tests → coverage → build',
    '`hailykit test-detect <path> --json`',
    '`hailykit coverage-parse <file> --json`',
    'final code that will be reviewed and merged',
    '`--web`',
    '`--mutation`',
    'never a per-commit gate',
    '{skill:hc-browser}',
    '{skill:hc-security}',
    '{skill:hc-debug}',
    'references/flow-execution.md',
    'references/tech-mutation.md',
  ]) assert.ok(skillTest.includes(marker), `hc-test lost: ${marker}`);
});

test('ops/quality skill batch stays within byte ceilings', () => {
  const sizes = Object.fromEntries(
    Object.entries(FILES).map(([key, rel]) => [key, bytes(rel)]),
  ) as Record<string, number>;
  assert.ok(sizes.ocr <= 5_800, `hl-ocr ${sizes.ocr} exceeds 5800`);
  assert.ok(sizes.optimize <= 4_500, `hc-optimize ${sizes.optimize} exceeds 4500`);
  assert.ok(sizes.security <= 4_900, `hc-security ${sizes.security} exceeds 4900`);
  assert.ok(sizes.test <= 4_300, `hc-test ${sizes.test} exceeds 4300`);
  const total = sizes.ocr + sizes.optimize + sizes.security + sizes.test;
  assert.ok(total <= MAX_TOTAL_BYTES, `batch ${total} exceeds ${MAX_TOTAL_BYTES}`);
  assert.ok(total < BASELINE_BYTES, `batch ${total} did not improve over ${BASELINE_BYTES}`);
});
