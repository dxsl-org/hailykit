import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const repoRoot = path.resolve(__dirname, '..', '..');

export function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haily-pi-overlay-'));
}

export function overlayKit(): string {
  const root = tmp();
  fs.cpSync(path.join(repoRoot, 'kit', 'pi'), path.join(root, 'pi'), { recursive: true });
  return root;
}

export function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

export function overlayArtifacts(root: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.name.includes('.hailykit-tmp') || entry.name.includes('.hailykit-old')) found.push(next);
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(next);
    }
  };
  walk(root);
  return found;
}
