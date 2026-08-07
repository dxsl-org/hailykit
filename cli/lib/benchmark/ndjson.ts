import fs from 'node:fs';
import path from 'node:path';
import { redactBenchmarkRecord } from './redaction';
import { validateBenchmarkEvent } from './schema';
import type { BenchmarkEvent } from './types';

export function parseBenchmarkNdjson(text: string): BenchmarkEvent[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (!lines.length) throw new Error('benchmark NDJSON is empty');
  return lines.map((line, index) => validateBenchmarkEvent(parseLine(line, index + 1)));
}

export function stringifyBenchmarkNdjson(events: BenchmarkEvent[], canaries: string[] = []): string {
  return events.map((entry) => JSON.stringify(redactBenchmarkRecord(entry, canaries))).join('\n') + '\n';
}

export function writeBenchmarkNdjson(filePath: string, events: BenchmarkEvent[], canaries: string[] = []): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tempPath, stringifyBenchmarkNdjson(events, canaries), 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function parseLine(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`benchmark NDJSON line ${lineNumber} is not valid JSON: ${(error as Error).message}`);
  }
}
