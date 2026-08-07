import type { EvalUsage } from '../types';
import { emptyUsage, extractAnswer, isAnswer, numberField, safeJson, walkable } from './answer-json';

export interface CodexJsonTelemetry {
  answer: string | null;
  modelId: string | null;
  usage: EvalUsage;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  hasProviderCost: boolean;
}

const INPUT_KEYS = ['input_tokens', 'inputTokens'];
const OUTPUT_KEYS = ['output_tokens', 'outputTokens'];
const TOTAL_KEYS = ['total_tokens', 'totalTokens'];
const COST_KEYS = ['cost_usd', 'costUsd'];
const CACHE_READ_KEYS = ['cache_read_input_tokens', 'cached_input_tokens', 'cacheReadTokens'];
const CACHE_WRITE_KEYS = ['cache_creation_input_tokens', 'cache_write_input_tokens', 'cacheWriteTokens'];
const REASONING_KEYS = ['reasoning_output_tokens', 'reasoning_tokens', 'reasoningTokens'];

export function parseCodexJsonOutput(stdout: string): CodexJsonTelemetry {
  const events = parseEvents(stdout);
  const inputTokens = findLastNumber(events, INPUT_KEYS);
  const outputTokens = findLastNumber(events, OUTPUT_KEYS);
  const totalTokens = findLastNumber(events, TOTAL_KEYS);
  const costUsd = findLastNumber(events, COST_KEYS);
  return {
    answer: firstOf(events, findAnswer),
    modelId: firstOf(events, findModel),
    usage: hasUsage(inputTokens, outputTokens, totalTokens, costUsd)
      ? {
        inputTokens,
        outputTokens,
        totalTokens: totalTokens ?? deriveTotal(inputTokens, outputTokens),
        costUsd,
      }
      : emptyUsage(),
    cacheReadTokens: findLastNumber(events, CACHE_READ_KEYS),
    cacheWriteTokens: findLastNumber(events, CACHE_WRITE_KEYS),
    reasoningTokens: findLastNumber(events, REASONING_KEYS),
    hasProviderCost: costUsd !== null,
  };
}

function parseEvents(stdout: string): unknown[] {
  const events = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => {
      const parsed = safeJson(line);
      return parsed === null ? [] : [parsed];
    });
  if (!events.length) {
    const parsed = safeJson(stdout);
    if (parsed !== null) events.push(parsed);
  }
  return events.reverse();
}

function hasUsage(inputTokens: number | null, outputTokens: number | null, totalTokens: number | null, costUsd: number | null): boolean {
  return inputTokens !== null || outputTokens !== null || totalTokens !== null || costUsd !== null;
}

function deriveTotal(inputTokens: number | null, outputTokens: number | null): number | null {
  return inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
}

function firstOf<T>(events: unknown[], pick: (value: unknown) => T | null): T | null {
  for (const event of events) {
    const found = pick(event);
    if (found !== null) return found;
  }
  return null;
}

function findAnswer(value: unknown): string | null {
  if (isAnswer(value)) return JSON.stringify(value);
  if (typeof value === 'string') return extractAnswer(value);
  const record = walkable(value);
  if (!record) return null;
  for (const child of Object.values(record)) {
    const found = findAnswer(child);
    if (found) return found;
  }
  return null;
}

function findModel(value: unknown): string | null {
  const record = walkable(value);
  if (!record) return null;
  if (typeof record.model === 'string' && record.model.trim()) return record.model.trim();
  for (const child of Object.values(record)) {
    const found = findModel(child);
    if (found) return found;
  }
  return null;
}

function findLastNumber(values: unknown[], keys: string[]): number | null {
  for (const value of values) {
    const found = walkNumber(value, keys);
    if (found !== null) return found;
  }
  return null;
}

function walkNumber(value: unknown, keys: string[]): number | null {
  const record = walkable(value);
  if (!record) return null;
  const direct = numberField(record, keys);
  if (direct !== null) return direct;
  for (const child of Object.values(record)) {
    const found = walkNumber(child, keys);
    if (found !== null) return found;
  }
  return null;
}
