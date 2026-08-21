import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SettingsPlan {
  current: Record<string, unknown>;
  next: Record<string, unknown>;
  changed: boolean;
}
export interface AtomicFileCommit { rollback(): void; finalize(): void; }

function readSettings(settingsPath: string): Record<string, unknown> {
  if (!fs.existsSync(settingsPath)) return {};
  const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Pi settings must be a JSON object: ${settingsPath}`);
  }
  return parsed as Record<string, unknown>;
}

function stableJson(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function planPiOverlaySettings(
  settingsPath: string,
  ownedKeys: readonly string[],
  values: Record<string, unknown>,
): SettingsPlan {
  const current = readSettings(settingsPath);
  const next = { ...current };
  for (const key of ownedKeys) {
    if (key in values) next[key] = values[key];
  }
  return { current, next, changed: stableJson(current) !== stableJson(next) };
}

export function planPiOverlaySettingsRemoval(
  settingsPath: string,
  ownedKeys: readonly string[],
): SettingsPlan {
  const current = readSettings(settingsPath);
  const next = { ...current };
  for (const key of ownedKeys) delete next[key];
  return { current, next, changed: stableJson(current) !== stableJson(next) };
}

export function writeFileAtomically(targetPath: string, content: string): AtomicFileCommit {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.hailykit-tmp`;
  const backupPath = fs.existsSync(targetPath) ? `${targetPath}.hailykit-old` : null;
  fs.rmSync(tempPath, { force: true });
  if (backupPath) fs.rmSync(backupPath, { recursive: true, force: true });
  fs.writeFileSync(tempPath, content, 'utf8');
  if (backupPath) fs.renameSync(targetPath, backupPath);
  try {
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    if (backupPath && fs.existsSync(backupPath) && !fs.existsSync(targetPath)) fs.renameSync(backupPath, targetPath);
    throw error;
  }
  return {
    rollback: () => {
      fs.rmSync(targetPath, { recursive: true, force: true });
      if (backupPath && fs.existsSync(backupPath)) fs.renameSync(backupPath, targetPath);
    },
    finalize: () => { if (backupPath) fs.rmSync(backupPath, { recursive: true, force: true }); },
  };
}

export function writeSettingsAtomically(settingsPath: string, next: Record<string, unknown>): AtomicFileCommit {
  return writeFileAtomically(settingsPath, stableJson(next));
}
