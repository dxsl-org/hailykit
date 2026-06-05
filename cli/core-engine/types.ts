import type { Logger } from '../utils/logger';

/** Discriminates how a tool is executed. */
export type ToolKind = 'native' | 'external';

/**
 * Declarative metadata for a tool, stored in a `tool.json` sidecar (or built
 * inline for programmatically-registered native tools). The shape is
 * language-agnostic so polyglot (external) tools declare metadata identically.
 */
export interface ToolManifest {
  /** Unique tool identifier (kebab-case); used for routing. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** One-line description of what the tool does. */
  description: string;
  /** Semantic version of the tool. */
  version: string;
  /** Execution kind. */
  kind: ToolKind;
  /** Native tools only: module path (relative to the manifest dir) exporting a handler. */
  entry?: string;
  /** External tools only: executable to spawn. */
  command?: string;
  /** External tools only: arguments passed to the executable before the JSON request. */
  args?: string[];
}

/**
 * Runtime context threaded into every tool invocation. The same object is
 * shared across a session so cooperating tools can exchange data via
 * `sharedState`.
 */
export interface ToolContext {
  /** Stable id for the current session/run. */
  sessionId: string;
  /** Working directory the tool should operate against. */
  cwd: string;
  /** In-memory state shared across tools within a session. */
  sharedState: Map<string, unknown>;
  /** Engine-scoped logger. */
  logger: Logger;
  /** Cooperative cancellation signal. */
  signal: AbortSignal;
}

/** Structured error returned by a failed tool execution. */
export interface ToolError {
  /** Stable machine-readable code (e.g. `"E_TIMEOUT"`). */
  code: string;
  /** Human-readable message. */
  message: string;
  /** Optional extra diagnostic data. */
  detail?: unknown;
}

/**
 * Discriminated result of a tool execution. The executor boundary never
 * throws — callers must branch on `ok`.
 */
export type ToolResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: ToolError };

/** Handler signature implemented by native (in-process) tools. */
export type NativeToolHandler<I = unknown, O = unknown> = (
  input: I,
  context: ToolContext,
) => Promise<ToolResult<O>> | ToolResult<O>;

/**
 * A registered tool: its manifest plus, for native tools, a lazy loader for
 * the handler. External tools resolve their command at execution time.
 */
export interface Tool {
  manifest: ToolManifest;
  /** Directory the manifest was discovered in; absent for programmatic tools. */
  baseDir?: string;
  /** Lazily load the native handler. Present only when `kind === 'native'`. */
  loadHandler?: () => Promise<NativeToolHandler>;
}

/** Construct a success result. */
export function ok<T>(value: T): ToolResult<T> {
  return { ok: true, value };
}

/** Construct a failure result. */
export function err(code: string, message: string, detail?: unknown): ToolResult<never> {
  return { ok: false, error: { code, message, detail } };
}
