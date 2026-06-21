/**
 * Minimal `.gitignore` matcher — zero-dep, opt-in. Covers the common cases:
 * comments/blanks, negation (`!`), directory-only (`foo/`), anchored (`/foo`),
 * `*`, `?`, and `**` globs. Not a full git spec implementation (no `\` escapes
 * inside class brackets); good enough for excluding build output and secrets
 * from scans/packs. Leaf module.
 *
 * Rules are evaluated relative to the directory of the `.gitignore` that
 * declared them; last matching rule wins, so a later `!pattern` can re-include.
 */

interface Rule { re: RegExp; negate: boolean; dirOnly: boolean; base: string; }

/** Translate one gitignore pattern to a RegExp anchored at the rule's base dir. */
function patternToRegex(pattern: string): { source: string; dirOnly: boolean } {
  let p = pattern;
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);

  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      // `**/` → zero or more directories (boundary preserved); bare `**` → anything.
      if (p[i + 2] === '/') { re += '(.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  // Anchored patterns match from the base root; unanchored match at any depth.
  const prefix = anchored ? '^' : '(^|/)';
  return { source: `${prefix}${re}(/|$)`, dirOnly };
}

export class Gitignore {
  private rules: Rule[] = [];

  /** Add the rules from a `.gitignore` whose directory is `baseRel` (relative, `/`-form, '' = root). */
  add(content: string, baseRel: string): void {
    for (const raw of content.split('\n')) {
      const line = raw.replace(/\r$/, '').trim();
      if (!line || line.startsWith('#')) continue;
      const negate = line.startsWith('!');
      const body = negate ? line.slice(1) : line;
      const { source, dirOnly } = patternToRegex(body);
      this.rules.push({ re: new RegExp(source), negate, dirOnly, base: baseRel });
    }
  }

  /** Whether `relPath` (relative to scan root, `/`-form) is ignored. */
  ignores(relPath: string, isDir: boolean): boolean {
    let ignored = false;
    for (const rule of this.rules) {
      if (rule.dirOnly && !isDir) continue;
      // A rule only applies within the subtree of the .gitignore that declared it.
      const scoped = rule.base ? (relPath === rule.base || relPath.startsWith(rule.base + '/')) : true;
      if (!scoped) continue;
      const rel = rule.base ? relPath.slice(rule.base.length + 1) : relPath;
      if (rule.re.test(rel)) ignored = !rule.negate;
    }
    return ignored;
  }
}
