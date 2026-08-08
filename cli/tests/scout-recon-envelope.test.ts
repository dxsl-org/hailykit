import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const ARTIFACT_LIB = path.resolve(__dirname, '..', '..', 'kit', 'hooks', 'haily-artifact');

const { validateReconEnvelope } = require(path.join(ARTIFACT_LIB, 'recon-envelope.cjs')) as {
  validateReconEnvelope(value: unknown): Array<{ path: string; message: string }>;
};
const { validateContext } = require(path.join(ARTIFACT_LIB, 'schema.cjs')) as {
  validateContext(value: unknown): Array<{ path: string; message: string }>;
};

function validEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    targetDigest: 'auth:src/auth',
    sourceKind: 'session',
    sourceRef: '.agents/260808-1742-scout-deduplication/scout-report.md',
    mode: 'quick',
    freshness: 'observed',
    repoHead: '1234567890abcdef1234567890abcdef12345678',
    dirtyScopeFingerprint: 'clean',
    coveredPaths: ['src/auth'],
    excludedPaths: ['dist'],
    ownedPaths: ['src/auth'],
    gaps: [],
    routeHint: 'reuse',
    complete: true,
    createdAt: '2026-08-08T17:42:00.000Z',
    ...overrides
  };
}

function validContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    skill: 'hc-scout',
    mode: 'quick',
    task: 'locate auth files',
    acceptanceCriteria: ['find auth files'],
    touchpoints: ['src/auth'],
    publicContracts: ['AuthService'],
    blastRadius: ['src/auth/index.ts'],
    scoutSummary: 'quick auth lookup',
    ...overrides
  };
}

test('valid ReconEnvelope passes direct validation and the context wrapper', () => {
  assert.deepEqual(validateReconEnvelope(validEnvelope()), []);
  assert.deepEqual(validateContext(validContext({ reconEnvelope: validEnvelope() })), []);
});

test('context-snippets without reconEnvelope stays backward-compatible', () => {
  assert.deepEqual(validateContext(validContext()), []);
});

test('invalid route hint is rejected', () => {
  const issues = validateReconEnvelope(validEnvelope({ routeHint: 'fanout' }));
  assert.ok(issues.some((issue) => issue.path === 'routeHint'));
});

test('prior or stale recon cannot suppress a lookup via reuse', () => {
  for (const freshness of ['prior', 'stale']) {
    const issues = validateReconEnvelope(validEnvelope({ freshness, routeHint: 'reuse' }));
    assert.ok(issues.some((issue) => issue.path === 'routeHint'));
  }
});

test('overlapping ownedPaths are rejected', () => {
  const issues = validateReconEnvelope(validEnvelope({ ownedPaths: ['src', 'src/auth'] }));
  assert.ok(issues.some((issue) => issue.path === 'ownedPaths'));
});

test('complete coverage cannot route to more scout work', () => {
  const issues = validateReconEnvelope(validEnvelope({ routeHint: 'quick' }));
  assert.ok(issues.some((issue) => issue.path === 'routeHint'));
});

test('quick delta routing requires one or two explicit gaps', () => {
  const issues = validateReconEnvelope(validEnvelope({
    complete: false,
    gaps: ['src/auth', 'src/api', 'tests/auth'],
    routeHint: 'quick',
  }));
  assert.ok(issues.some((issue) => issue.path === 'routeHint'));
});
