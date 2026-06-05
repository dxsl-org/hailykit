/**
 * Base error for all hailykit failures. Carries a stable `code` for
 * programmatic handling plus an optional `cause` for diagnostics.
 */
export class HailyError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'HailyError';
    this.code = code;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Thrown when a requested tool id is not present in the registry. */
export class ToolNotFoundError extends HailyError {
  constructor(toolId: string) {
    super('E_TOOL_NOT_FOUND', `Tool not found: "${toolId}"`);
    this.name = 'ToolNotFoundError';
  }
}

/** Thrown when a skill manifest is structurally invalid. */
export class InvalidManifestError extends HailyError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('E_INVALID_MANIFEST', message, options);
    this.name = 'InvalidManifestError';
  }
}
