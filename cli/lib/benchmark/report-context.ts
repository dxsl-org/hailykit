import fs from 'node:fs';
import path from 'node:path';
import { validatePrivateHoldoutManifest } from './fixture-schema';
import { loadBenchmarkArtifact } from './legacy-reasoning';
import type { BenchmarkReportContext } from './report';

export function createBenchmarkReportContext(options: Record<string, string | boolean>): BenchmarkReportContext {
  const holdoutPath = stringOption(options, 'holdout-manifest');
  const holdoutArtifactPath = stringOption(options, 'holdout-artifact');
  const footprintPath = stringOption(options, 'provider-footprint-artifact');
  return {
    holdoutManifest: holdoutPath ? validatePrivateHoldoutManifest(readJson(holdoutPath)) : null,
    holdoutArtifactText: holdoutArtifactPath ? fs.readFileSync(path.resolve(holdoutArtifactPath), 'utf8') : null,
    providerFootprintArtifactHash: footprintPath ? providerFootprintArtifactHash(footprintPath) : null,
    minimumEffectivePairs: positiveInt(stringOption(options, 'min-pairs'), 5),
  };
}

function providerFootprintArtifactHash(filePath: string): string {
  const artifact = loadBenchmarkArtifact(fs.readFileSync(path.resolve(filePath), 'utf8'));
  if (artifact.manifest.source !== 'static') throw new Error('provider footprint artifact must be a static benchmark artifact');
  const providers = new Set(artifact.observations.flatMap((row) => {
    const value = row.providerExtensions.static;
    const provider = value && typeof value === 'object' ? (value as Record<string, unknown>).provider : null;
    return provider === 'claude' || provider === 'codex' ? [provider] : [];
  }));
  if (!providers.has('claude') || !providers.has('codex')) throw new Error('provider footprint artifact does not cover both Claude and Codex');
  return artifact.manifest.manifestHash;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}
function stringOption(options: Record<string, string | boolean>, name: string): string | undefined {
  return typeof options[name] === 'string' ? options[name] as string : undefined;
}
function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('minimum pairs must be a positive integer');
  return parsed;
}
