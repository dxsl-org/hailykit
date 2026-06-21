/**
 * Shared output envelope for NEW native commands (git-insights, secrets,
 * contracts, …). `hailykit stats` keeps its own `{ v: 2, … }` shape — do NOT
 * route stats through this. Leaf module.
 */

export interface Envelope<T> {
  ok: boolean;
  tool: string;
  data: T;
  /** Non-fatal notices (skipped files, undecodable input, partial parses). */
  warnings?: string[];
}

export function ok<T>(tool: string, data: T, warnings?: string[]): Envelope<T> {
  const env: Envelope<T> = { ok: true, tool, data };
  if (warnings && warnings.length) env.warnings = warnings;
  return env;
}

export function fail(tool: string, message: string): Envelope<{ error: string }> {
  return { ok: false, tool, data: { error: message } };
}

/**
 * Emit an envelope. In `--json` mode prints pretty JSON; otherwise hands the
 * envelope to a caller-supplied human renderer.
 */
export function emit<T>(env: Envelope<T>, asJson: boolean, human: (env: Envelope<T>) => void): void {
  if (asJson) {
    console.log(JSON.stringify(env, null, 2));
    return;
  }
  human(env);
}
