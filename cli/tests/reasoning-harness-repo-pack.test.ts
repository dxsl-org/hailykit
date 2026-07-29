import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixtureDir, loadFixtures, parseFixtureJson } from '../lib/reasoning-harness/fixtures';

// The repo-derived fixture pack: each item is a defect this repository actually shipped,
// or a piece of deliberately suspicious-looking code that is in fact correct. Ground truth
// is the change that landed, so it is verified rather than authored from imagination.
// Derived from fixtureDir() so it resolves the same way in the source tree and in
// the compiled test build, rather than from this file's own location.
const PACK = path.resolve(fixtureDir(), '..', 'reasoning-harness-repo');

test('repo pack parses and every file matches its declared id', () => {
  const fixtures = loadFixtures(PACK);
  assert.ok(fixtures.length >= 10, `expected a pack worth measuring, got ${fixtures.length}`);
  for (const fixture of fixtures) {
    assert.ok(fs.existsSync(path.join(PACK, `${fixture.id}.json`)), `${fixture.id} has no matching file`);
  }
  assert.equal(new Set(fixtures.map((f) => f.id)).size, fixtures.length, 'duplicate fixture id');
});

test('the pack cannot be beaten by always answering the same verdict', () => {
  const verdicts = loadFixtures(PACK).map((f) => f.expected_verdict);
  const fails = verdicts.filter((v) => v === 'fail').length;
  const passes = verdicts.length - fails;
  // A single-verdict pack scores full marks for a model that never reads the prompt.
  assert.ok(passes >= 2, `need correct-code fixtures too, got ${passes}`);
  assert.ok(fails >= 2, `need defect fixtures too, got ${fails}`);
});

test('phrase checks only demand identifiers, never prose wording', () => {
  // Learned twice the hard way: `summary_contains_all: ["lower value"]` and an
  // evidence check demanding the word "answer" both failed on correct analyses,
  // because they scored phrasing rather than understanding. A phrase check earns
  // its place only when the answer must name a specific identifier — a flag, a
  // directory, a tier, a status — which cannot be produced without understanding.
  const prose = /\s/;
  for (const fixture of loadFixtures(PACK)) {
    for (const check of fixture.hard_checks) {
      if (check.kind !== 'evidence_value_contains' && check.kind !== 'summary_contains_all') continue;
      for (const phrase of check.phrases ?? []) {
        assert.ok(!prose.test(phrase.trim()), `${fixture.id}: multi-word phrase check "${phrase}" scores wording, not substance`);
      }
    }
  }
});

test('every fixture is self-contained — no tool policy beyond none', () => {
  // Prompts carry their own evidence, so a provider with repo access would answer a
  // different question than a provider without it, breaking cross-provider comparison.
  for (const fixture of loadFixtures(PACK)) {
    assert.equal(fixture.allowed_tools.policy, 'none', `${fixture.id} would need tools`);
  }
});

test('a mistyped fixture directory throws instead of measuring the default pack', () => {
  // Previously this fell back to the bundled pack, so `--fixtures` with a typo produced a
  // complete, baseline-eligible run of the wrong questions with nothing to signal it.
  assert.throws(() => loadFixtures(path.join(PACK, 'does-not-exist')), /fixture directory not found/);
  assert.ok(loadFixtures().length > 0, 'the no-argument default must still resolve');
});

test('pack fixtures survive a strict re-parse from disk', () => {
  for (const name of fs.readdirSync(PACK).filter((f) => f.endsWith('.json'))) {
    const raw = fs.readFileSync(path.join(PACK, name), 'utf8');
    assert.doesNotThrow(() => parseFixtureJson(raw, name), `${name} failed strict parse`);
    assert.equal(raw.includes('sk-'), false, `${name} carries a secret-shaped string`);
  }
});
