/**
 * Wire protocol for external (polyglot) tools.
 *
 * Framing: NDJSON — exactly one JSON object per line. For a one-shot
 * invocation the engine writes a single request line to the child's stdin and
 * reads the final JSON line from its stdout. This is the same line-delimited
 * approach MCP uses over stdio, without the long-lived session handshake.
 */

/** Protocol version. Bump on breaking changes to the message shape. */
export const PROTOCOL_VERSION = 1 as const;

/** Request sent to an external tool on stdin. */
export interface ToolRequest {
  v: typeof PROTOCOL_VERSION;
  /** Correlates the response; the tool must echo it back. */
  id: string;
  /** Tool id being invoked. */
  tool: string;
  /** Arbitrary JSON input for the tool. */
  input: unknown;
  /** Minimal serializable slice of the engine context. */
  context: { sessionId: string; cwd: string };
}

/** Response a tool writes to stdout. */
export type ToolResponse =
  | { v: typeof PROTOCOL_VERSION; id: string; ok: true; output: unknown }
  | {
      v: typeof PROTOCOL_VERSION;
      id: string;
      ok: false;
      error: { code: string; message: string; detail?: unknown };
    };

/** Serialize a request to a single NDJSON line (trailing newline included). */
export function encodeRequest(request: ToolRequest): string {
  return JSON.stringify(request) + '\n';
}

/**
 * Parse and structurally validate one NDJSON response line.
 * @param line - A single line of stdout (without trailing newline required).
 * @returns The validated response.
 * @throws {Error} when the line is not a well-formed response object.
 */
export function decodeResponse(line: string): ToolResponse {
  const parsed: unknown = JSON.parse(line);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Response is not an object');
  }
  const r = parsed as Record<string, unknown>;
  if (r.v !== PROTOCOL_VERSION) throw new Error(`Unsupported protocol version: ${String(r.v)}`);
  if (typeof r.id !== 'string') throw new Error('Response missing string "id"');
  if (typeof r.ok !== 'boolean') throw new Error('Response missing boolean "ok"');
  if (r.ok === false) {
    const e = r.error as Record<string, unknown> | undefined;
    if (!e || typeof e.code !== 'string' || typeof e.message !== 'string') {
      throw new Error('Error response missing "error.code"/"error.message"');
    }
  }
  return parsed as ToolResponse;
}
