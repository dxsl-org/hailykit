import { type HailykitRuntime } from '../shared-types.js';

const MUTATING_TOOLS = new Set(['edit', 'write', 'bash', 'task']);
const DESTRUCTIVE_SHELL = /\b(rm|del|move-item|remove-item|git reset --hard|git clean -fd)\b/i;

function stringField(value: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) if (typeof value[key] === 'string') return String(value[key]);
}

export function isMutatingTool(toolName: string, input: Record<string, unknown>): boolean {
  return MUTATING_TOOLS.has(toolName) || (toolName === 'bash' && typeof input['command'] === 'string');
}

export function protectedPathHit(cwd: string, runtime: HailykitRuntime, input: Record<string, unknown>): string | undefined {
  const raw = stringField(input, ['path', 'filePath', 'file_path', 'destination', 'dest', 'command']);
  if (!raw) return;
  const normalized = raw.replace(/\\/g, '/');
  return runtime.settings.safety.protectedPaths.find((entry) => normalized.includes(entry.replace(/\\/g, '/')));
}

export function destructiveHit(input: Record<string, unknown>): string | undefined {
  const command = stringField(input, ['command']);
  return command && DESTRUCTIVE_SHELL.test(command) ? command : undefined;
}

export async function dirtyRepo(
  pi: { exec?(command: string, args: string[], options?: Record<string, unknown>): Promise<{ code?: number; stdout?: string; stderr?: string }> },
  cwd: string,
): Promise<boolean> {
  if (!pi.exec) return true;
  try {
    const result = await pi.exec('git', ['status', '--porcelain'], { cwd });
    if (result.code && result.code !== 0) {
      const stderr = result.stderr?.toLowerCase() ?? '';
      return stderr.includes('not a git repository') ? false : true;
    }
    return Boolean(result.stdout?.trim());
  } catch {
    return true;
  }
}
