import path from 'node:path';
import { listFiles, readText } from '../../lib/fs-scan';
import { EXT_MAP } from '../../lib/lang-syntax';
import { extractTs } from './lang-ts';
import { extractPy } from './lang-py';
import { extractGo } from './lang-go';
import type { Extractor, FileContract } from './types';

/** Language name → extractor. Languages without an extractor are skipped. */
const EXTRACTORS: Record<string, Extractor> = {
  TypeScript: extractTs,
  JavaScript: extractTs,
  Python: extractPy,
  Go: extractGo,
};

export interface ExtractOptions {
  /** Filter to these languages (name or extension, e.g. 'ts','py','go'). */
  langs?: string[];
  exclude?: string[];
}

export function extractContracts(root: string, opts: ExtractOptions = {}): { files: FileContract[]; warnings: string[] } {
  const { files, warnings } = listFiles(root, { exclude: opts.exclude, respectGitignore: true });
  const langFilter = opts.langs?.length ? opts.langs.map(l => l.toLowerCase()) : undefined;
  const out: FileContract[] = [];

  for (const f of files) {
    const ext = path.extname(f.path).toLowerCase();
    const lang = EXT_MAP.get(ext);
    if (!lang) continue;
    const extractor = EXTRACTORS[lang.name];
    if (!extractor) continue;
    if (langFilter && !(langFilter.includes(lang.name.toLowerCase()) || langFilter.includes(ext.replace(/^\./, '')))) continue;

    const { text, warning } = readText(f.abs, f.bytes + 1);
    if (warning) { warnings.push(warning); continue; }
    if (text === null) continue;

    const symbols = extractor(text.split('\n'));
    if (symbols.length) out.push({ file: f.path, symbols });
  }
  return { files: out, warnings };
}
