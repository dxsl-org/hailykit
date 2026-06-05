/**
 * Remove `//` line comments and block comments from a JSON string while
 * preserving comment-like sequences inside string literals. Stripped comment
 * characters are replaced with spaces so byte offsets (and newlines) are kept,
 * which keeps `JSON.parse` error positions meaningful.
 *
 * Zero-dependency replacement for the `strip-json-comments` package that the
 * old hailykit CLI relied on (it was the only runtime dependency).
 *
 * @param input - JSON text that may contain JS-style comments.
 * @returns The same text with comments blanked out (safe for `JSON.parse`).
 */
export function stripJsonComments(input: string): string {
  let result = '';
  let insideString = false;
  let insideLineComment = false;
  let insideBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (insideLineComment) {
      if (ch === '\n') { insideLineComment = false; result += ch; }
      else result += ' ';
      continue;
    }
    if (insideBlockComment) {
      if (ch === '*' && next === '/') { insideBlockComment = false; result += '  '; i++; }
      else result += ch === '\n' ? ch : ' ';
      continue;
    }
    if (insideString) {
      result += ch;
      // Skip escaped characters so an escaped quote does not end the string.
      if (ch === '\\') { result += next ?? ''; i++; }
      else if (ch === '"') insideString = false;
      continue;
    }
    if (ch === '"') { insideString = true; result += ch; continue; }
    if (ch === '/' && next === '/') { insideLineComment = true; result += '  '; i++; continue; }
    if (ch === '/' && next === '*') { insideBlockComment = true; result += '  '; i++; continue; }
    result += ch;
  }
  return result;
}
