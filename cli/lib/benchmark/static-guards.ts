import fs from 'node:fs';
import path from 'node:path';
import type { InstalledArtifactSnapshotEntry } from './types';

export const BYTES_PER_TOKEN_EST = 4;
export const FILE_CAP = 2048;
export const BYTE_CAP = 8 * 1024 * 1024;

const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const SECRET_PATH = /(^|\/)\.(env|ssh|aws)(\.|\/|$)|(^|\/)(credentials|id_rsa|id_ed25519|known_hosts)(\/|$)/i;

export function assertContainedStaticFile(rootDir: string, relativePath: string): string {
  validateStaticRelativePath(relativePath);
  const resolved = path.resolve(rootDir, relativePath);
  const rootPrefix = `${rootDir}${path.sep}`;
  if (resolved !== rootDir && !resolved.startsWith(rootPrefix)) throw new Error(`path escapes allowed root: ${relativePath}`);
  let current = rootDir;
  for (const segment of path.relative(rootDir, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`symlink or junction is forbidden: ${relativePath}`);
  }
  return resolved;
}

export function validateSnapshotEntries(entries: InstalledArtifactSnapshotEntry[], provider: string): InstalledArtifactSnapshotEntry[] {
  if (entries.length > FILE_CAP) throw new Error(`${provider} snapshot exceeds file cap ${FILE_CAP}`);
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const entry of entries) {
    validateStaticRelativePath(entry.path);
    if (!HEX_SHA256.test(entry.sha256)) throw new Error(`${provider} snapshot sha256 must be 64 hex characters: ${entry.path}`);
    if (seen.has(entry.path)) throw new Error(`${provider} snapshot contains duplicate path: ${entry.path}`);
    seen.add(entry.path);
    totalBytes += entry.bytes;
  }
  if (totalBytes > BYTE_CAP) throw new Error(`${provider} snapshot exceeds byte cap ${BYTE_CAP}`);
  return entries;
}

export function validateStaticRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) throw new Error(`invalid relative path: ${relativePath}`);
  const documentedTemplate = /(^|\/)\.env\.(example|sample|template)$/i.test(normalized);
  if (SECRET_PATH.test(normalized) && !documentedTemplate) throw new Error(`secret-like path is forbidden: ${relativePath}`);
  return normalized;
}
