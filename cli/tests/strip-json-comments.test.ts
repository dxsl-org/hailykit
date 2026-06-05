import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripJsonComments } from '../utils/strip-json-comments';

test('removes line and block comments', () => {
  const input = '{\n  // a comment\n  "a": 1, /* inline */ "b": 2\n}';
  const out = stripJsonComments(input);
  assert.deepEqual(JSON.parse(out), { a: 1, b: 2 });
});

test('preserves comment-like sequences inside strings', () => {
  const input = '{"url": "https://example.com", "note": "/* not a comment */"}';
  const out = stripJsonComments(input);
  assert.deepEqual(JSON.parse(out), {
    url: 'https://example.com',
    note: '/* not a comment */',
  });
});

test('handles escaped quotes inside strings', () => {
  const input = '{"q": "she said \\"// hi\\""}';
  const out = stripJsonComments(input);
  assert.deepEqual(JSON.parse(out), { q: 'she said "// hi"' });
});
