import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE = {
  'kit/skills/hc-mcp-builder/references/agentize-monorepo-layout.md': 4844,
  'kit/skills/hc-mcp-builder/references/agentize-mcp-transports.md': 3671,
  'kit/skills/hc-mcp-builder/references/agentize-auth-resolution-chain.md': 3529,
  'kit/skills/hc-mcp-builder/references/agentize-deployment-guide.md': 3084,
  'kit/skills/hc-mcp-builder/references/agentize-agent-centric-design.md': 2731,
} as const;

function read(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
}

test('hc-mcp-builder cold references preserve architecture and security boundaries', () => {
  const content = Object.fromEntries(Object.keys(BASELINE).map((file) => [file, read(file)]));
  const assertMarkers = (file: keyof typeof BASELINE, markers: string[]) => {
    for (const marker of markers) assert.ok(content[file].includes(marker), `${file} lost: ${marker}`);
  };

  assertMarkers('kit/skills/hc-mcp-builder/references/agentize-monorepo-layout.md', [
    'one shared core, thin CLI and MCP adapters',
    'contain no business logic',
  ]);
  assertMarkers('kit/skills/hc-mcp-builder/references/agentize-mcp-transports.md', [
    'Never write non-protocol bytes to stdout',
    'reject invalid credentials with `401` without revealing which tokens exist',
    'Protect metrics or expose them only on an internal listener',
  ]);
  assertMarkers('kit/skills/hc-mcp-builder/references/agentize-auth-resolution-chain.md', [
    'Dotenv: `.env.local`, `.env.<NODE_ENV>`, then `.env`',
    'walk only to the package/repository root',
    'Never write plaintext credentials',
    'Disable keychain lookup in non-local deployments',
  ]);
  assertMarkers('kit/skills/hc-mcp-builder/references/agentize-deployment-guide.md', [
    'Run as a non-root user',
    'never bake it into the image or Compose file',
    '`MCP_TOKEN` and `MCP_TOKEN_PREV`',
  ]);
  assertMarkers('kit/skills/hc-mcp-builder/references/agentize-agent-centric-design.md', [
    'Destructive tools require explicit `confirm: true`',
    'Creates accept an idempotency key',
  ]);

  assert.match(content['kit/skills/hc-mcp-builder/references/agentize-mcp-transports.md'], /stdio[\s\S]*SSE[\s\S]*Streamable HTTP/, 'all three transports must remain supported');
  assert.match(content['kit/skills/hc-mcp-builder/references/agentize-auth-resolution-chain.md'], /Explicit flag or transport-provided token[\s\S]*Process environment[\s\S]*Dotenv[\s\S]*User config[\s\S]*Project config[\s\S]*OS keychain/, 'auth precedence changed');
});

test('hc-mcp-builder cold batch stays below measured byte budget', () => {
  const entries = Object.entries(BASELINE);
  const baseline = entries.reduce((sum, [, size]) => sum + size, 0);
  const current = entries.reduce((sum, [file]) => sum + Buffer.byteLength(read(file), 'utf8'), 0);
  assert.ok(current <= Math.floor(baseline * 0.8), 'MCP cold batch must stay at least 20% below baseline');
});
