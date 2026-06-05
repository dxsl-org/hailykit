import path from 'node:path';
import { Engine, type EngineOptions } from '../core-engine/engine';

/** Options common to the engine CLI commands. */
export interface EngineCliOptions {
  /** Directory of tool manifests to discover. */
  toolsDir: string;
  /** External-tool timeout in ms (forwarded to the executor). */
  timeoutMs?: number;
}

/** Build an engine and discover tools from `toolsDir`. */
function buildEngine(options: EngineCliOptions): Engine {
  const engineOptions: EngineOptions = {};
  if (options.timeoutMs !== undefined) {
    engineOptions.external = { timeoutMs: options.timeoutMs };
  }
  return new Engine(engineOptions).discover(path.resolve(options.toolsDir));
}

/**
 * `hailykit list` — print every discovered tool.
 * @returns Process exit code.
 */
export function cmdList(options: EngineCliOptions): number {
  const tools = buildEngine(options).registry.list();
  if (tools.length === 0) {
    console.log(`No tools found in ${options.toolsDir}`);
    return 0;
  }
  for (const { manifest } of tools) {
    console.log(`${manifest.id}  [${manifest.kind}]  v${manifest.version}  — ${manifest.description}`);
  }
  return 0;
}

/**
 * `hailykit info <tool>` — print a tool's manifest as JSON.
 * @returns Process exit code (1 when the tool id is missing/unknown).
 */
export function cmdInfo(toolId: string | undefined, options: EngineCliOptions): number {
  if (!toolId) {
    console.error('Usage: hailykit info <tool> [--tools <dir>]');
    return 1;
  }
  const registry = buildEngine(options).registry;
  if (!registry.has(toolId)) {
    console.error(`Tool not found: "${toolId}"`);
    return 1;
  }
  console.log(JSON.stringify(registry.get(toolId).manifest, null, 2));
  return 0;
}

/**
 * `hailykit run <tool> --input <json>` — execute a tool and print its result.
 * @returns Process exit code (0 success, 1 failure or bad usage/input).
 */
export async function cmdRun(
  toolId: string | undefined,
  input: string,
  options: EngineCliOptions,
): Promise<number> {
  if (!toolId) {
    console.error('Usage: hailykit run <tool> [--input <json>] [--tools <dir>] [--timeout <ms>]');
    return 1;
  }
  let parsedInput: unknown = {};
  if (input) {
    try {
      parsedInput = JSON.parse(input);
    } catch (e) {
      console.error(`Invalid --input JSON: ${String(e)}`);
      return 1;
    }
  }
  const result = await buildEngine(options).run(toolId, parsedInput);
  if (result.ok) {
    console.log(JSON.stringify(result.value, null, 2));
    return 0;
  }
  console.error(`✗ ${result.error.code}: ${result.error.message}`);
  if (result.error.detail) console.error(String(result.error.detail));
  return 1;
}
