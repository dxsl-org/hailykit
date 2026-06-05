/**
 * Minimal logging contract shared across the engine and installer.
 * Dependency-free; the default implementation writes to the console.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Console-backed logger that suppresses messages below `minLevel`.
 * @param minLevel - Lowest level that will be emitted (default `'info'`).
 * @returns A logger writing to the corresponding `console` methods.
 */
export function createConsoleLogger(minLevel: LogLevel = 'info'): Logger {
  const enabled = (level: LogLevel): boolean => LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
  return {
    debug: (m, ...a) => { if (enabled('debug')) console.debug(m, ...a); },
    info: (m, ...a) => { if (enabled('info')) console.info(m, ...a); },
    warn: (m, ...a) => { if (enabled('warn')) console.warn(m, ...a); },
    error: (m, ...a) => { if (enabled('error')) console.error(m, ...a); },
  };
}

/** A logger that discards all output — useful in tests. */
export const silentLogger: Logger = {
  debug() {}, info() {}, warn() {}, error() {},
};
