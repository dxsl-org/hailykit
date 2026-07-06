import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOutput } from '../lib/cross-review/normalize';

test('parses a clean findings object', () => {
  const out = normalizeOutput('{"findings":[{"severity":"critical","file":"a.ts","line":5,"summary":"boom","evidence":"why"}]}');
  assert.equal(out.findings.length, 1);
  assert.deepEqual(out.findings[0], { severity: 'critical', file: 'a.ts', line: 5, summary: 'boom', evidence: 'why' });
});

test('extracts findings object from surrounding CLI event noise', () => {
  const stdout = [
    '{"type":"event","msg":"thinking"}',
    'some prose preamble',
    '{"findings":[{"severity":"medium","summary":"missing test"}]}',
    '{"type":"event","msg":"done"}',
  ].join('\n');
  const out = normalizeOutput(stdout);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].summary, 'missing test');
});

test('takes the LAST findings object when several appear', () => {
  const stdout = '{"findings":[{"severity":"low","summary":"first"}]}\n{"findings":[{"severity":"high","summary":"second"}]}';
  const out = normalizeOutput(stdout);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].summary, 'second');
  assert.equal(out.findings[0].severity, 'critical'); // high → critical
});

test('coerces non-canonical severities', () => {
  const out = normalizeOutput('{"findings":[{"severity":"warning","summary":"w"},{"severity":"blocker","summary":"b"},{"severity":"nonsense","summary":"n"}]}');
  assert.deepEqual(out.findings.map(f => f.severity), ['medium', 'critical', 'low']);
});

test('empty findings array yields no findings and no raw', () => {
  const out = normalizeOutput('{"findings":[]}');
  assert.equal(out.findings.length, 0);
  assert.equal(out.raw, undefined);
});

test('unparseable output is preserved as raw', () => {
  const out = normalizeOutput('the model refused and wrote prose only');
  assert.equal(out.findings.length, 0);
  assert.match(out.raw ?? '', /refused/);
});

test('drops findings without a summary', () => {
  const out = normalizeOutput('{"findings":[{"severity":"low"},{"summary":"kept"}]}');
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].summary, 'kept');
});

test('extracts findings from a gemini-style envelope (escaped + fenced)', () => {
  const inner = '```json\n' + JSON.stringify({ findings: [{ severity: 'critical', summary: 'boom' }] }) + '\n```';
  const gemini = JSON.stringify({ session_id: 'x', response: inner, stats: { models: {} } });
  const out = normalizeOutput(gemini);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].severity, 'critical');
  assert.equal(out.findings[0].summary, 'boom');
});

test('extracts findings from cline-style NDJSON say events', () => {
  const answer = JSON.stringify({ findings: [{ severity: 'low', summary: 'note' }] });
  const stdout = [
    JSON.stringify({ type: 'agent_event', event: { type: 'iteration_start' } }),
    JSON.stringify({ type: 'say', text: answer }),
    JSON.stringify({ type: 'agent_event', event: { type: 'done' } }),
  ].join('\n');
  const out = normalizeOutput(stdout);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].summary, 'note');
});

test('bounded on huge brace-dense output (no O(n^2) hang)', () => {
  // ~1.5 MB of lone "{" then a valid answer at the very end. The old scanner
  // called matchBrace from every "{"; this must return promptly.
  const noise = '{'.repeat(1_500_000);
  const stdout = `${noise}\n{"findings":[{"severity":"low","summary":"tail answer"}]}`;
  const start = process.hrtime.bigint();
  const out = normalizeOutput(stdout);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].summary, 'tail answer');
  assert.ok(ms < 2000, `parse took ${ms.toFixed(0)}ms — should be bounded`);
});

test('an echoed non-parseable schema example is not mistaken for findings', () => {
  // The prompt's schema uses <…> placeholders → invalid JSON → ignored.
  const echoed = '{"findings":[{"severity":<"critical"|"medium"|"low">,"summary":<"one line">}]}';
  const out = normalizeOutput(echoed);
  assert.equal(out.findings.length, 0);
  assert.ok(out.raw); // preserved as raw, not a bogus finding
});

test('handles braces inside string values', () => {
  const out = normalizeOutput('{"findings":[{"severity":"low","summary":"regex uses \\\\{n\\\\} quantifier"}]}');
  assert.equal(out.findings.length, 1);
  assert.match(out.findings[0].summary, /quantifier/);
});
