import type { Tool, ToolContext, ToolResult } from '../types';
import { err } from '../types';

/**
 * Execute a native (in-process) tool. The handler is loaded lazily on first
 * use. Any throw inside the handler is captured and converted to a failure
 * result so the executor boundary never throws.
 *
 * @param tool - A native tool (must have `loadHandler`).
 * @param input - Arbitrary JSON-compatible input.
 * @param context - Shared execution context.
 * @returns The handler's result, or a failure result on load/throw.
 */
export async function executeNative(
  tool: Tool,
  input: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  if (!tool.loadHandler) {
    return err('E_NOT_NATIVE', `Tool "${tool.manifest.id}" is not a native tool`);
  }
  try {
    const handler = await tool.loadHandler();
    return await handler(input, context);
  } catch (cause) {
    return err('E_NATIVE_THROW', `Native tool "${tool.manifest.id}" threw`, String(cause));
  }
}
