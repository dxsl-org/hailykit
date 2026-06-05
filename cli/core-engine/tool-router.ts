import type { ToolRegistry } from './tool-registry';
import type { Tool } from './types';

/**
 * Strategy for resolving a request string to a concrete tool. The extension
 * point for future intent/keyword/AI-based routing — implement a new strategy
 * and pass it to the engine without touching the execution path.
 */
export interface RoutingStrategy {
  /**
   * Resolve a request to a tool, or `null` when nothing matches.
   * @param request - The routing key (an explicit tool id for `DirectRouter`).
   * @param registry - The registry to resolve against.
   */
  resolve(request: string, registry: ToolRegistry): Tool | null;
}

/**
 * Resolve by exact tool id — the KISS baseline. The CLI already knows which
 * tool the user asked for, so no fuzzy matching is needed for the MVP.
 */
export class DirectRouter implements RoutingStrategy {
  resolve(request: string, registry: ToolRegistry): Tool | null {
    return registry.has(request) ? registry.get(request) : null;
  }
}
