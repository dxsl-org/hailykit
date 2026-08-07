import { sha256 } from '../reasoning-harness/hash';

export type ArtifactFieldPolicy = 'forbidden' | 'hash' | 'redacted_excerpt' | 'allowed';

const POLICY_BY_KEY: Record<string, ArtifactFieldPolicy> = {
  prompt: 'forbidden',
  stdout: 'forbidden',
  stderr: 'forbidden',
  toolOutput: 'forbidden',
  rawOutput: 'forbidden',
  parsedOutput: 'forbidden',
  fixturePrompt: 'forbidden',
  promptText: 'forbidden',
  cwd: 'forbidden',
  fixtureRoot: 'forbidden',
  finalAnswer: 'hash',
  rootDir: 'hash',
  note: 'redacted_excerpt',
  summaryMarkdown: 'redacted_excerpt',
};

export function redactBenchmarkRecord<T>(value: T, canaries: string[] = []): T {
  return redactValue(value, canaries, '') as T;
}

function redactValue(value: unknown, canaries: string[], key: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, canaries, key));
  if (!value || typeof value !== 'object') return redactScalar(value, canaries, key);
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [childKey, childValue]) => {
    acc[childKey] = redactValue(childValue, canaries, childKey);
    return acc;
  }, {});
}

function redactScalar(value: unknown, canaries: string[], key: string): unknown {
  if (typeof value !== 'string') return value;
  const policy = POLICY_BY_KEY[key] ?? 'allowed';
  const hasCanary = canaries.some((entry) => entry && value.includes(entry));
  if (policy === 'forbidden' && value.trim()) throw new Error(`refusing to persist forbidden field: ${key}`);
  if (policy === 'hash') return value ? `sha256:${sha256(value)}` : value;
  if (policy === 'redacted_excerpt') return hasCanary ? '[REDACTED]' : excerpt(value);
  if (hasCanary) throw new Error(`refusing to persist canary content in allowed field: ${key}`);
  return value;
}

function excerpt(value: string): string {
  const escaped = value.replace(/\s+/g, ' ').trim();
  return escaped.length > 96 ? `${escaped.slice(0, 93)}...` : escaped;
}
