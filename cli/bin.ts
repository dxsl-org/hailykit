#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { numberOption, parseArgs, stringOption } from './arg-parser';
import { cmdInfo, cmdList, cmdRun, type EngineCliOptions } from './commands/engine-commands';
import { cmdStats } from './commands/stats';
import { cmdInstall } from './installer/commands/install';
import { cmdUpgrade } from './installer/commands/upgrade';
import { cmdUninstall } from './installer/commands/uninstall';
import { cmdStatus } from './installer/commands/status';
import { PROVIDER_NAMES } from './installer/providers/index';

/** Long flags that consume the next token as their value. */
const VALUE_FLAGS = new Set(['provider', 'version', 'tools', 'input', 'timeout', 'lang', 'top', 'exclude']);

// In dist/bin.js, __dirname resolves to dist/ — so this points to dist/tools/
const DEFAULT_TOOLS_DIR = path.join(__dirname, 'tools');

const HELP = `
hailykit — skill-orchestration engine + multi-provider installer

Usage:
  hailykit <command> [options]

Engine commands:
  list                 List tools discovered in the tools directory
  run <tool>           Run a tool and print its JSON result
  info <tool>          Print a tool's manifest

Installer commands:
  install              Install HailyKit skills/hooks into an AI agent
  upgrade              Upgrade an installed HailyKit to the latest release
  uninstall            Remove HailyKit from an AI agent
  status               Show installed vs latest version

Analysis commands:
  stats [path]         Show code statistics for a directory

Engine options:
  --tools <dir>        Tools directory to discover (default: <bundled>)
  --input <json>       JSON input for \`run\` (default: {})
  --timeout <ms>       Timeout for external (polyglot) tools

Installer options (install / upgrade / uninstall):
  --project            Target current project directory instead of global
  --provider <name>    Target AI agent (${[...PROVIDER_NAMES, 'all'].join(', ')})

Install / upgrade only:
  --version <tag>      Use a specific release tag (e.g. v2.1.0)
  --no-venv            Skip Python venv setup (Claude only)

Stats options:
  --json               Emit compact JSON schema (machine-readable)
  --lang <list>        Comma-separated language filter (e.g. ts,js)
  --top <n>            Number of complexity hotspots to show (default: 10)
  --exclude <pattern>  Additional path substring to exclude

Other:
  -h, --help           Show this help (append to a command for command help)
  -v, --version        Show the hailykit version
`.trim();

const HELP_INSTALLER = `
hailykit install / upgrade — Install or upgrade HailyKit in an AI agent

Options:
  --provider <name>    Target: ${[...PROVIDER_NAMES, 'all'].join(', ')} (default: claude)
  --project            Install into the current project instead of global (~/)
  --version <tag>      Pin to a specific release tag (e.g. v2.1.0)
  --no-venv            Skip Python venv setup (Claude only)
`.trim();

const HELP_UNINSTALL = `
hailykit uninstall — Remove HailyKit from an AI agent

Options:
  --provider <name>    Target: ${[...PROVIDER_NAMES, 'all'].join(', ')} (default: claude)
  --project            Uninstall from current project instead of global (~/)

Notes:
  - Removes skills, rules, agents, and hooks directories.
  - Cleans HailyKit sentinel blocks from AGENTS.md and GEMINI.md.
  - Claude: settings.json hooks entries are NOT removed automatically.
`.trim();

const HELP_STATUS = `
hailykit status — Show installed vs latest HailyKit version

Options:
  --provider <name>    Filter to a specific provider (default: all)
`.trim();

const HELP_STATS = `
hailykit stats [path] — Show code statistics for a directory

Arguments:
  path                 Directory to scan (default: current directory)

Options:
  --json               Emit compact JSON schema (machine-readable)
  --lang <list>        Comma-separated language filter (e.g. ts,js)
  --top <n>            Number of complexity hotspots to show (default: 10)
  --exclude <pattern>  Additional path substring to exclude

Output fields (JSON):
  ncloc                Non-comment lines of code (SonarQube canonical key)
  complexity           Cyclomatic complexity approximation (keyword count)
  token_est            Estimated LLM tokens: ncloc × 18
  thresholds           complexity_warn=15, complexity_error=25, file_loc_warn=200
`.trim();

/** Read this package's version from package.json next to the compiled bin. */
function readVersion(): string {
  try {
    // dist/bin.js → repo root package.json is one level up.
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Build the installer options object shared by `install` and `upgrade`. */
function installerOptions(options: Record<string, string | boolean>) {
  return {
    provider: stringOption(options, 'provider', '') || undefined,
    project: options.project === true,
    version: stringOption(options, 'version', '') || undefined,
    noVenv: options['no-venv'] === true,
  };
}

async function main(): Promise<number> {
  const { command, positionals, options } = parseArgs(process.argv.slice(2), VALUE_FLAGS);

  if (!command) {
    if (options.v || 'version' in options) { console.log(readVersion()); return 0; }
    console.log(HELP);
    return 0;
  }

  if (options.help) {
    switch (command) {
      case 'install': case 'upgrade': console.log(HELP_INSTALLER); return 0;
      case 'uninstall': console.log(HELP_UNINSTALL); return 0;
      case 'status': console.log(HELP_STATUS); return 0;
      case 'stats': console.log(HELP_STATS); return 0;
      default: console.log(HELP); return 0;
    }
  }

  const engineOpts: EngineCliOptions = {
    toolsDir: stringOption(options, 'tools', DEFAULT_TOOLS_DIR),
    timeoutMs: numberOption(options, 'timeout'),
  };

  switch (command) {
    case 'list': return cmdList(engineOpts);
    case 'info': return cmdInfo(positionals[0], engineOpts);
    case 'run': return cmdRun(positionals[0], stringOption(options, 'input', ''), engineOpts);
    case 'install': await cmdInstall(installerOptions(options)); return 0;
    case 'upgrade': await cmdUpgrade(installerOptions(options)); return 0;
    case 'uninstall': await cmdUninstall({
      provider: stringOption(options, 'provider', '') || undefined,
      project: options.project === true,
    }); return 0;
    case 'status': await cmdStatus({ provider: stringOption(options, 'provider', '') || undefined }); return 0;
    case 'stats': return cmdStats({
      path: positionals[0] || '.',
      json: options.json === true,
      langs: stringOption(options, 'lang', '').split(',').filter(Boolean),
      top: numberOption(options, 'top') ?? 10,
      exclude: stringOption(options, 'exclude', '').split(',').filter(Boolean),
    });
    default:
      console.error(`Unknown command: ${command}\nRun 'hailykit --help' for usage.`);
      return 1;
  }
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e: unknown) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
