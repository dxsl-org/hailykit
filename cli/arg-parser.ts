/** Result of parsing a hailykit command line. */
export interface ParsedArgs {
  /** The first positional token (e.g. `install`, `run`), or undefined. */
  command?: string;
  /** Remaining positionals after the command (e.g. the skill id for `run`). */
  positionals: string[];
  /** Flags: value-flags hold their string; bare flags are `true`. */
  options: Record<string, string | boolean>;
}

/**
 * Parse `argv` (already stripped of `node` + script path) into a command,
 * positionals, and options. Hand-rolled to keep the package dependency-free.
 *
 * @param argv - Raw arguments (e.g. `process.argv.slice(2)`).
 * @param valueFlags - Long-flag names (without `--`) that consume the next
 *   token as their value; every other `--flag` is treated as boolean `true`.
 */
export function parseArgs(argv: string[], valueFlags: Set<string>): ParsedArgs {
  const options: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    // `-h`/`-v` are shorthands; `--help`/`--version` fall through below so that
    // `--version <tag>` can act as a value-flag for the installer commands.
    if (token === '-h') { options.help = true; continue; }
    if (token === '-v') { options.v = true; continue; }
    if (token.startsWith('--')) {
      const key = token.slice(2);
      options[key] = valueFlags.has(key) ? (argv[++i] ?? '') : true;
      continue;
    }
    positionals.push(token);
  }

  const [command, ...rest] = positionals;
  return { command, positionals: rest, options };
}

/** Read a flag as a string, or return `fallback` when absent/boolean. */
export function stringOption(
  options: Record<string, string | boolean>,
  key: string,
  fallback: string,
): string {
  const value = options[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** Read a flag as a positive integer, or return `undefined` when absent/invalid. */
export function numberOption(
  options: Record<string, string | boolean>,
  key: string,
): number | undefined {
  const value = options[key];
  if (typeof value !== 'string') return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
