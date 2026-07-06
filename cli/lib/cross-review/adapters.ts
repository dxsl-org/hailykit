import type { LegName, ResolvedLeg } from './types';

/**
 * Per-leg invocation builder. The flags here are pinned to versions verified
 * 2026-07-06 — re-verify against the CLI's `--help` before changing any, and
 * update the version note when you do. Output parsing is NOT here: every
 * reviewer is prompted to answer with a `{"findings":[…]}` object, so
 * normalize.ts extracts that generically from each CLI's stdout instead of
 * decoding five bespoke event streams.
 *
 * The full prompt (which embeds the untrusted artifact) is NEVER passed as a
 * large argv token: it goes via stdin, or — for opencode, which has no stdin
 * `run` mode — via a temp file passed with `-f`. This avoids the Windows
 * cmd.exe command-line ceiling (~8191 chars) that silently truncates a real
 * diff, and avoids `%VAR%` expansion of artifact content by the batch shim.
 * Only fixed, trusted strings are ever passed as argv tokens. Leaf module.
 */

export interface Invocation {
  args: string[];
  /** Text piped to stdin (all legs except opencode read the prompt this way). */
  input?: string;
  /** Extra env keys the leg's auth needs, forwarded on top of SAFE_ENV. */
  allowEnv: string[];
}

export type Delivery = 'stdin' | 'file';

/** How the prompt reaches each leg — drives whether the runner writes a temp file. */
export function legDelivery(cli: LegName): Delivery {
  return cli === 'opencode' ? 'file' : 'stdin';
}

/** Credential env keys a gateway may need for whichever provider it routes to. */
const PROVIDER_KEYS = [
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY',
  'GOOGLE_API_KEY', 'DEEPSEEK_API_KEY', 'DASHSCOPE_API_KEY', 'ZHIPUAI_API_KEY',
  'MOONSHOT_API_KEY',
];

// Fixed, trusted argv tokens — no untrusted content, safe through cmd.exe.
const CLINE_INSTRUCTION = 'Review the piped input and reply exactly as it instructs.';
const OPENCODE_INSTRUCTION = 'Review the attached file and reply exactly as it instructs.';

/**
 * Build argv + stdin + env allowlist for a resolved leg.
 * @param leg - the resolved reviewer (cli + model).
 * @param prompt - the full review prompt (instruction + artifact).
 * @param promptFilePath - temp file holding the prompt; required for file-delivery legs.
 */
export function buildInvocation(leg: ResolvedLeg, prompt: string, promptFilePath?: string): Invocation {
  switch (leg.cli) {
    case 'codex':
      // `-` reads the prompt from stdin; read-only sandbox + never-approve = no writes.
      return {
        args: ['exec', '-m', leg.model, '--json', '-s', 'read-only', '-a', 'never', '-'],
        input: prompt,
        allowEnv: ['OPENAI_API_KEY'],
      };
    case 'gemini':
      // Reads the piped prompt from stdin; `-o json` forces a JSON reply.
      return {
        args: ['-m', leg.model, '-o', 'json'],
        input: prompt,
        allowEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
      };
    case 'ollama':
      return {
        args: ['run', leg.model, '--format', 'json'],
        input: prompt,
        allowEnv: ['OLLAMA_HOST'],
      };
    case 'cline': {
      // MANDATORY --plan --auto-approve false: cline's default act mode edits files.
      // The artifact rides stdin; the argv prompt is a fixed, trusted string.
      const slash = leg.model.indexOf('/');
      const provider = slash > 0 ? leg.model.slice(0, slash) : leg.model;
      const model = slash > 0 ? leg.model.slice(slash + 1) : leg.model;
      return {
        args: [CLINE_INSTRUCTION, '--json', '-P', provider, '-m', model, '--plan', '--auto-approve', 'false'],
        input: prompt,
        allowEnv: [...PROVIDER_KEYS, 'CLINE_API_KEY'],
      };
    }
    case 'opencode': {
      // No stdin `run` mode — the prompt goes in a temp file passed with `-f`.
      // `--agent plan` is the permission-restricted read-only agent.
      if (!promptFilePath) throw new Error('opencode requires a prompt file path');
      return {
        args: ['run', '-m', leg.model, '--format', 'json', '--agent', 'plan', '-f', promptFilePath, OPENCODE_INSTRUCTION],
        allowEnv: PROVIDER_KEYS,
      };
    }
  }
}

/** The binary name to spawn for a leg (matches detect.ts). */
export function legBinary(cli: LegName): string {
  return cli;
}
