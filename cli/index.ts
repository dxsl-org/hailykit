/**
 * hailykit — public library surface.
 *
 * The runtime engine for registering, routing, and executing tools (native
 * TypeScript or external polyglot executables). The installer subsystem and
 * CLI are not part of this surface; they are invoked via the `hailykit` binary.
 */
export { Engine, type EngineOptions, type RunOptions } from './core-engine/engine';
export { ToolRegistry } from './core-engine/tool-registry';
export { DirectRouter, type RoutingStrategy } from './core-engine/tool-router';
export { discoverTools, parseManifest } from './core-engine/tool-discovery';
export { executeNative } from './core-engine/executors/native-executor';
export {
  executeExternal,
  type ExternalExecOptions,
} from './core-engine/executors/external-executor';
export {
  PROTOCOL_VERSION,
  encodeRequest,
  decodeResponse,
  type ToolRequest,
  type ToolResponse,
} from './core-engine/polyglot-protocol';
export {
  ok,
  err,
  type Tool,
  type ToolManifest,
  type ToolKind,
  type ToolContext,
  type ToolResult,
  type ToolError,
  type NativeToolHandler,
} from './core-engine/types';
export {
  type Logger,
  type LogLevel,
  createConsoleLogger,
  silentLogger,
} from './utils/logger';
export { HailyError, ToolNotFoundError, InvalidManifestError } from './utils/errors';
export { stripJsonComments } from './utils/strip-json-comments';
