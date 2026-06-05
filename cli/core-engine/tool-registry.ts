import type { Tool } from './types';
import { ToolNotFoundError } from '../utils/errors';

/**
 * In-memory registry of tools keyed by manifest id. Metadata is held eagerly;
 * native handler code is loaded lazily by the executor on first use.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /**
   * Register a tool.
   * @param tool - The tool to register.
   * @throws {Error} when a tool with the same id is already registered.
   */
  register(tool: Tool): void {
    const { id } = tool.manifest;
    if (this.tools.has(id)) {
      throw new Error(`Duplicate tool id: "${id}"`);
    }
    this.tools.set(id, tool);
  }

  /**
   * Return the tool registered under `id`.
   * @throws {ToolNotFoundError} when no such tool exists.
   */
  get(id: string): Tool {
    const tool = this.tools.get(id);
    if (!tool) throw new ToolNotFoundError(id);
    return tool;
  }

  /** Whether a tool with `id` is registered. */
  has(id: string): boolean {
    return this.tools.has(id);
  }

  /** All registered tools, in registration order. */
  list(): Tool[] {
    return [...this.tools.values()];
  }

  /** Number of registered tools. */
  get size(): number {
    return this.tools.size;
  }
}
