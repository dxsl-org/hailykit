import { isCommentLine, type ContractSymbol } from './types';

/**
 * TypeScript / JavaScript public-surface extractor. Regex over tokenized lines
 * (no AST — zero-dep), covering exported declarations and common HTTP route
 * decorators/calls. A fast surface map, not a parser: edge syntax is missed by
 * design; read the source for those.
 */

const EXPORT_FN = /^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))/;
const EXPORT_CONST = /^export\s+(?:const|let|var)\s+(\w+)\s*[:=]/;
const EXPORT_CLASS = /^export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/;
const EXPORT_INTERFACE = /^export\s+interface\s+(\w+)/;
const EXPORT_TYPE = /^export\s+type\s+(\w+)/;
const EXPORT_ENUM = /^export\s+(?:const\s+)?enum\s+(\w+)/;
const DECORATOR_ROUTE = /@(Get|Post|Put|Delete|Patch|All)\(\s*['"`]([^'"`]*)['"`]/i;
const CALL_ROUTE = /\b(?:app|router|api)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/i;

export function extractTs(lines: string[]): ContractSymbol[] {
  const out: ContractSymbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (isCommentLine(line, ['//'])) continue;
    const ln = i + 1;
    const trimmed = line.trimStart();

    let m: RegExpExecArray | null;
    if ((m = EXPORT_FN.exec(trimmed))) out.push({ kind: 'function', name: m[1], line: ln, signature: m[2] });
    else if ((m = EXPORT_CLASS.exec(trimmed))) out.push({ kind: 'class', name: m[1], line: ln });
    else if ((m = EXPORT_INTERFACE.exec(trimmed))) out.push({ kind: 'interface', name: m[1], line: ln });
    else if ((m = EXPORT_TYPE.exec(trimmed))) out.push({ kind: 'type', name: m[1], line: ln });
    else if ((m = EXPORT_ENUM.exec(trimmed))) out.push({ kind: 'enum', name: m[1], line: ln });
    else if ((m = EXPORT_CONST.exec(trimmed))) out.push({ kind: 'const', name: m[1], line: ln });

    const route = DECORATOR_ROUTE.exec(line) ?? CALL_ROUTE.exec(line);
    if (route) out.push({ kind: 'endpoint', name: route[2], line: ln, method: route[1].toUpperCase(), signature: route[2] });
  }
  return out;
}
