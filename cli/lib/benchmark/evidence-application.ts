import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../reasoning-harness/hash';
import { applyObservationEvaluation, evaluateObservation, validateDeterministicEvidence } from './evaluators';
import { validateEvaluationFixtureMetadata, type EvaluationFixtureMetadata } from './fixture-schema';
import { quarantineJudgePayload } from './judge-quarantine';
import type { WorkflowTreatmentManifest } from './treatment-manifest';
import type { BenchmarkObservation } from './types';

interface EvidenceEntry {
  evidence: unknown;
  fixtureMetadata: EvaluationFixtureMetadata;
  judge?: Parameters<typeof quarantineJudgePayload>[0];
}

export function applyBenchmarkEvidence(evidencePath: string | null, manifest: WorkflowTreatmentManifest, rows: BenchmarkObservation[]): BenchmarkObservation[] {
  if (!evidencePath) return rows;
  const raw = fs.readFileSync(path.resolve(evidencePath), 'utf8');
  if (sha256(raw.replace(/\r\n/g, '\n')) !== manifest.evaluatorEvidenceHash) throw new Error('evaluator evidence hash does not match treatment manifest');
  const entries = JSON.parse(raw) as Record<string, EvidenceEntry>;
  return rows.map((row) => applyEntry(row, entries[row.key]));
}

function applyEntry(row: BenchmarkObservation, entry: EvidenceEntry | undefined): BenchmarkObservation {
  if (!entry) return row;
  const metadata = validateEvaluationFixtureMetadata(entry.fixtureMetadata);
  if (metadata.fixtureId !== row.fixtureId) throw new Error(`evaluator metadata fixture mismatch for ${row.key}`);
  if (metadata.fixtureHash !== row.fixture.fixtureHash || metadata.promptHash !== row.fixture.promptHash) {
    throw new Error(`evaluator metadata identity mismatch for ${row.key}`);
  }
  const judge = entry.judge ? quarantineJudgePayload(entry.judge) : null;
  const evaluated = applyObservationEvaluation(row, evaluateObservation(row, validateDeterministicEvidence(entry.evidence), judge));
  return { ...evaluated, providerExtensions: { ...evaluated.providerExtensions, evaluation: { ...(evaluated.providerExtensions.evaluation as Record<string, unknown>), fixtureSplit: metadata.split, fixtureMetadataHash: metadata.fixtureHash } } };
}
