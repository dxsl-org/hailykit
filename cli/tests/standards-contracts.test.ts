import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_BYTES = 11170;
const MAX_TOTAL_BYTES = 7819;
const FILES = [
  'kit/standards/framework-monorepo.md',
  'kit/standards/framework-tailwind.md',
  'kit/standards/framework-shadcn.md',
] as const;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function bytes(relativePath: string): number {
  return Buffer.byteLength(read(relativePath), 'utf8');
}

test('compressed standards preserve monorepo anchors', () => {
  const source = read('kit/standards/framework-monorepo.md');

  for (const marker of [
    'turbo.json',
    'nx.json',
    'pnpm-workspace.yaml',
    'Turborepo + pnpm workspaces',
    'Include only the orchestrator files',
    'apps/',
    'packages/',
    'workspace:*',
    '"tasks"',
    '"^build"',
    '"outputs"',
    "turbo run build --filter='[origin/main]'",
    'nx affected --target=build',
    'TURBO_TOKEN',
    'TURBO_TEAM',
    'NX_CLOUD_ACCESS_TOKEN',
    'Do not mix package managers',
    'Do not commit build artifacts.',
    'hardcoded cross-package relative imports',
  ]) {
    assert.ok(source.includes(marker), `framework-monorepo lost: ${marker}`);
  }
  assert.ok(!source.includes('"pipeline"'), 'framework-monorepo must not restore the legacy Turborepo pipeline key');
});

test('compressed standards preserve tailwind anchors', () => {
  const source = read('kit/standards/framework-tailwind.md');

  for (const marker of [
    'Utility-first',
    'repeated 3+ times',
    'Mobile-first',
    'Do not use dynamic class names',
    'p-[17px]',
    'sm:` `md:` `lg:` `xl:` `2xl:`',
    'max-lg:',
    '@container',
    'darkMode: ["class"]',
    '@theme',
    '@layer base',
    '@layer components',
    '@layer utilities',
    '@utility',
    '16px',
    'max-w-prose',
    'tailwindcss-animate',
  ]) {
    assert.ok(source.includes(marker), `framework-tailwind lost: ${marker}`);
  }
});

test('compressed standards preserve shadcn anchors', () => {
  const source = read('kit/standards/framework-shadcn.md');

  for (const marker of [
    'components/ui',
    'Radix primitives',
    'cva',
    'after 3+ uses',
    'CSS variables',
    'semantic tokens',
    'darkMode: ["class"]',
    'ThemeProvider',
    'aria-label',
    'sr-only',
    '<Label htmlFor>',
    '<FormMessage>',
    'focus-visible:ring-2',
    'motion-reduce:transition-none',
    'React Hook Form + Zod',
    'FormField > FormItem > FormLabel > FormControl > FormMessage',
    'Validate on blur',
  ]) {
    assert.ok(source.includes(marker), `framework-shadcn lost: ${marker}`);
  }
});

test('compressed standards stay under the batch byte ceiling', () => {
  const totalBytes = FILES.reduce((sum, file) => sum + bytes(file), 0);

  assert.ok(totalBytes <= MAX_TOTAL_BYTES, `standards total ${totalBytes} exceeds ${MAX_TOTAL_BYTES}`);
  assert.ok(totalBytes < BASELINE_BYTES, `standards total ${totalBytes} did not improve over ${BASELINE_BYTES}`);
});
