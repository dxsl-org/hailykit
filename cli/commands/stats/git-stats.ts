/**
 * Re-export shim. Canonical source moved to `cli/lib/git.ts` so non-stats
 * commands (git-insights, scanners) share the git primitives without importing
 * from the stats package.
 */
export * from '../../lib/git';
