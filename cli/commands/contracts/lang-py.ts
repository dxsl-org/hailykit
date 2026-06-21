import { type ContractSymbol } from './types';

/**
 * Python public-surface extractor. Top-level `def`/`class` (column 0, so methods
 * nested in classes are not double-counted) plus FastAPI/Flask route decorators.
 * Fast surface map, not a parser.
 */

const TOP_DEF = /^def\s+(\w+)\s*(\([^)]*\))/;
const TOP_ASYNC_DEF = /^async\s+def\s+(\w+)\s*(\([^)]*\))/;
const TOP_CLASS = /^class\s+(\w+)/;
const FASTAPI_ROUTE = /@(?:app|router|api)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/i;
const FLASK_ROUTE = /@(?:app|bp|blueprint)\.route\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[([^\]]*)\])?/i;

export function extractPy(lines: string[]): ContractSymbol[] {
  const out: ContractSymbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (line.trim().startsWith('#')) continue;
    const ln = i + 1;

    let m: RegExpExecArray | null;
    if ((m = TOP_DEF.exec(line)) ?? (m = TOP_ASYNC_DEF.exec(line))) {
      if (!m[1].startsWith('_')) out.push({ kind: 'function', name: m[1], line: ln, signature: m[2] });
    } else if ((m = TOP_CLASS.exec(line))) {
      out.push({ kind: 'class', name: m[1], line: ln });
    }

    const fa = FASTAPI_ROUTE.exec(line);
    if (fa) { out.push({ kind: 'endpoint', name: fa[2], line: ln, method: fa[1].toUpperCase(), signature: fa[2] }); continue; }
    const fl = FLASK_ROUTE.exec(line);
    if (fl) out.push({ kind: 'endpoint', name: fl[1], line: ln, method: (fl[2]?.replace(/['"\s]/g, '') || 'GET'), signature: fl[1] });
  }
  return out;
}
