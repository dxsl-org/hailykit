#!/usr/bin/env node
'use strict';
/*
 * Example external (polyglot) hailykit tool, in Node.js.
 *
 * Protocol: read ONE NDJSON request line on stdin, write ONE NDJSON response
 * line on stdout, exit 0. See docs/tech-stack.md → "Polyglot protocol".
 *   request : {"v":1,"id":"...","tool":"uppercase","input":{"text":"..."},...}
 *   response: {"v":1,"id":"...","ok":true,"output":{"text":"..."}}
 */

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { buffer += chunk; });
process.stdin.on('end', () => {
  const line = buffer.trim().split('\n').filter(Boolean).pop() || '{}';
  let request;
  try {
    request = JSON.parse(line);
  } catch (e) {
    write({ v: 1, id: 'unknown', ok: false, error: { code: 'E_BAD_REQUEST', message: String(e) } });
    return;
  }
  const text = request.input && typeof request.input.text === 'string' ? request.input.text : '';
  write({ v: 1, id: request.id, ok: true, output: { text: text.toUpperCase() } });
});

function write(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}
