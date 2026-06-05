import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeRequest,
  decodeResponse,
  type ToolRequest,
} from '../core-engine/polyglot-protocol';

test('encodeRequest produces a single NDJSON line', () => {
  const req: ToolRequest = {
    v: 1, id: 'x', tool: 's', input: { a: 1 }, context: { sessionId: 'sid', cwd: '/' },
  };
  const line = encodeRequest(req);
  assert.equal(line.endsWith('\n'), true);
  assert.equal(line.trimEnd().includes('\n'), false);
  assert.deepEqual(JSON.parse(line.trim()), req);
});

test('decodeResponse parses a success response', () => {
  const res = decodeResponse('{"v":1,"id":"x","ok":true,"output":{"y":2}}');
  assert.equal(res.ok, true);
  assert.equal(res.id, 'x');
});

test('decodeResponse parses an error response', () => {
  const res = decodeResponse('{"v":1,"id":"x","ok":false,"error":{"code":"E","message":"m"}}');
  assert.equal(res.ok, false);
});

test('decodeResponse rejects malformed input', () => {
  assert.throws(() => decodeResponse('not json'));
  assert.throws(() => decodeResponse('{"v":1}'));
  assert.throws(() => decodeResponse('{"v":1,"id":"x","ok":false}'));
});

test('decodeResponse rejects an unsupported protocol version', () => {
  assert.throws(() => decodeResponse('{"v":2,"id":"x","ok":true,"output":{}}'), /protocol version/);
});
