import { isCommentLine, type ContractSymbol } from './types';

/**
 * Go public-surface extractor. Exported (capitalized) top-level funcs and types
 * plus net/http and gin/echo route registrations. Fast surface map, not a parser.
 */

const FUNC = /^func\s+(?:\([^)]*\)\s*)?([A-Z]\w*)\s*(\([^)]*\))/;
const TYPE = /^type\s+([A-Z]\w*)\s+/;
const HANDLEFUNC = /\.HandleFunc\(\s*"([^"]+)"/;
const ROUTER = /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\(\s*"([^"]+)"/;

export function extractGo(lines: string[]): ContractSymbol[] {
  const out: ContractSymbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (isCommentLine(line, ['//'])) continue;
    const ln = i + 1;

    let m: RegExpExecArray | null;
    if ((m = FUNC.exec(line))) out.push({ kind: 'function', name: m[1], line: ln, signature: m[2] });
    else if ((m = TYPE.exec(line))) out.push({ kind: 'type', name: m[1], line: ln });

    const hf = HANDLEFUNC.exec(line);
    if (hf) { out.push({ kind: 'endpoint', name: hf[1], line: ln, method: 'ANY', signature: hf[1] }); continue; }
    const r = ROUTER.exec(line);
    if (r) out.push({ kind: 'endpoint', name: r[2], line: ln, method: r[1].toUpperCase(), signature: r[2] });
  }
  return out;
}
