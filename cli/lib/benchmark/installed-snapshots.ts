import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClaudeProvider } from '../../installer/providers/claude';
import { CodexProvider } from '../../installer/providers/codex';
import { captureInstalledArtifactSnapshot } from './artifact-snapshot';
import type { InstalledArtifactSnapshot } from './types';

export interface GeneratedInstallSnapshots {
  claude: InstalledArtifactSnapshot;
  codex: InstalledArtifactSnapshot;
  cleanup(): void;
}

export function generateProviderInstallSnapshots(repoRoot: string): GeneratedInstallSnapshots {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-benchmark-installs-'));
  const kitRoot = path.join(path.resolve(repoRoot), 'kit');
  const claudeRoot = path.join(root, 'claude');
  const codexRoot = path.join(root, 'codex');
  try {
    withoutInstallerLogs(() => {
      new ClaudeProvider().install(path.resolve(repoRoot), claudeRoot);
      const codex = new CodexProvider();
      codex.installSkills(kitRoot, codexRoot);
      codex.installRules(kitRoot, codexRoot);
      codex.installAgents?.(kitRoot, codexRoot);
      codex.installHooks(kitRoot, codexRoot);
      codex.writeVersion(codexRoot, readKitVersion(kitRoot));
    });
    return {
      claude: captureInstalledArtifactSnapshot(claudeRoot, listFiles(claudeRoot)),
      codex: captureInstalledArtifactSnapshot(codexRoot, listFiles(codexRoot)),
      cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function listFiles(rootDir: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`generated install contains symlink: ${entry.name}`);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(path.relative(rootDir, absolute).replace(/\\/g, '/'));
    }
  };
  visit(rootDir);
  return files.sort();
}
function readKitVersion(kitRoot: string): string { const metadata = JSON.parse(fs.readFileSync(path.join(kitRoot, 'metadata.json'), 'utf8')) as { version?: unknown }; return typeof metadata.version === 'string' ? metadata.version : 'unknown'; }
function withoutInstallerLogs<T>(run: () => T): T { const previous = console.log; console.log = () => undefined; try { return run(); } finally { console.log = previous; } }
