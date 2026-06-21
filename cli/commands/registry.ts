import { numberOption, stringOption } from '../arg-parser';
import { cmdStats, DEFAULT_SALARY } from './stats';
import { cmdGitInsights } from './git-insights';
import { cmdSecrets } from './scan/secrets';
import { cmdVulnScan } from './scan/vuln-scan';
import { cmdContracts } from './contracts/contracts';
import { cmdTestDetect } from './test/detect';
import { cmdCoverageParse, type CoverageFormat } from './test/coverage';

/**
 * Registry of native analysis commands (stats, and the Tier 1–3 tools added by
 * later phases). `bin.ts` derives its value-flag set, help listing, and dispatch
 * by reducing over this array — so a new command adds ONE entry here plus its
 * own command module, and never edits a shared `VALUE_FLAGS` line (avoids the
 * merge-conflict surface the plan's red-team flagged).
 */

export interface CommandContext {
  /** Positionals after the command name. */
  positionals: string[];
  /** Parsed flags (value-flags hold strings; bare flags are `true`). */
  options: Record<string, string | boolean>;
}

export interface CommandSpec {
  name: string;
  /** One-line summary for the top-level help listing. */
  summary: string;
  /** Full help text for `hailykit <name> --help`. */
  help: string;
  /** Long flags that consume the next token as their value. */
  valueFlags: string[];
  run: (ctx: CommandContext) => Promise<number> | number;
}

const STATS_HELP = `
hailykit stats [path] — Show code statistics for a directory

Arguments:
  path                 Directory to scan (default: current directory)

Options:
  --json               Emit compact JSON schema (machine-readable)
  --lang <list>        Comma-separated language filter (e.g. ts,js)
  --top <n>            Number of complexity hotspots to show (default: 10)
  --exclude <pattern>  Additional path substring to exclude
  --since <days>       Git churn window in days (default: 180)
  --salary <n>         Avg annual salary for COCOMO estimate (default: 56286)
  --no-git             Skip git-history insights (churn, risk, bus factor)
`.trim();

const statsCommand: CommandSpec = {
  name: 'stats',
  summary: 'Show code statistics for a directory',
  help: STATS_HELP,
  valueFlags: ['lang', 'top', 'exclude', 'since', 'salary'],
  run: ({ positionals, options }) => cmdStats({
    path: positionals[0] || '.',
    json: options.json === true,
    langs: stringOption(options, 'lang', '').split(',').filter(Boolean),
    top: numberOption(options, 'top') ?? 10,
    exclude: stringOption(options, 'exclude', '').split(',').filter(Boolean),
    git: options['no-git'] !== true,
    since: numberOption(options, 'since') ?? 180,
    salary: numberOption(options, 'salary') ?? DEFAULT_SALARY,
  }),
};

const GIT_INSIGHTS_HELP = `
hailykit git-insights [path] — Churn, bus factor, ownership, velocity, change-impact

Arguments:
  path                 Repo (or subdir) to analyze (default: current directory)

Options:
  --json               Emit the JSON envelope (machine-readable)
  --since <days>       Churn window in days (default: 180)
  --top <n>            Number of risk hotspots to show (default: 10)
  --ref <base>         Add change-impact for <base>..HEAD (flags high-risk files)

Notes:
  Always exits 0; outside a git repo, data.git is null with a reason.
`.trim();

const gitInsightsCommand: CommandSpec = {
  name: 'git-insights',
  summary: 'Churn, bus factor, velocity, and change-impact (JSON)',
  help: GIT_INSIGHTS_HELP,
  valueFlags: ['since', 'top', 'ref'],
  run: ({ positionals, options }) => cmdGitInsights({
    path: positionals[0] || '.',
    json: options.json === true,
    since: numberOption(options, 'since') ?? 180,
    top: numberOption(options, 'top') ?? 10,
    ref: stringOption(options, 'ref', '') || undefined,
  }),
};

const SECRETS_HELP = `
hailykit secrets [path] — Scan for hardcoded credentials (exits non-zero on findings)

Arguments:
  path                 Directory to scan (default: current directory)

Options:
  --staged             Scan only git-staged files (pre-commit gate)
  --exclude <pattern>  Additional path substring to exclude
  --json               Emit the JSON envelope (machine-readable)

Output is always redacted — the raw secret value is never printed. This is the
fast local gate; use gitleaks for deep/historical scans (see hc-security).
`.trim();

const VULN_SCAN_HELP = `
hailykit vuln-scan [path] — Fast regex scan for vulnerability patterns (informational)

Arguments:
  path                 Directory to scan (default: current directory)

Options:
  --exclude <pattern>  Additional path substring to exclude
  --json               Emit the JSON envelope (machine-readable)

A complement to semgrep, not a replacement (no data-flow/AST). Findings are
leads to verify. Always exits 0.
`.trim();

const secretsCommand: CommandSpec = {
  name: 'secrets',
  summary: 'Scan for hardcoded credentials (pre-commit gate)',
  help: SECRETS_HELP,
  valueFlags: ['exclude'],
  run: ({ positionals, options }) => cmdSecrets({
    path: positionals[0] || '.',
    staged: options.staged === true,
    json: options.json === true,
    exclude: stringOption(options, 'exclude', '').split(',').filter(Boolean),
  }),
};

const vulnScanCommand: CommandSpec = {
  name: 'vuln-scan',
  summary: 'Fast regex scan for vulnerability patterns',
  help: VULN_SCAN_HELP,
  valueFlags: ['exclude'],
  run: ({ positionals, options }) => cmdVulnScan({
    path: positionals[0] || '.',
    json: options.json === true,
    exclude: stringOption(options, 'exclude', '').split(',').filter(Boolean),
  }),
};

const CONTRACTS_HELP = `
hailykit contracts [path] — Extract the public surface (exports, signatures, endpoints)

Arguments:
  path                 Directory or file to scan (default: current directory)

Options:
  --lang <list>        Comma-separated language filter (ts,js,py,go)
  --exclude <pattern>  Additional path substring to exclude
  --json               Emit the JSON envelope (machine-readable)

Supports TS/JS, Python, Go. A fast regex surface map, not a parser — read the
source for edge syntax it misses.
`.trim();

const contractsCommand: CommandSpec = {
  name: 'contracts',
  summary: 'Extract exported symbols, signatures, and endpoints',
  help: CONTRACTS_HELP,
  valueFlags: ['lang', 'exclude'],
  run: ({ positionals, options }) => cmdContracts({
    path: positionals[0] || '.',
    json: options.json === true,
    langs: stringOption(options, 'lang', '').split(',').filter(Boolean),
    exclude: stringOption(options, 'exclude', '').split(',').filter(Boolean),
  }),
};

const testDetectCommand: CommandSpec = {
  name: 'test-detect',
  summary: 'Detect test framework, globs, and coverage threshold',
  help: `hailykit test-detect [path] — Detect the test framework / runner / globs / coverage threshold

Arguments:
  path                 Project directory (default: current directory)

Options:
  --json               Emit the JSON envelope (machine-readable)

Returns framework: "unknown" (not an error) when nothing matches.`,
  valueFlags: [],
  run: ({ positionals, options }) => cmdTestDetect({ path: positionals[0] || '.', json: options.json === true }),
};

const coverageParseCommand: CommandSpec = {
  name: 'coverage-parse',
  summary: 'Normalize an LCOV/Istanbul/pytest/gocover report',
  help: `hailykit coverage-parse <file> — Normalize a coverage report to total % + per-file %

Arguments:
  file                 Coverage report file

Options:
  --format <f>         lcov | istanbul | pytest | gocover (auto-detected if omitted)
  --json               Emit the JSON envelope (machine-readable)`,
  valueFlags: ['format'],
  run: ({ positionals, options }) => {
    if (!positionals[0]) { console.error('Usage: hailykit coverage-parse <file> [--format f]'); return 1; }
    const fmt = stringOption(options, 'format', '') as CoverageFormat | '';
    return cmdCoverageParse({ file: positionals[0], format: fmt || undefined, json: options.json === true });
  },
};

export const COMMANDS: CommandSpec[] = [
  statsCommand,
  gitInsightsCommand,
  secretsCommand,
  vulnScanCommand,
  contractsCommand,
  testDetectCommand,
  coverageParseCommand,
];

/** Look up a registered command by name. */
export function findCommand(name: string | undefined): CommandSpec | undefined {
  return COMMANDS.find(c => c.name === name);
}

/** All value-flags declared across registered commands. */
export function registryValueFlags(): string[] {
  return COMMANDS.flatMap(c => c.valueFlags);
}
