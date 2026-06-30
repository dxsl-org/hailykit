import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selfUpgradeCliIfNeeded } from '../installer/commands/self-upgrade';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-selfupgrade-'));
}

/** Create a minimal fake extracted release root with dist/bin.js and package.json. */
function fakeRelease(dir: string, version: string): void {
  const distDir = path.join(dir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'bin.js'), '// bin');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }));
}

/** Create a fake HAILYKIT_HOME with an installed binary. */
function fakeHome(dir: string, version: string): void {
  const distDir = path.join(dir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'bin.js'), `// old binary ${version}`);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }));
}

test('selfUpgradeCliIfNeeded: returns false when release has no dist/', () => {
  const root = tmp();
  // No dist/ in release root
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  assert.equal(selfUpgradeCliIfNeeded(root, '1.0.0'), false);
});

test('selfUpgradeCliIfNeeded: returns false when release version equals current', () => {
  const root = tmp();
  fakeRelease(root, '1.0.0');
  assert.equal(selfUpgradeCliIfNeeded(root, '1.0.0'), false);
});

test('selfUpgradeCliIfNeeded: returns false when release version is older than current', () => {
  const root = tmp();
  fakeRelease(root, '0.9.0');
  assert.equal(selfUpgradeCliIfNeeded(root, '1.0.0'), false);
});

test('selfUpgradeCliIfNeeded: returns false when HAILYKIT_HOME has no installed bin.js', () => {
  const root = tmp();
  const home = tmp();
  fakeRelease(root, '2.0.0');
  // home exists but no dist/bin.js
  fs.mkdirSync(path.join(home, 'dist'), { recursive: true });
  const orig = process.env['HAILYKIT_HOME'];
  process.env['HAILYKIT_HOME'] = home;
  try {
    assert.equal(selfUpgradeCliIfNeeded(root, '1.0.0'), false);
  } finally {
    if (orig === undefined) delete process.env['HAILYKIT_HOME'];
    else process.env['HAILYKIT_HOME'] = orig;
  }
});

test('selfUpgradeCliIfNeeded: copies dist/ and returns true when newer release found', () => {
  const root = tmp();
  const home = tmp();
  fakeRelease(root, '2.0.0');
  fakeHome(home, '1.0.0');

  // Add a second file to the release dist to verify copy.
  fs.writeFileSync(path.join(root, 'dist', 'providers.js'), '// providers');

  const orig = process.env['HAILYKIT_HOME'];
  process.env['HAILYKIT_HOME'] = home;
  try {
    const result = selfUpgradeCliIfNeeded(root, '1.0.0');
    assert.equal(result, true);
    // New binary replaces old one
    assert.ok(fs.existsSync(path.join(home, 'dist', 'bin.js')));
    assert.ok(fs.existsSync(path.join(home, 'dist', 'providers.js')));
    // package.json in home updated
    const pkg = JSON.parse(fs.readFileSync(path.join(home, 'package.json'), 'utf8')) as { version: string };
    assert.equal(pkg.version, '2.0.0');
  } finally {
    if (orig === undefined) delete process.env['HAILYKIT_HOME'];
    else process.env['HAILYKIT_HOME'] = orig;
  }
});
