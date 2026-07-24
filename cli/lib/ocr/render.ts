import type { ProgressEvent } from './types';

/**
 * Progress-event rendering for TTY display. Progress fields are DATA, not
 * format or filesystem paths — `doc` in particular is untrusted text that
 * must be stripped of control/ANSI-escape sequences before it ever reaches a
 * terminal, and must never be used to build a path. Leaf module.
 */

/** Strip ASCII C0 control chars, DEL, and ANSI CSI escape sequences. */
export function stripControlChars(s: string): string {
  return s
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/** Render one status line for a `page` progress event; any other event type
 *  (or a non-JSON line — e.g. phase-1's `logging.info` chatter) passes
 *  through unmodified since it's already human-readable text. */
export function formatProgressLine(rawLine: string, evt?: ProgressEvent): string {
  if (!evt || evt.ev !== 'page') return rawLine;
  const doc = stripControlChars(typeof evt.doc === 'string' ? evt.doc : '?');
  const page = typeof evt.page === 'number' ? evt.page : '?';
  const tier = typeof evt.tier === 'string' ? evt.tier : '?';
  const cost = typeof evt.cost_usd === 'number' ? `$${evt.cost_usd.toFixed(3)}` : '$?';
  return `[${doc}] page ${page} · ${tier} · ${cost}`;
}
