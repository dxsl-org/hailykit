import { randomUUID } from 'node:crypto';
import { ToolRegistry } from './tool-registry';
import { DirectRouter, type RoutingStrategy } from './tool-router';
import { discoverTools } from './tool-discovery';
import { executeNative } from './executors/native-executor';
import { executeExternal, type ExternalExecOptions } from './executors/external-executor';
import { err, type Tool, type ToolContext, type ToolResult } from './types';
import { createConsoleLogger, type Logger } from '../utils/logger';

export interface EngineOptions {
  /** Logger for engine + tool diagnostics. Defaults to a console logger. */
  logger?: Logger;
  /** Routing strategy. Defaults to {@link DirectRouter}. */
  router?: RoutingStrategy;
  /** Options forwarded to the external (polyglot) executor. */
  external?: ExternalExecOptions;
}

export interface RunOptions {
  /** Working directory for the tool. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Session id. Defaults to a fresh UUID. */
  sessionId?: string;
  /** Cancellation signal. Defaults to a never-aborting signal. */
  signal?: AbortSignal;
  /** Shared state map. Defaults to a fresh empty map. */
  sharedState?: Map<string, unknown>;
}

/**
 * Facade that ties the registry, router, and executors together. Construct
 * once, register/discover tools, then call {@link Engine.run}.
 */
export class Engine {
  /** The tool registry — exposed for inspection (`list`, `has`). */
  readonly registry = new ToolRegistry();
  private readonly logger: Logger;
  private readonly router: RoutingStrategy;
  private readonly externalOpts: ExternalExecOptions;

  constructor(options: EngineOptions = {}) {
    this.logger = options.logger ?? createConsoleLogger();
    this.router = options.router ?? new DirectRouter();
    this.externalOpts = options.external ?? {};
  }

  /** Register a single tool programmatically. Returns `this` for chaining. */
  register(tool: Tool): this {
    this.registry.register(tool);
    return this;
  }

  /**
   * Discover and register every tool under `rootDir` (directories holding a
   * `tool.json`). Returns `this` for chaining.
   */
  discover(rootDir: string): this {
    for (const tool of discoverTools(rootDir)) {
      this.registry.register(tool);
    }
    return this;
  }

  /**
   * Execute a tool by id. Never throws — inspect the returned `ToolResult`.
   * @param toolId - Tool to run.
   * @param input - JSON-compatible input passed to the tool.
   * @param options - Per-run context overrides.
   */
  async run(toolId: string, input: unknown, options: RunOptions = {}): Promise<ToolResult> {
    const tool = this.router.resolve(toolId, this.registry);
    if (!tool) return err('E_TOOL_NOT_FOUND', `Tool not found: "${toolId}"`);

    const context: ToolContext = {
      sessionId: options.sessionId ?? randomUUID(),
      cwd: options.cwd ?? process.cwd(),
      sharedState: options.sharedState ?? new Map<string, unknown>(),
      logger: this.logger,
      signal: options.signal ?? new AbortController().signal,
    };

    return tool.manifest.kind === 'native'
      ? executeNative(tool, input, context)
      : executeExternal(tool, input, context, this.externalOpts);
  }
}
