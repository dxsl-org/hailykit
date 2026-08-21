import fs from 'node:fs';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';

export const repoMap = path.resolve('kit', 'pi', 'extensions', 'hailykit', 'model-map.json');
export const canonicalMap = path.resolve('kit', 'model-map.json');
export const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'haily-pi-phase4-'));

export function patchLoader(agentDir: string): () => void {
  const nodeModule = Module as typeof Module & { _load: Function };
  const originalLoad = nodeModule._load;
  nodeModule._load = function patched(request: string, parent: NodeModule | undefined, isMain: boolean) {
    if (request === '@earendil-works/pi-ai') return { StringEnum: (value: unknown) => value };
    if (request === '@earendil-works/pi-coding-agent') return { CONFIG_DIR_NAME: '.pi', getAgentDir: () => agentDir };
    if (request === 'typebox') return { Type: { Object: (v: unknown) => v, String: () => ({}), Optional: (v: unknown) => v, Array: (v: unknown) => v, Integer: () => ({}) } };
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => { nodeModule._load = originalLoad; };
}

export async function runEvent(handlers: Function[] | undefined, event: Record<string, unknown>, ctx: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
  for (const handler of handlers ?? []) {
    const result = await handler(event, ctx);
    if (result) return result as Record<string, unknown>;
  }
}
