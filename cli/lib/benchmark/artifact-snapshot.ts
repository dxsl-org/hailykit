import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../reasoning-harness/hash';
import type { InstalledArtifactSnapshot, InstalledArtifactSnapshotEntry } from './types';
import { assertKeys, asRecord, reqIsoDate, reqNonNegative, reqString } from './schema-helpers';

const SNAPSHOT_KEYS = ['rootDir', 'createdAt', 'entries'] as const;
const ENTRY_KEYS = ['path', 'sha256', 'bytes'] as const;

export function captureInstalledArtifactSnapshot(rootDir: string, relativePaths: string[]): InstalledArtifactSnapshot {
  const entries = relativePaths.map((relativePath) => snapshotEntry(rootDir, relativePath));
  return { rootDir: path.resolve(rootDir), createdAt: new Date().toISOString(), entries };
}

export function validateInstalledArtifactSnapshot(value: unknown): InstalledArtifactSnapshot {
  const record = asRecord(value, 'snapshot');
  assertKeys(record, SNAPSHOT_KEYS, 'snapshot');
  const entries = record.entries;
  if (!Array.isArray(entries)) throw new Error('snapshot.entries must be an array');
  return {
    rootDir: reqString(record.rootDir, 'snapshot.rootDir'),
    createdAt: reqIsoDate(record.createdAt, 'snapshot.createdAt'),
    entries: entries.map((entry, index) => validateSnapshotEntry(entry, index)),
  };
}

function snapshotEntry(rootDir: string, relativePath: string): InstalledArtifactSnapshotEntry {
  const filePath = path.resolve(rootDir, relativePath);
  const text = fs.readFileSync(filePath, 'utf8');
  return { path: relativePath.replace(/\\/g, '/'), sha256: sha256(text), bytes: Buffer.byteLength(text, 'utf8') };
}

function validateSnapshotEntry(value: unknown, index: number): InstalledArtifactSnapshotEntry {
  const record = asRecord(value, `snapshot.entries[${index}]`);
  assertKeys(record, ENTRY_KEYS, `snapshot.entries[${index}]`);
  return {
    path: reqString(record.path, 'snapshot.entries[].path'),
    sha256: reqString(record.sha256, 'snapshot.entries[].sha256'),
    bytes: reqNonNegative(record.bytes, 'snapshot.entries[].bytes'),
  };
}
