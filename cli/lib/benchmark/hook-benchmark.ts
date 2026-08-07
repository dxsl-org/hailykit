import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installHookWrappers, wrapperFilename } from '../../installer/providers/codex-hook-compat';
import { sha256, stableStringify } from '../reasoning-harness/hash';
import { captureInstalledArtifactSnapshot } from './artifact-snapshot';
import { buildCanonicalHookFixtures, type HookFixture } from './hook-fixtures';
import { toHookBenchmarkObservation } from './hook-observation';
import { replayHookFixture } from './hook-replay';
import type { BenchmarkManifest, BenchmarkObservation, BenchmarkOutcome } from './types';

export interface HookBenchmarkArtifact { manifest: BenchmarkManifest; observations: BenchmarkObservation[]; outcome: BenchmarkOutcome; }

export function runOfflineHookBenchmark(repoRoot: string): HookBenchmarkArtifact {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-hook-benchmark-'));
  const home = path.join(root, 'home');
  const installRoot = path.join(root, 'codex-install');
  const hooksRoot = path.join(installRoot, 'hooks');
  fs.mkdirSync(home, { recursive: true });
  fs.cpSync(path.join(repoRoot, 'kit', 'hooks'), hooksRoot, { recursive: true });
  try {
    installHookWrappers(hooksRoot);
    const sourceFixtures = buildCanonicalHookFixtures();
    const codexFixtures = sourceFixtures.map((fixture) => codexFixture(fixture, hooksRoot));
    const snapshotPaths = [...new Set(codexFixtures.flatMap((fixture) => [fixture.scriptRelativePath, originalPath(fixture, hooksRoot)]))];
    const snapshot = captureInstalledArtifactSnapshot(installRoot, snapshotPaths);
    const env = { HOME: home, USERPROFILE: home, HL_CLAUDE_SETTINGS_DIR: path.join(home, '.claude'), PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' };
    const sourceRows = sourceFixtures.map((fixture) => toHookBenchmarkObservation(replayHookFixture(fixture, { repoRoot, cwd: root, env }), fixture));
    const codexRows = codexFixtures.map((fixture) => toHookBenchmarkObservation(replayHookFixture(fixture, { repoRoot, cwd: root, env, snapshot, allowedInstallRoot: root }), fixture));
    const observations = [...sourceRows, ...codexRows];
    const manifestHash = sha256(stableStringify(observations.map((row) => ({ key: row.key, fixture: row.fixture, metrics: row.metrics, extensions: row.providerExtensions }))));
    const manifest: BenchmarkManifest = {
      v: 2, kind: 'benchmark_manifest', source: 'hook', provider: null, providerLabel: 'hook', tier: 'fast', requestedModel: 'offline-hook-replay',
      fixture: { fixtureId: 'hook-replay-suite', fixtureClass: 'hook', fixtureHash: sha256(stableStringify(observations.map((row) => row.fixture.fixtureHash))), promptHash: sha256('hook-events-v2'), treatmentHash: manifestHash, variant: null },
      provenance: 'synthetic', createdAt: new Date().toISOString(), manifestHash, modelVerificationWaiver: false,
      marginRegistry: { metric: 'outcomeScore', threshold: 1, exploratoryBatches: 0, firstDecisionBatch: 1, frozen: false, frozenAt: null, identityHash: sha256('hook-replay-margin') },
      calibration: { completedLiveBatches: 0, firstDecisionBatch: 1 }, snapshot: null, legacy: { attemptedComplete: null, baselineEligible: null, commitSha: null },
    };
    const rows = observations.map((row) => ({ ...row, manifestHash }));
    const failures = rows.filter((row) => row.metrics.outcomeScore === 0).length;
    const outcome: BenchmarkOutcome = { v: 2, kind: 'benchmark_outcome', source: 'hook', decision: 'inconclusive', reasons: ['offline hook replay is descriptive only', `${failures} replay failure(s)`], observedMeanScore: null, threshold: null, comparedRows: rows.length };
    return { manifest, observations: rows, outcome };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function codexFixture(source: HookFixture, hooksRoot: string): HookFixture {
  const original = path.join(hooksRoot, source.scriptRelativePath);
  return { ...source, id: `${source.id}-codex`, mode: 'codex-installed', scriptRelativePath: path.posix.join('hooks', wrapperFilename(original)) };
}
function originalPath(fixture: HookFixture, hooksRoot: string): string { const name = fixture.scriptRelativePath.replace(/^hooks\//, '').replace(/^compat-[a-f0-9]{8}-/, ''); return path.posix.join('hooks', path.basename(path.join(hooksRoot, name))); }
