import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findCommand } from '../commands/registry';
import { cmdOcr } from '../commands/ocr';
import { loadOcrConfig } from '../lib/ocr/config';
import { resolvePython } from '../lib/ocr/python-resolve';
import { runEngine, appendStdoutBounded, STDOUT_TAIL_CAP_BYTES } from '../lib/ocr/engine-runner';
import { formatProgressLine, stripControlChars } from '../lib/ocr/render';
import type { ProgressEvent } from '../lib/ocr/types';

function tmpConfigDir(contents?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-cfg-'));
  if (contents !== undefined) {
    const claudeDir = path.join(dir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'haily.json'), contents);
  }
  return dir;
}

/** Write a Node script to a temp path and run it via `process.execPath` as a
 *  stand-in for the python engine — proves the runner's streaming/argv/env
 *  behavior without needing a real python + docling install. */
function writeStub(code: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-stub-'));
  const file = path.join(dir, 'stub.js');
  fs.writeFileSync(file, code, 'utf8');
  return file;
}

// --- registry --------------------------------------------------------------

test('registry exposes ocr with its value-flags', () => {
  const spec = findCommand('ocr');
  assert.ok(spec);
  for (const f of ['out', 'max-tier', 'python', 'lang', 'config']) {
    assert.ok(spec!.valueFlags.includes(f), `missing value-flag ${f}`);
  }
});

// --- config merge/sanitize ---------------------------------------------------

test('missing haily.json yields empty ocr config', () => {
  assert.deepEqual(loadOcrConfig(tmpConfigDir()), {});
});

test('malformed JSON yields empty ocr config (never throws)', () => {
  assert.deepEqual(loadOcrConfig(tmpConfigDir('{ not json')), {});
});

test('reads and sanitizes a valid ocr block', () => {
  const dir = tmpConfigDir(JSON.stringify({
    ocr: { max_tier: 'pro', blur_min: 50, models: { flash: 'f-1', pro: 'p-1' }, ocr_lang: ['en', 'vi'], rpm: 10 },
  }));
  assert.deepEqual(loadOcrConfig(dir), {
    max_tier: 'pro', blur_min: 50, models: { flash: 'f-1', pro: 'p-1' }, ocr_lang: ['en', 'vi'], rpm: 10,
  });
});

test('drops invalid max_tier and negative thresholds', () => {
  const dir = tmpConfigDir(JSON.stringify({ ocr: { max_tier: 'ultra', blur_min: -5, rpm: 0 } }));
  assert.deepEqual(loadOcrConfig(dir), {});
});

test('local ocr block overrides global for the same keys', () => {
  const dir = tmpConfigDir(JSON.stringify({ ocr: { python: '/local/python' } }));
  const cfg = loadOcrConfig(dir);
  assert.equal(cfg.python, '/local/python');
});

// --- providers / tier_provider sanitize -------------------------------------

test('providers: valid entries pass through, inline key value is dropped', () => {
  const dir = tmpConfigDir(JSON.stringify({
    ocr: {
      providers: {
        or: { kind: 'openai', model: 'vision-1', base_url: 'https://api.example.com/v1', api_key_env: 'OPENROUTER_API_KEY', api_key: 'sk-should-not-persist' },
      },
      tier_provider: { flash: 'or' },
    },
  }));
  const cfg = loadOcrConfig(dir);
  assert.deepEqual(cfg.providers, {
    or: { kind: 'openai', model: 'vision-1', base_url: 'https://api.example.com/v1', api_key_env: 'OPENROUTER_API_KEY' },
  });
  assert.deepEqual(cfg.tier_provider, { flash: 'or' });
  assert.equal((cfg.providers!.or as Record<string, unknown>).api_key, undefined);
  assert.equal(JSON.stringify(cfg).includes('sk-should-not-persist'), false);
});

test('providers: an unrecognized kind is rejected entirely', () => {
  const dir = tmpConfigDir(JSON.stringify({
    ocr: { providers: { bad: { kind: 'anthropic', model: 'x' } } },
  }));
  const cfg = loadOcrConfig(dir);
  assert.equal(cfg.providers, undefined);
});

test('providers: cli kind keeps a valid command[] array', () => {
  const dir = tmpConfigDir(JSON.stringify({
    ocr: { providers: { local: { kind: 'cli', model: 'm', command: ['gemini', '-m', '{model}', '-p', '{prompt}', '@{image}'] } } },
  }));
  const cfg = loadOcrConfig(dir);
  assert.deepEqual(cfg.providers!.local.command, ['gemini', '-m', '{model}', '-p', '{prompt}', '@{image}']);
});

// --- --config precedence -----------------------------------------------------

test('--config takes precedence over local and global ocr blocks', () => {
  const dir = tmpConfigDir(JSON.stringify({ ocr: { max_tier: 'flash', python: '/local/python' } }));
  const configFile = path.join(dir, 'custom-ocr.json');
  fs.writeFileSync(configFile, JSON.stringify({ max_tier: 'pro' }));
  const cfg = loadOcrConfig(dir, configFile);
  assert.equal(cfg.max_tier, 'pro');
  assert.equal(cfg.python, '/local/python'); // untouched key from local still applies
});

test('--config accepts a full haily.json shape (ocr-wrapped) as well as a bare ocr-config object', () => {
  const dir = tmpConfigDir();
  const configFile = path.join(dir, 'custom.json');
  fs.writeFileSync(configFile, JSON.stringify({ ocr: { max_tier: 'local' } }));
  const cfg = loadOcrConfig(dir, configFile);
  assert.equal(cfg.max_tier, 'local');
});

test('--config missing/malformed contributes nothing (never throws)', () => {
  const dir = tmpConfigDir();
  assert.deepEqual(loadOcrConfig(dir, path.join(dir, 'nope.json')), {});
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{ not json');
  assert.deepEqual(loadOcrConfig(dir, bad), {});
});

// --- python-resolve ladder (fake fs) -----------------------------------------

test('python-resolve: --python flag wins when it exists', () => {
  const r = resolvePython({ flag: '/opt/py/python', existsSync: (p) => p === '/opt/py/python' });
  assert.deepEqual(r, { path: '/opt/py/python', source: 'flag' });
});

test('python-resolve: missing flag falls through to config', () => {
  const r = resolvePython({
    flag: '/missing/python',
    configPython: '/cfg/python',
    existsSync: (p) => p === '/cfg/python',
  });
  assert.deepEqual(r, { path: '/cfg/python', source: 'config' });
});

test('python-resolve: falls through to the skills venv', () => {
  const home = 'C:\\Users\\test';
  const venvPath = path.join(home, '.claude', 'skills', '.venv', 'Scripts', 'python.exe');
  const r = resolvePython({ homeDir: home, platform: 'win32', existsSync: (p) => p === venvPath });
  assert.deepEqual(r, { path: venvPath, source: 'venv' });
});

test('python-resolve: falls through to PATH python3', () => {
  // Use path.join (not a hardcoded separator) so the expected candidate
  // matches exactly what the source computes on whatever OS runs this test.
  const dir1 = path.join('nonexistent-a', 'bin');
  const dir2 = path.join('nonexistent-b', 'bin');
  const candidate = path.join(dir2, 'python3');
  const r = resolvePython({
    platform: 'linux',
    pathEnv: `${dir1}${path.delimiter}${dir2}`,
    existsSync: (p) => p === candidate,
  });
  assert.deepEqual(r, { path: candidate, source: 'path' });
});

test('python-resolve: null when nothing on the ladder exists', () => {
  assert.equal(resolvePython({ existsSync: () => false }), null);
});

// --- control-char stripping ---------------------------------------------------

test('stripControlChars removes ANSI escapes and C0 control bytes, keeps tabs', () => {
  const dirty = '\x1b[31mred\x1b[0m\x07bell\ttab';
  assert.equal(stripControlChars(dirty), 'redbell\ttab');
});

test('stripControlChars leaves plain text untouched', () => {
  assert.equal(stripControlChars('report.pdf'), 'report.pdf');
});

test('formatProgressLine renders a compact status line for a page event and strips control chars in doc', () => {
  const evt: ProgressEvent = { ev: 'page', doc: '\x1b[31mreport.pdf\x1b[0m', page: 12, tier: 'flash', cost_usd: 0.014 };
  const line = formatProgressLine('{"raw":"unused"}', evt);
  assert.equal(line, '[report.pdf] page 12 · flash · $0.014');
});

test('formatProgressLine passes non-page lines through unchanged', () => {
  assert.equal(formatProgressLine('INFO converting foo.pdf', undefined), 'INFO converting foo.pdf');
});

// --- engine-runner: streaming, argv-safety, key handling ---------------------

test('engine-runner streams progress lines before the child exits (not buffered)', async () => {
  const stub = writeStub(`
    process.stderr.write(JSON.stringify({ev:'page',doc:'d',page:1,tier:'flash',status:'done',cost_usd:0.001}) + '\\n');
    setTimeout(() => { console.log(JSON.stringify({ok:true})); }, 300);
  `);
  let sawProgressEarly = false;
  const runPromise = runEngine({
    pythonPath: process.execPath,
    scriptPath: stub,
    check: true,
    onProgress: () => { sawProgressEarly = true; },
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(sawProgressEarly, true, 'progress must surface well before the 300ms exit delay');
  const result = await runPromise;
  assert.equal(result.ok, true);
});

test('engine-runner tolerates non-JSON stderr lines as plain logs', async () => {
  const stub = writeStub(`
    process.stderr.write('INFO plain log line\\n');
    console.log(JSON.stringify({ok:true}));
  `);
  const lines: string[] = [];
  const events: (ProgressEvent | undefined)[] = [];
  const result = await runEngine({
    pythonPath: process.execPath, scriptPath: stub, check: true,
    onProgress: (line, evt) => { lines.push(line); events.push(evt); },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(lines, ['INFO plain log line']);
  assert.equal(events[0], undefined);
});

test('engine-runner: job travels via a temp file, never argv, and the temp file is cleaned up', async () => {
  const stub = writeStub(`
    const fs = require('fs');
    const jobPath = process.argv[3];
    const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
    console.log(JSON.stringify({
      ok: true,
      argvHasJobJson: process.argv.some((a) => a.includes('"input"')),
      jobInputMatches: job.input === 'INPUT_MARKER',
      jobOutputMatches: job.output === 'OUTPUT_MARKER',
    }));
  `);
  const tmpDir = os.tmpdir();
  const before = fs.readdirSync(tmpDir).filter((f) => f.startsWith('hailykit-ocr-'));

  const result = await runEngine({
    pythonPath: process.execPath,
    scriptPath: stub,
    job: { input: 'INPUT_MARKER', output: 'OUTPUT_MARKER', config: {} },
  });

  assert.equal(result.ok, true);
  const data = result.result as { argvHasJobJson: boolean; jobInputMatches: boolean; jobOutputMatches: boolean };
  assert.equal(data.argvHasJobJson, false, 'job payload must never appear in argv');
  assert.equal(data.jobInputMatches, true);
  assert.equal(data.jobOutputMatches, true);

  const after = fs.readdirSync(tmpDir).filter((f) => f.startsWith('hailykit-ocr-'));
  assert.deepEqual(after, before, 'temp job file must be removed in finally');
});

test('engine-runner: SAFE_ENV allowlist forwards only the two API keys, not arbitrary secrets', async () => {
  const stub = writeStub(`
    console.log(JSON.stringify({
      ok: true,
      google: process.env.GOOGLE_API_KEY ?? null,
      leaked: process.env.HL_TEST_SECRET ?? null,
    }));
  `);
  process.env.GOOGLE_API_KEY = 'sk-test-secret-value';
  process.env.HL_TEST_SECRET = 'should-not-leak';
  try {
    const result = await runEngine({ pythonPath: process.execPath, scriptPath: stub, check: true });
    const data = result.result as { google: string | null; leaked: string | null };
    assert.equal(data.google, 'sk-test-secret-value');
    assert.equal(data.leaked, null);
  } finally {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.HL_TEST_SECRET;
  }
});

test('engine-runner: key value never appears in an error sink on failure', async () => {
  const stub = writeStub(`
    process.stderr.write('boom, no result line\\n');
    process.exit(1);
  `);
  process.env.GOOGLE_API_KEY = 'sk-should-not-leak-in-errors';
  try {
    const result = await runEngine({ pythonPath: process.execPath, scriptPath: stub, check: true });
    assert.equal(result.ok, false);
    assert.ok(!JSON.stringify(result).includes('sk-should-not-leak-in-errors'));
  } finally {
    delete process.env.GOOGLE_API_KEY;
  }
});

test('engine-runner: SIGTERM is forwarded on abort', async () => {
  const stub = writeStub(`
    process.on('SIGTERM', () => process.exit(2));
    setTimeout(() => { console.log(JSON.stringify({ok:true})); }, 5000);
  `);
  const controller = new AbortController();
  const runPromise = runEngine({ pythonPath: process.execPath, scriptPath: stub, check: true, signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  const result = await runPromise;
  assert.equal(result.ok, false);
  assert.notEqual(result.code, 0);
});

test('appendStdoutBounded keeps the buffer within 2x the cap regardless of how much is fed in', () => {
  let buf = '';
  const filler = 'x'.repeat(100_000);
  for (let i = 0; i < 30; i++) buf = appendStdoutBounded(buf, filler); // 3,000,000 chars fed total
  assert.ok(buf.length <= STDOUT_TAIL_CAP_BYTES * 2, `buffer grew unbounded: ${buf.length} chars`);
});

test('engine-runner: stdout cap keeps the final JSON line intact after a flooding engine', async () => {
  const stub = writeStub(`
    const filler = 'x'.repeat(100000) + '\\n';
    for (let i = 0; i < 30; i++) process.stdout.write(filler); // ~3MB of chatter before the result line
    console.log(JSON.stringify({ ok: true, marker: 'final-line-survived' }));
  `);
  const result = await runEngine({ pythonPath: process.execPath, scriptPath: stub, check: true });
  assert.equal(result.ok, true);
  assert.equal((result.result as { marker: string }).marker, 'final-line-survived');
});

// --- envelope shape (cmdOcr, injected engine runner) -------------------------

test('cmdOcr emits the shared envelope shape on a successful run', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-run-'));
  const inputFile = path.join(workDir, 'sample.pdf');
  fs.writeFileSync(inputFile, '%PDF-1.4 stub');
  const outDir = path.join(workDir, 'out');
  const fakeScript = path.join(workDir, 'ocr_engine.py');
  fs.writeFileSync(fakeScript, '# stub, never executed — runEngineFn is injected');

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (msg?: unknown) => { logs.push(String(msg)); };

  let code: number;
  try {
    code = await cmdOcr({
      input: inputFile,
      out: outDir,
      resume: false,
      check: false,
      json: true,
      cwd: workDir,
      scriptPath: fakeScript,
      runEngineFn: async () => ({ ok: true, code: 0, result: { ok: true, doc_dir: outDir, pages: 2, manifest: path.join(outDir, 'manifest.json') } }),
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(code, 0);
  const envelope = JSON.parse(logs.join('\n')) as { ok: boolean; tool: string; data: { summary: unknown; manifests: unknown[] } };
  assert.equal(envelope.ok, true);
  assert.equal(envelope.tool, 'ocr');
  assert.ok('summary' in envelope.data);
  assert.ok(Array.isArray(envelope.data.manifests));
});

test('cmdOcr requires --out for a real run', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-run-'));
  const inputFile = path.join(workDir, 'sample.pdf');
  fs.writeFileSync(inputFile, '%PDF-1.4 stub');
  const code = await cmdOcr({ input: inputFile, resume: false, check: false, json: true, cwd: workDir });
  assert.equal(code, 1);
});

test('cmdOcr forwards --batch-api as job.config.batch_api', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-run-'));
  const inputFile = path.join(workDir, 'sample.pdf');
  fs.writeFileSync(inputFile, '%PDF-1.4 stub');
  const outDir = path.join(workDir, 'out');
  const fakeScript = path.join(workDir, 'ocr_engine.py');
  fs.writeFileSync(fakeScript, '# stub, never executed — runEngineFn is injected');
  let capturedConfig: unknown;

  const code = await cmdOcr({
    input: inputFile,
    out: outDir,
    resume: false,
    check: false,
    json: true,
    cwd: workDir,
    batchApi: true,
    scriptPath: fakeScript,
    runEngineFn: async (opts) => {
      capturedConfig = opts.job?.config;
      return { ok: true, code: 0, result: { ok: true, doc_dir: outDir, pages: 0, manifest: path.join(outDir, 'manifest.json') } };
    },
  });

  assert.equal(code, 0);
  assert.equal((capturedConfig as { batch_api?: boolean }).batch_api, true);
  assert.equal((capturedConfig as { collect?: boolean }).collect, undefined);
});

test('cmdOcr forwards configured provider api_key_env names to the engine runner', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-run-'));
  const inputFile = path.join(workDir, 'sample.pdf');
  fs.writeFileSync(inputFile, '%PDF-1.4 stub');
  const outDir = path.join(workDir, 'out');
  const fakeScript = path.join(workDir, 'ocr_engine.py');
  fs.writeFileSync(fakeScript, '# stub');
  // A project-local provider referencing a non-Gemini key env: its NAME must
  // reach the runner so the key crosses to the child; a random env NOT named
  // by any provider must not be forwarded (config-derived allowlist).
  fs.mkdirSync(path.join(workDir, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(workDir, '.claude', 'haily.json'),
    JSON.stringify({ ocr: { providers: { or: { kind: 'openai', model: 'v1', base_url: 'https://x/v1', api_key_env: 'OPENROUTER_API_KEY' } }, tier_provider: { flash: 'or' } } }),
  );
  let capturedKeys: string[] | undefined;

  const code = await cmdOcr({
    input: inputFile,
    out: outDir,
    resume: false,
    check: false,
    json: true,
    cwd: workDir,
    scriptPath: fakeScript,
    runEngineFn: async (opts) => {
      capturedKeys = opts.keyEnvNames;
      return { ok: true, code: 0, result: { ok: true, doc_dir: outDir, pages: 0, manifest: path.join(outDir, 'manifest.json') } };
    },
  });

  assert.equal(code, 0);
  assert.ok(capturedKeys?.includes('OPENROUTER_API_KEY'), 'provider api_key_env name must be forwarded');
  assert.ok(!capturedKeys?.includes('SOME_UNRELATED_SECRET'), 'only config-referenced env names are forwarded');
});

test('cmdOcr forwards --collect as job.config.collect', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-run-'));
  const inputFile = path.join(workDir, 'sample.pdf');
  fs.writeFileSync(inputFile, '%PDF-1.4 stub');
  const outDir = path.join(workDir, 'out');
  const fakeScript = path.join(workDir, 'ocr_engine.py');
  fs.writeFileSync(fakeScript, '# stub, never executed — runEngineFn is injected');
  let capturedConfig: unknown;

  const code = await cmdOcr({
    input: inputFile,
    out: outDir,
    resume: false,
    check: false,
    json: true,
    cwd: workDir,
    collect: true,
    scriptPath: fakeScript,
    runEngineFn: async (opts) => {
      capturedConfig = opts.job?.config;
      return { ok: true, code: 0, result: { ok: true, docs_collected: 0 } };
    },
  });

  assert.equal(code, 0);
  assert.equal((capturedConfig as { collect?: boolean }).collect, true);
});

test('registry: --batch-api and --collect reach cmdOcr as boolean options', () => {
  const spec = findCommand('ocr');
  assert.ok(spec);
  // Both are boolean flags (no value-flag registration needed — arg-parser
  // treats any unregistered --flag as boolean true, see arg-parser.ts).
  for (const f of ['out', 'max-tier', 'python', 'lang']) {
    assert.ok(spec!.valueFlags.includes(f));
  }
  assert.ok(!spec!.valueFlags.includes('batch-api'));
  assert.ok(!spec!.valueFlags.includes('collect'));
});

test('cmdOcr rejects a missing input file before spawning anything', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ocr-run-'));
  const code = await cmdOcr({
    input: path.join(workDir, 'nope.pdf'),
    out: path.join(workDir, 'out'),
    resume: false,
    check: false,
    json: true,
    cwd: workDir,
    runEngineFn: async () => { throw new Error('must not be called'); },
  });
  assert.equal(code, 1);
});
