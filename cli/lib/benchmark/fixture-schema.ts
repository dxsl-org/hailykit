import { sha256 } from '../reasoning-harness/hash';
import type { HarnessVariant } from '../reasoning-harness/types';
import { asRecord, assertKeys, reqBoolean, reqEnum, reqInt, reqString } from './schema-helpers';
import type { BenchmarkFixtureMetadata } from './types';

export type FixtureSplit = 'public-training' | 'public-locked-validation' | 'private-hash-only-holdout';
export interface EvaluationFixtureMetadata {
  fixtureId: string;
  componentClass: string;
  workflowStage: 'route' | 'recon' | 'draft' | 'build' | 'verify' | 'ship' | 'cross-cutting';
  provider: 'claude' | 'codex' | 'provider-neutral';
  toolRegime: 'none' | 'read_only' | 'workspace_write';
  difficulty: 'easy' | 'medium' | 'hard';
  split: FixtureSplit;
  fixtureHash: string;
  promptHash: string;
}
export interface PrivateHoldoutManifest { schemaVersion: 1; fixtureSetHash: string; promptCount: number; containsRawPrompts: false; }

const EVAL_KEYS = ['fixtureId', 'componentClass', 'workflowStage', 'provider', 'toolRegime', 'difficulty', 'split', 'fixtureHash', 'promptHash'] as const;
const HOLDOUT_KEYS = ['schemaVersion', 'fixtureSetHash', 'promptCount', 'containsRawPrompts'] as const;
const SHA256 = /^[a-f0-9]{64}$/i;

export function createFixtureMetadata(input: { fixtureId: string; fixtureClass?: string | null; fixtureHash: string; promptHash: string; treatmentHash: string; variant?: string | null; }): BenchmarkFixtureMetadata {
  return {
    fixtureId: reqString(input.fixtureId, 'fixtureId'),
    fixtureClass: input.fixtureClass === null || input.fixtureClass === undefined ? null : reqString(input.fixtureClass, 'fixtureClass'),
    fixtureHash: reqString(input.fixtureHash, 'fixtureHash'), promptHash: reqString(input.promptHash, 'promptHash'),
    treatmentHash: reqString(input.treatmentHash, 'treatmentHash'),
    variant: input.variant === null || input.variant === undefined ? null : reqString(input.variant, 'variant') as HarnessVariant,
  };
}

export function createFixtureIdentity(fixtureId: string, prompt: string, treatment: string): BenchmarkFixtureMetadata {
  return createFixtureMetadata({ fixtureId, fixtureHash: sha256(JSON.stringify({ fixtureId, prompt })), promptHash: sha256(prompt), treatmentHash: sha256(treatment) });
}

export function validateEvaluationFixtureMetadata(value: unknown): EvaluationFixtureMetadata {
  const record = asRecord(value, 'evaluation fixture metadata');
  assertKeys(record, EVAL_KEYS, 'evaluation fixture metadata');
  return {
    fixtureId: reqString(record.fixtureId, 'fixtureId'), componentClass: reqString(record.componentClass, 'componentClass'),
    workflowStage: reqEnum(record.workflowStage, ['route', 'recon', 'draft', 'build', 'verify', 'ship', 'cross-cutting'], 'workflowStage'),
    provider: reqEnum(record.provider, ['claude', 'codex', 'provider-neutral'], 'provider'),
    toolRegime: reqEnum(record.toolRegime, ['none', 'read_only', 'workspace_write'], 'toolRegime'),
    difficulty: reqEnum(record.difficulty, ['easy', 'medium', 'hard'], 'difficulty'),
    split: reqEnum(record.split, ['public-training', 'public-locked-validation', 'private-hash-only-holdout'], 'split'),
    fixtureHash: hash(record.fixtureHash, 'fixtureHash'), promptHash: hash(record.promptHash, 'promptHash'),
  };
}

export function validatePrivateHoldoutManifest(value: unknown): PrivateHoldoutManifest {
  const record = asRecord(value, 'private holdout manifest');
  assertKeys(record, HOLDOUT_KEYS, 'private holdout manifest');
  if (reqBoolean(record.containsRawPrompts, 'containsRawPrompts')) throw new Error('private holdout manifest cannot contain raw prompts');
  return { schemaVersion: 1, fixtureSetHash: hash(record.fixtureSetHash, 'fixtureSetHash'), promptCount: reqInt(record.promptCount, 'promptCount', 1), containsRawPrompts: false };
}

function hash(value: unknown, name: string): string { const text = reqString(value, name); if (!SHA256.test(text)) throw new Error(`${name} must be a 64-character SHA-256 hex digest`); return text; }
