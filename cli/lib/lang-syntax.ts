/**
 * Per-language syntax data: file extensions, comment markers, and complexity
 * keywords. Pure data, zero imports — a leaf module shared by stats (line/
 * complexity counting) and contract/secret tools (comment stripping).
 */

export interface Language {
  name: string;
  extensions: string[];
  lineComment: string[];
  blockComment: Array<[string, string]>;
  complexity: string[];
}

export const LANGUAGES: Language[] = [
  {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&', '??', '?.', '?:'],
  },
  {
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&', '??', '?.', '?:'],
  },
  {
    name: 'Python',
    extensions: ['.py', '.pyi'],
    lineComment: ['#'],
    blockComment: [['"""', '"""'], ["'''", "'''"]],
    complexity: ['if ', 'elif ', ' for ', ' while ', ' except ', ' with ', ' and ', ' or ', 'lambda '],
  },
  {
    name: 'Go',
    extensions: ['.go'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' switch ', 'case ', ' select ', ' go ', '||', '&&'],
  },
  {
    name: 'Rust',
    extensions: ['.rs'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' match ', ' loop ', '||', '&&', ' ? ', '=>'],
  },
  {
    name: 'Java',
    extensions: ['.java'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&'],
  },
  {
    name: 'C',
    extensions: ['.c', '.h'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' switch ', 'case ', '||', '&&'],
  },
  {
    name: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&'],
  },
  {
    name: 'C#',
    extensions: ['.cs'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' foreach ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&', '??', '?.'],
  },
  {
    name: 'Swift',
    extensions: ['.swift'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&', '??'],
  },
  {
    name: 'Kotlin',
    extensions: ['.kt', '.kts'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' when ', ' catch ', '||', '&&', '?:'],
  },
  {
    name: 'Ruby',
    extensions: ['.rb'],
    lineComment: ['#'],
    blockComment: [['=begin', '=end']],
    complexity: ['if ', 'elsif ', ' unless ', ' for ', ' while ', ' until ', ' rescue ', ' when ', '||', '&&'],
  },
  {
    name: 'PHP',
    extensions: ['.php'],
    lineComment: ['//', '#'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'elseif ', ' for ', ' foreach ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&', '??'],
  },
  {
    name: 'Shell',
    extensions: ['.sh', '.bash', '.zsh', '.fish'],
    lineComment: ['#'],
    blockComment: [],
    complexity: ['if ', 'elif ', ' for ', ' while ', ' case ', ' && ', ' || '],
  },
  {
    name: 'YAML',
    extensions: ['.yml', '.yaml'],
    lineComment: ['#'],
    blockComment: [],
    complexity: [],
  },
  {
    name: 'JSON',
    extensions: ['.json'],
    lineComment: [],
    blockComment: [],
    complexity: [],
  },
  {
    name: 'TOML',
    extensions: ['.toml'],
    lineComment: ['#'],
    blockComment: [],
    complexity: [],
  },
  {
    name: 'Markdown',
    extensions: ['.md', '.mdx'],
    lineComment: [],
    blockComment: [['<!--', '-->']],
    complexity: [],
  },
  {
    name: 'HTML',
    extensions: ['.html', '.htm'],
    lineComment: [],
    blockComment: [['<!--', '-->']],
    complexity: [],
  },
  {
    name: 'CSS',
    extensions: ['.css'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: [],
  },
  {
    name: 'SCSS',
    extensions: ['.scss', '.sass'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: [],
  },
  {
    name: 'SQL',
    extensions: ['.sql'],
    lineComment: ['--'],
    blockComment: [['/*', '*/']],
    complexity: ['WHERE ', 'AND ', 'OR ', 'CASE ', ' IF ', 'WHEN '],
  },
  {
    name: 'Lua',
    extensions: ['.lua'],
    lineComment: ['--'],
    blockComment: [['--[[', ']]']],
    complexity: ['if ', 'elseif ', ' for ', ' while ', ' repeat ', ' and ', ' or '],
  },
  {
    name: 'Dart',
    extensions: ['.dart'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' switch ', 'case ', ' catch ', '||', '&&', '??', '?.'],
  },
  {
    name: 'Elixir',
    extensions: ['.ex', '.exs'],
    lineComment: ['#'],
    blockComment: [],
    complexity: ['if ', ' unless ', ' cond ', ' case ', ' for ', ' rescue ', ' || ', ' && '],
  },
  {
    name: 'Haskell',
    extensions: ['.hs', '.lhs'],
    lineComment: ['--'],
    blockComment: [['{-', '-}']],
    complexity: ['if ', ' where ', ' case ', '||', '&&'],
  },
  {
    name: 'Scala',
    extensions: ['.scala', '.sc'],
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' match ', ' catch ', '||', '&&'],
  },
  {
    name: 'Vue',
    extensions: ['.vue'],
    lineComment: ['//'],
    blockComment: [['/*', '*/'], ['<!--', '-->']],
    complexity: ['if ', 'else if ', ' for ', ' while ', '||', '&&', '??', '?.'],
  },
  {
    name: 'Svelte',
    extensions: ['.svelte'],
    lineComment: ['//'],
    blockComment: [['/*', '*/'], ['<!--', '-->']],
    complexity: ['if ', 'else if ', ' for ', ' while ', '||', '&&', '??'],
  },
  {
    name: 'R',
    extensions: ['.r', '.R'],
    lineComment: ['#'],
    blockComment: [],
    complexity: ['if ', 'else if ', ' for ', ' while ', ' tryCatch ', '||', '&&'],
  },
  {
    name: 'Gleam',
    extensions: ['.gleam'],
    lineComment: ['//'],
    blockComment: [],
    complexity: [' case ', ' use ', '||', '&&', ' if '],
  },
];

export const EXT_MAP = new Map<string, Language>(
  LANGUAGES.flatMap(lang => lang.extensions.map(ext => [ext, lang])),
);
