import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Tool, ToolContext, ToolResult } from '../types';
import { err, ok } from '../types';
import { decodeResponse, encodeRequest, type ToolRequest } from '../polyglot-protocol';

const DEFAULT_TIMEOUT_MS = 30_000;
const SIGKILL_GRACE_MS = 2_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

export interface ExternalExecOptions {
  /** Milliseconds before the subprocess is force-killed. Default 30000. */
  timeoutMs?: number;
}

/**
 * Execute an external (polyglot) tool by spawning its command, writing one
 * NDJSON request line to stdin, and reading the final JSON line from stdout.
 *
 * Failure modes mapped to error codes: spawn failure (`E_SPAWN`), timeout
 * (`E_TIMEOUT`), abort (`E_ABORTED`), non-zero exit (`E_EXIT`), no/empty output
 * (`E_NO_OUTPUT`), malformed JSON (`E_BAD_JSON`), response id mismatch
 * (`E_ID_MISMATCH`). Never throws.
 *
 * @param tool - An external tool (must have `manifest.command`).
 * @param input - Arbitrary JSON-compatible input.
 * @param context - Shared execution context (provides cwd + abort signal).
 * @param options - Execution options (timeout).
 */
export function executeExternal(
  tool: Tool,
  input: unknown,
  context: ToolContext,
  options: ExternalExecOptions = {},
): Promise<ToolResult> {
  const { command, args = [] } = tool.manifest;
  if (!command) {
    return Promise.resolve(err('E_NOT_EXTERNAL', `Tool "${tool.manifest.id}" has no command`));
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestId = randomUUID();
  const request: ToolRequest = {
    v: 1,
    id: requestId,
    tool: tool.manifest.id,
    input,
    context: { sessionId: context.sessionId, cwd: context.cwd },
  };

  return new Promise<ToolResult>((resolve) => {
    // Honor a signal that was already aborted before dispatch — addEventListener
    // only fires on a future transition, so a pre-aborted signal would otherwise
    // let the child run to completion.
    if (context.signal.aborted) {
      resolve(err('E_ABORTED', `Tool "${tool.manifest.id}" was aborted`));
      return;
    }
    const child = spawn(command, args, { cwd: context.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outBytes = 0;
    let errBytes = 0;
    let settled = false;

    const finish = (result: ToolResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', onAbort);
      resolve(result);
    };

    // NOTE: unref so a pending timeout does not prevent process exit when all
    // other work is done before the tool finishes.
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), SIGKILL_GRACE_MS).unref();
      finish(err('E_TIMEOUT', `Tool "${tool.manifest.id}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();

    const onAbort = (): void => {
      child.kill('SIGTERM');
      finish(err('E_ABORTED', `Tool "${tool.manifest.id}" was aborted`));
    };
    context.signal.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (chunk: Buffer) => {
      outBytes += chunk.length;
      if (outBytes > MAX_OUTPUT_BYTES) {
        child.stdout.pause();
        child.kill('SIGKILL');
        finish(err('E_OUTPUT_TOO_LARGE', `Tool "${tool.manifest.id}" exceeded ${MAX_OUTPUT_BYTES} bytes of output`));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      errBytes += chunk.length;
      if (errBytes > MAX_OUTPUT_BYTES) {
        child.stderr.pause();
        return;
      }
      stderrChunks.push(chunk);
    });
    child.on('error', (e) => finish(err('E_SPAWN', `Cannot spawn "${command}"`, String(e))));
    child.on('close', (code) => {
      // Decode accumulated buffers once — avoids U+FFFD from split multi-byte sequences.
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      if (code !== 0) {
        return finish(err('E_EXIT', `Tool exited with code ${code}`, stderr.trim() || undefined));
      }
      const line = lastJsonLine(stdout);
      if (!line) {
        return finish(err('E_NO_OUTPUT', 'Tool produced no JSON response', stderr.trim() || undefined));
      }
      try {
        const res = decodeResponse(line);
        if (res.id !== requestId) {
          return finish(err('E_ID_MISMATCH', 'Response id did not match request id'));
        }
        return finish(res.ok ? ok(res.output) : { ok: false, error: res.error });
      } catch (cause) {
        return finish(err('E_BAD_JSON', 'Malformed JSON response from tool', String(cause)));
      }
    });

    // Swallow stdin stream errors (e.g. EPIPE when the tool exits without
    // reading) — the outcome is decided by 'close'/'error'/timeout instead.
    child.stdin.on('error', () => {});
    if (child.stdin.writable) {
      child.stdin.write(encodeRequest(request));
      child.stdin.end();
    }
  });
}

/** Return the last non-empty line of `out`, or null when there is none. */
function lastJsonLine(out: string): string | null {
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}
