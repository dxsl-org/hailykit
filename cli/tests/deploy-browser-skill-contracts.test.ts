import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_BYTES = 13075;
const MAX_TOTAL_BYTES = 7845;
const MAX_DEPLOY_BYTES = 4116;
const MAX_BROWSER_BYTES = 3729;
const DEPLOY = 'kit/skills/hc-deploy/SKILL.md';
const BROWSER = 'kit/skills/hc-browser/SKILL.md';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function bytes(relativePath: string): number {
  return Buffer.byteLength(read(relativePath), 'utf8');
}

test('deploy and browser skill frontmatter remains byte-identical', () => {
  const expected = new Map([
    [DEPLOY, `---
name: hc-deploy
description: "First-time platform deployment with auto-detection and cost-optimized recommendations."
when_to_use: "Invoke for first-time platform setup or deploying personal projects, MVPs, and early-stage apps to Vercel, Netlify, Railway, Fly.io, etc. NOT for enterprise CI/CD pipelines — use {skill:hc-devops} for those."
user-invocable: true
argument-hint: "[platform] [environment]"
metadata:
  category: infrastructure
  keywords: [deploy, hosting, Vercel, Netlify, Cloudflare]
---
`],
    [BROWSER, `---
name: hc-browser
description: "AI-driven browser automation for long autonomous sessions."
when_to_use: "Invoke when running AI-driven browser sessions, Browserbase cloud automation, or reading a page that blocks plain fetch (403 bot wall, JS-rendered SPA returning an empty shell)."
user-invocable: true
argument-hint: "[url or task]"
metadata:
  category: dev-tools
  keywords: [browser, automation, playwright, testing]
---
`],
  ]);

  for (const [file, frontmatter] of expected) {
    assert.ok(read(file).startsWith(frontmatter), `${file} frontmatter changed`);
  }
});

test('deploy skill retains safety, routing, references, and escalation contracts', () => {
  const source = read(DEPLOY);
  const markers = [
    '**Required — credentials safety:**',
    '**Required — scope boundary:**',
    'stop at first match',
    '`AskUserQuestion`',
    'Verify current pricing',
    '`vercel.json`/`.vercel` → Vercel',
    'static/SPA → Pages, Vercel, or Netlify',
    '`docs/deployment.md`',
    '`references/platform-deploy-commands.md`',
    '`references/platform-config-templates.md`',
    'CI/CD or release automation',
    'Docker networking or multi-container orchestration',
    'Kubernetes',
    'Cloudflare Workers, R2, D1, or KV',
    'VPC, IAM, or subnet failures',
    'DNS, SSL, or reverse-proxy configuration',
    'GitOps or IaC with Terraform or Pulumi',
    'RBAC, secrets management, or network policies',
    '**Follows:** `{skill:hc-cook}`',
    '**Escalates to:** `{skill:hc-devops}`',
    '**Related:** `{skill:hc-ship}`',
  ];
  const platformRefs = [
    'vercel.md', 'netlify.md', 'cloudflare.md', 'railway.md', 'flyio.md',
    'render.md', 'heroku.md', 'tose.md', 'github-pages.md', 'coolify.md',
    'dokploy.md', 'gcp.md', 'aws.md', 'digitalocean.md', 'vultr.md',
  ];

  for (const marker of markers) assert.ok(source.includes(marker), `hc-deploy lost: ${marker}`);
  for (const file of platformRefs) {
    assert.ok(source.includes(`references/platforms/${file}`), `hc-deploy lost platform reference: ${file}`);
  }
});

test('browser skill retains public-fallback and fresh-reference contracts', () => {
  const source = read(BROWSER);
  for (const marker of [
    '`{skill:hc-debug}`',
    '`{skill:hc-test}`',
    '403',
    'bot wall',
    'near-empty JS-rendered response',
    'Login-walled content is out of scope',
    'Never bypass authentication or anti-bot controls',
    'agent-browser snapshot -i',
    'npm install -g agent-browser',
    'agent-browser install',
    '@e1',
    're-snapshot after navigation or other state changes',
    'agent-browser open <url>',
    'agent-browser wait --idle',
    'agent-browser get text',
    'agent-browser close',
    'Do not click, submit forms, persist authentication, or mutate remote state',
    'references/browserbase-cloud-setup.md',
    'references/agent-browser-vs-chrome-devtools.md',
    '**Follows:** `{skill:hc-lookup}`, `{skill:hl-research}`',
    '**Related:** `{skill:hc-debug}`, `{skill:hc-test}`',
  ]) {
    assert.ok(source.includes(marker), `hc-browser lost: ${marker}`);
  }
});

test('deploy and browser skills stay below the batch byte ceiling', () => {
  const deployBytes = bytes(DEPLOY);
  const browserBytes = bytes(BROWSER);
  const total = deployBytes + browserBytes;
  assert.ok(deployBytes <= MAX_DEPLOY_BYTES, `hc-deploy total ${deployBytes} exceeds ${MAX_DEPLOY_BYTES}`);
  assert.ok(browserBytes <= MAX_BROWSER_BYTES, `hc-browser total ${browserBytes} exceeds ${MAX_BROWSER_BYTES}`);
  assert.ok(total <= MAX_TOTAL_BYTES, `skill total ${total} exceeds ${MAX_TOTAL_BYTES}`);
  assert.ok(total < BASELINE_BYTES, `skill total ${total} did not improve over ${BASELINE_BYTES}`);
  assert.ok(!read(DEPLOY).includes('## Platform Priority'), 'drift-prone pricing catalog returned');
  assert.ok(!read(BROWSER).includes('## Command Reference'), 'duplicated CLI manual returned');
});
