import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gitignore } from '../lib/gitignore';

function gi(patterns: string): Gitignore {
  const g = new Gitignore();
  g.add(patterns, '');
  return g;
}

test('gitignore: `**/` preserves the path boundary (no prefix over-match)', () => {
  const g = gi('**/build/\n');
  assert.equal(g.ignores('build', true), true);
  assert.equal(g.ignores('a/b/build', true), true);
  assert.equal(g.ignores('prebuild', true), false, 'prebuild must NOT match **/build');
  assert.equal(g.ignores('mybuild', true), false);
});

test('gitignore: `a/**/b` requires a separator, not substring', () => {
  const g = gi('a/**/b\n');
  assert.equal(g.ignores('a/b', false), true);
  assert.equal(g.ignores('a/x/y/b', false), true);
  assert.equal(g.ignores('a/zzzb', false), false, 'zzzb must not match **');
});

test('gitignore: single * does not cross path separators', () => {
  const g = gi('*.log\n');
  assert.equal(g.ignores('app.log', false), true);
  assert.equal(g.ignores('logs/app.log', false), true); // unanchored matches at any depth
  const anchored = gi('/*.log\n');
  assert.equal(anchored.ignores('app.log', false), true);
  assert.equal(anchored.ignores('logs/app.log', false), false, 'anchored stays at root');
});

test('gitignore: `dir/*` + negation re-includes a kept file (git-correct form)', () => {
  // Per git, `dir/` cannot re-include contents; `dir/*` (contents, not the dir) can.
  const g = gi('secret/*\n!secret/keep.txt\n');
  assert.equal(g.ignores('secret/drop.txt', false), true);
  assert.equal(g.ignores('secret/keep.txt', false), false, '! rule must re-include under dir/*');
});

test('gitignore: comments and blank lines are ignored', () => {
  const g = gi('# a comment\n\n*.tmp\n');
  assert.equal(g.ignores('x.tmp', false), true);
  assert.equal(g.ignores('a comment', false), false);
});
