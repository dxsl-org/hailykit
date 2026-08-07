import { spawn } from 'node:child_process';
import { EOL } from 'node:os';

export interface CodexAppServerEnvelope { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { message?: string } | null; }
export interface CodexAppServerInitializeResponse { codexHome: string; platformFamily: string; platformOs: string; userAgent: string; }
export interface CodexAppServerThreadStartResponse { approvalPolicy: unknown; cwd: string; model: string; modelProvider: string; sandbox: unknown; thread: { id: string }; }
export interface CodexAppServerTurnStartResponse { turn: { id: string; status?: string | null }; }
export interface CodexAppServerClient {
  initialize(): Promise<CodexAppServerInitializeResponse>;
  startThread(params: Record<string, unknown>): Promise<CodexAppServerThreadStartResponse>;
  startTurn(params: Record<string, unknown>): Promise<CodexAppServerTurnStartResponse>;
  interruptTurn(threadId: string, turnId: string): Promise<void>;
  nextEnvelope(timeoutMs: number): Promise<CodexAppServerEnvelope>;
  close(): Promise<void>;
}

export function spawnOwnedCodexAppServerClient(cwd: string): CodexAppServerClient {
  const child = spawn('codex', ['app-server', '--stdio'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const queue: CodexAppServerEnvelope[] = [];
  const waiters: Array<{ resolve: (value: CodexAppServerEnvelope) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }> = [];
  let nextId = 1;
  let closing = false;
  let exited = false;
  let stderr = '';
  let closePromise: Promise<void> | null = null;
  wire(child.stdout, (line) => handleMessage(safeJson(line)));
  wire(child.stderr, (line) => { stderr = `${stderr}${line}${EOL}`.slice(-4000); });
  child.on('error', (error) => closeWithError(new Error(`codex app-server spawn failed: ${excerpt(error.message)}`)));
  child.on('exit', (code, signal) => {
    exited = true;
    closeWithError(new Error(`codex app-server exited (${signal ?? code ?? 'unknown'})${stderr ? `: ${excerpt(stderr)}` : ''}`));
  });
  return {
    initialize: async () => {
      const result = await request('initialize', { clientInfo: { name: 'hailykit', version: '1.0.0' }, capabilities: { requestAttestation: false, experimentalApi: false, optOutNotificationMethods: [] } });
      notify('initialized', {});
      return asObject(result) as unknown as CodexAppServerInitializeResponse;
    },
    startThread: async (params) => asObject(await request('thread/start', params)) as unknown as CodexAppServerThreadStartResponse,
    startTurn: async (params) => asObject(await request('turn/start', params)) as unknown as CodexAppServerTurnStartResponse,
    interruptTurn: async (threadId, turnId) => { await request('turn/interrupt', { threadId, turnId }); },
    nextEnvelope: (timeoutMs) => waitEnvelope(timeoutMs),
    close: async () => {
      if (closePromise) return closePromise;
      const closeError = new Error('codex app-server client closed');
      closeWithError(closeError);
      closePromise = exited
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            let done = false;
            const finish = () => { if (done) return; done = true; resolve(); };
            const timer = setTimeout(() => {
              try { if (!exited) child.kill(); } catch { /* ignore close races */ }
              finish();
            }, 1_000);
            child.once('exit', () => {
              clearTimeout(timer);
              finish();
            });
            try { child.kill(); } catch { clearTimeout(timer); finish(); }
          });
      await closePromise;
    },
  };

  function request(method: string, params: unknown): Promise<unknown> {
    if (closing) return Promise.reject(new Error('codex app-server client is closing'));
    const id = nextId++;
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      sendJson({ jsonrpc: '2.0', id, method, params }, id, reject);
    });
  }
  function notify(method: string, params: unknown): void {
    if (closing) return;
    sendJson({ jsonrpc: '2.0', method, params }, null, () => undefined);
  }
  function waitEnvelope(timeoutMs: number): Promise<CodexAppServerEnvelope> {
    if (queue.length) return Promise.resolve(queue.shift()!);
    return new Promise<CodexAppServerEnvelope>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.timer === timer);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('codex app-server event timed out'));
      }, Math.max(1, timeoutMs));
      waiters.push({ resolve, reject, timer });
    });
  }
  function handleMessage(message: CodexAppServerEnvelope | null): void {
    if (!message) return;
    if (message.id !== undefined && (Object.prototype.hasOwnProperty.call(message, 'result') || Object.prototype.hasOwnProperty.call(message, 'error'))) {
      const slot = pending.get(Number(message.id));
      if (!slot) return;
      pending.delete(Number(message.id));
      if (message.error) slot.reject(new Error(message.error.message || 'codex app-server request failed'));
      else slot.resolve(message.result);
      return;
    }
    enqueue(message);
  }
  function enqueue(message: CodexAppServerEnvelope): void {
    const waiter = waiters.shift();
    if (waiter) { clearTimeout(waiter.timer); waiter.resolve(message); return; }
    queue.push(message);
  }
  function closeWithError(error: Error): void {
    if (!closing) closing = true;
    for (const slot of pending.values()) slot.reject(error);
    pending.clear();
    while (waiters.length) {
      const waiter = waiters.shift()!;
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
  function sendJson(payload: Record<string, unknown>, requestId: number | null, reject: (error: Error) => void): void {
    child.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
      if (!error) return;
      if (requestId !== null) pending.delete(requestId);
      const wrapped = new Error(`codex app-server stdin write failed: ${excerpt(error.message)}`);
      reject(wrapped);
      closeWithError(wrapped);
    });
  }
}

function wire(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
  let buffered = '';
  stream.on('data', (chunk: Buffer | string) => {
    buffered += chunk.toString();
    for (let newline = buffered.indexOf('\n'); newline >= 0; newline = buffered.indexOf('\n')) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      if (line) onLine(line);
    }
  });
}
function safeJson(line: string): CodexAppServerEnvelope | null { try { return JSON.parse(line) as CodexAppServerEnvelope; } catch { return null; } }
function asObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('codex app-server returned a malformed object'); return value as Record<string, unknown>; }
function excerpt(value: string): string { return value.replace(/\s+/g, ' ').trim().slice(0, 200); }
