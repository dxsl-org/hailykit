/** Shared types for contract extraction. Leaf module. */

export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum' | 'endpoint';

export interface ContractSymbol {
  kind: SymbolKind;
  name: string;
  line: number;
  /** Trimmed signature text (functions) or route path (endpoints). */
  signature?: string;
  /** HTTP method for endpoints. */
  method?: string;
}

export interface FileContract {
  file: string;
  symbols: ContractSymbol[];
}

/** A per-language extractor: given the file's lines, return its public symbols. */
export type Extractor = (lines: string[]) => ContractSymbol[];

/** Whether a line is an obvious single-line comment (skip during extraction). */
export function isCommentLine(line: string, markers: string[]): boolean {
  const t = line.trim();
  return markers.some(m => t.startsWith(m));
}
