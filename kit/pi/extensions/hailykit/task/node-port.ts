import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type InvocationOutcome, type InvocationPort, type PiInvocation } from './types.js';

function writePrompt(agentName: string, systemPrompt: string): { dirPath: string; filePath: string } | null {
  if (!systemPrompt.trim()) return null;
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-pi-task-'));
  const filePath = path.join(dirPath, `${agentName.replace(/[^\w.-]+/g, '_')}.md`);
  fs.writeFileSync(filePath, systemPrompt, { encoding: 'utf8', mode: 0o600 });
  return { dirPath, filePath };
}

function cleanupPrompt(temp: { dirPath: string; filePath: string } | null): void {
  if (!temp) return;
  try { fs.rmSync(temp.filePath, { force: true }); } catch {}
  try { fs.rmSync(temp.dirPath, { recursive: true, force: true }); } catch {}
}

function capAppend(current: string, chunk: string, capBytes: number): { next: string; capped: boolean } {
  if (!chunk) return { next: current, capped: false };
  const remaining = capBytes - Buffer.byteLength(current, 'utf8');
  if (remaining <= 0) return { next: current, capped: true };
  let nextChunk = chunk;
  while (Buffer.byteLength(nextChunk, 'utf8') > remaining) nextChunk = nextChunk.slice(0, -1);
  return { next: current + nextChunk, capped: nextChunk.length < chunk.length };
}

export function createNodeInvocationPort(): InvocationPort {
  return {
    invoke(call, signal) {
      return new Promise<InvocationOutcome>((resolve) => {
        const temp = writePrompt(call.env['HAILYKIT_PI_TASK_AGENT'] || 'task-agent', call.systemPrompt || '');
        const args = temp ? [...call.args.slice(0, -1), '--append-system-prompt', temp.filePath, call.args.at(-1)!] : call.args;
        const parts = call.command.split('\0');
        const proc = spawn(parts[0], [...parts.slice(1), ...args], {
          cwd: call.cwd,
          env: { ...process.env, ...call.env },
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
        });
        let stdout = '';
        let stderr = '';
        let finished = false;
        let timedOut = false;
        let killedForCap = false;
        let abortHandler: (() => void) | undefined;
        const done = (outcome: InvocationOutcome): void => {
          if (finished) return;
          finished = true;
          clearTimeout(timeoutId);
          if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
          cleanupPrompt(temp);
          resolve(outcome);
        };
        const terminate = (): void => {
          proc.kill('SIGTERM');
          setTimeout(() => proc.kill('SIGKILL'), 500).unref?.();
        };
        const timeoutId = setTimeout(() => {
          timedOut = true;
          terminate();
        }, call.timeoutMs);
        if (signal) {
          if (signal.aborted) terminate();
          else {
            abortHandler = () => terminate();
            signal.addEventListener('abort', abortHandler, { once: true });
          }
        }
        proc.stdout.on('data', (chunk) => {
          const next = capAppend(stdout, String(chunk), call.outputCapBytes);
          stdout = next.next;
          killedForCap ||= next.capped;
          if (next.capped) terminate();
        });
        proc.stderr.on('data', (chunk) => {
          const next = capAppend(stderr, String(chunk), call.outputCapBytes);
          stderr = next.next;
        });
        proc.on('error', (error) => done({ exitCode: 1, stdout, stderr, timedOut, aborted: signal?.aborted, crashReason: error.message }));
        proc.on('close', (exitCode) => done({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
          timedOut,
          aborted: signal?.aborted,
          crashReason: killedForCap ? 'Pi task output exceeded capture cap.' : undefined,
        }));
      });
    },
  };
}
