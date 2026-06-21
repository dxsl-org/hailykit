import fs from 'node:fs';
import path from 'node:path';
import { emit, ok, type Envelope } from '../../lib/json-output';

/**
 * `test-detect` — identify the test framework, runner command, test-file globs,
 * and coverage threshold from config files. Replaces LLM guesswork in hc-test.
 * Pure config-file probing; returns `framework: "unknown"` (not an error) when
 * nothing matches so the caller can still proceed.
 */

export interface TestDetectOptions { path: string; json: boolean; }

interface DetectData {
  framework: string;
  runner: string | null;
  language: string | null;
  testGlobs: string[];
  coverageThreshold: number | null;
}

export function cmdTestDetect(opts: TestDetectOptions): number {
  const root = path.resolve(opts.path);
  emit(ok('test-detect', detect(root), []), opts.json, human);
  return 0;
}

function exists(root: string, ...names: string[]): boolean {
  return names.some(n => fs.existsSync(path.join(root, n)));
}

function readJson(root: string, name: string): any {
  try { return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')); } catch { return null; }
}

function readText(root: string, name: string): string {
  try { return fs.readFileSync(path.join(root, name), 'utf8'); } catch { return ''; }
}

function detect(root: string): DetectData {
  const pkg = readJson(root, 'package.json');
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const testScript: string = pkg?.scripts?.test ?? '';

  // JS/TS frameworks
  if (exists(root, 'vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs') || 'vitest' in deps) {
    return js('vitest', 'vitest run', ['**/*.{test,spec}.{js,ts,jsx,tsx}'], jestThreshold(pkg, root));
  }
  if (exists(root, 'jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.json') || 'jest' in deps || pkg?.jest) {
    return js('jest', 'jest', ['**/*.{test,spec}.{js,ts,jsx,tsx}'], jestThreshold(pkg, root));
  }
  if (/node\s+--test/.test(testScript) || exists(root, 'tsconfig.test.json')) {
    return js('node-test', testScript || 'node --test', ['**/*.test.{js,ts}'], null);
  }
  if (exists(root, '.mocharc.js', '.mocharc.json', '.mocharc.yml') || 'mocha' in deps) {
    return js('mocha', 'mocha', ['test/**/*.{js,ts}'], null);
  }

  // Python
  if (exists(root, 'pytest.ini', 'tox.ini', 'conftest.py') || hasPytestSection(root)) {
    return { framework: 'pytest', runner: 'pytest', language: 'Python', testGlobs: ['test_*.py', '*_test.py', 'tests/**/*.py'], coverageThreshold: pytestThreshold(root) };
  }

  // Go / Rust / Flutter
  if (exists(root, 'go.mod')) return { framework: 'go-test', runner: 'go test ./...', language: 'Go', testGlobs: ['*_test.go'], coverageThreshold: null };
  if (exists(root, 'Cargo.toml')) return { framework: 'cargo-test', runner: 'cargo test', language: 'Rust', testGlobs: ['tests/**/*.rs', 'src/**/*.rs'], coverageThreshold: null };
  if (exists(root, 'pubspec.yaml')) return { framework: 'flutter-test', runner: 'flutter test', language: 'Dart', testGlobs: ['test/**/*_test.dart'], coverageThreshold: null };

  return { framework: 'unknown', runner: testScript || null, language: null, testGlobs: [], coverageThreshold: null };
}

function js(framework: string, runner: string, globs: string[], threshold: number | null): DetectData {
  return { framework, runner, language: 'JavaScript/TypeScript', testGlobs: globs, coverageThreshold: threshold };
}

/** Jest/Vitest global lines threshold from config or package.json. */
function jestThreshold(pkg: any, root: string): number | null {
  const fromPkg = pkg?.jest?.coverageThreshold?.global?.lines;
  if (typeof fromPkg === 'number') return fromPkg;
  for (const f of ['jest.config.json']) {
    const j = readJson(root, f);
    const t = j?.coverageThreshold?.global?.lines;
    if (typeof t === 'number') return t;
  }
  const cfg = readText(root, 'jest.config.js') || readText(root, 'jest.config.ts');
  const m = /coverageThreshold[\s\S]{0,200}?lines:\s*(\d+)/.exec(cfg);
  return m ? Number.parseInt(m[1], 10) : null;
}

function hasPytestSection(root: string): boolean {
  return /\[tool\.pytest|\[tool:pytest\]/.test(readText(root, 'pyproject.toml') + readText(root, 'setup.cfg'));
}

function pytestThreshold(root: string): number | null {
  const txt = readText(root, 'pyproject.toml') + readText(root, 'pytest.ini') + readText(root, 'setup.cfg');
  const m = /--cov-fail-under[=\s]+(\d+)/.exec(txt) ?? /fail_under\s*=\s*(\d+)/.exec(txt);
  return m ? Number.parseInt(m[1], 10) : null;
}

function human(env: Envelope<DetectData>): void {
  const d = env.data;
  console.log(`framework: ${d.framework}`);
  console.log(`runner:    ${d.runner ?? '—'}`);
  console.log(`language:  ${d.language ?? '—'}`);
  console.log(`globs:     ${d.testGlobs.join(', ') || '—'}`);
  console.log(`coverage threshold: ${d.coverageThreshold ?? 'none'}`);
}
