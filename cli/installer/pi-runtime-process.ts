import { execFile } from 'node:child_process';
import type { ProcessRunner } from './pi-runtime-types.js';

export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_BUFFER_BYTES = 256 * 1024;

export const defaultRunner: ProcessRunner = {
  exec(file, args, options) {
    return new Promise((resolve, reject) => {
      execFile(
        file,
        args,
        {
          encoding: 'utf8',
          shell: false,
          timeout: options.timeoutMs,
          maxBuffer: options.maxBufferBytes,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(Object.assign(error, { stdout, stderr }));
            return;
          }
          resolve({ stdout, stderr });
        },
      );
    });
  },
};

export function formatExecFailure(error: unknown): string {
  const record = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string; code?: string | number };
  const text = `${record.stderr ?? ''}\n${record.stdout ?? ''}`.trim();
  if (record.code === 'ENOENT') return 'command not found';
  if (record.code === 'ETIMEDOUT') return 'timed out';
  if (/EAI_AGAIN|ENOTFOUND|ECONNRESET|network/i.test(text)) return 'network access failed';
  if (text) return text.split(/\r?\n/, 1)[0]!;
  return record.message || 'command failed';
}
