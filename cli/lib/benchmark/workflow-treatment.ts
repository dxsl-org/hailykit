import fs from 'node:fs';
import path from 'node:path';
import { sha256, stableStringify } from '../reasoning-harness/hash';
import type { WorkflowArm } from './scheduler';
import type { ResolvedWorkflowManifest } from './treatment-manifest';

export interface WorkflowTreatmentPrompt { content: string; bytes: number; digest: string; files: string[]; }
const MAX_FILES = 64;
const MAX_BYTES = 512 * 1024;
const SECRET_PATH = /(^|\/)\.(env|ssh|aws)(\.|\/|$)|(^|\/)(credentials|id_rsa|id_ed25519)(\/|$)/i;

export function buildWorkflowTreatmentPrompt(cwd: string, manifest: ResolvedWorkflowManifest, arm: WorkflowArm): WorkflowTreatmentPrompt {
  const files = manifest.treatmentFiles[arm].map(safeRelativePath);
  if (files.length > MAX_FILES) throw new Error(`workflow treatment exceeds ${MAX_FILES} files`);
  let total = 0;
  const sections = files.map((relativePath) => {
    const absolute = containedFile(cwd, relativePath);
    const content = fs.readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n');
    total += Buffer.byteLength(content, 'utf8');
    if (total > MAX_BYTES) throw new Error(`workflow treatment exceeds ${MAX_BYTES} bytes`);
    return `<hailykit-treatment path=${JSON.stringify(relativePath)}>\n${content}\n</hailykit-treatment>`;
  });
  const content = ['Apply the following HailyKit treatment while completing the task.', ...sections].join('\n\n');
  return { content, bytes: Buffer.byteLength(content, 'utf8'), digest: sha256(stableStringify({ files, sections })), files };
}

export function combineTreatmentAndFixture(treatment: WorkflowTreatmentPrompt, fixturePrompt: string | null): string | null {
  return fixturePrompt ? `${treatment.content}\n\nTask:\n${fixturePrompt}` : null;
}

function safeRelativePath(value: string): string { const normalized = value.replace(/\\/g, '/'); if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..') || SECRET_PATH.test(normalized)) throw new Error(`unsafe workflow treatment path: ${value}`); return normalized; }
function containedFile(root: string, relativePath: string): string { let current = root; for (const part of relativePath.split('/')) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`workflow treatment path contains a symlink: ${relativePath}`); } const realRoot = fs.realpathSync.native(root); const real = fs.realpathSync.native(current); const rel = path.relative(realRoot, real); if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.statSync(real).isFile()) throw new Error(`workflow treatment path escapes root: ${relativePath}`); return real; }
