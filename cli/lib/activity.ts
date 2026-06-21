import { isoDaysAgo, runGit, VELOCITY_DAYS } from './git';
import type { GitCollect } from './git';

/**
 * Repo activity insights for managers: commit velocity (12-week sparkline),
 * contributor counts, and release cadence from version-like tags.
 * Derived from the GitCollect pass — no extra `git log` calls; release
 * cadence adds one cheap `git tag` call. Depends on `git` (one-way).
 */

export interface ReleaseInfo { tag: string; date: string; }

export interface ActivityInsights {
  /** Commits per week, oldest → newest, VELOCITY_DAYS/7 buckets. */
  weekly: number[];
  avgPerWeek: number;
  activeAuthors90: number;
  totalAuthors: number;
  lastRelease: ReleaseInfo | null;
  /** Version-like tags per month over the last year. */
  releasesPerMonth: number;
}

const ACTIVE_DAYS = 90;
const RELEASE_TAG_RE = /^v?\d+(\.\d+)+/;
const SPARK = '▁▂▃▄▅▆▇█';

export function deriveActivity(collect: GitCollect, releases: ReleaseInfo[]): ActivityInsights {
  const weeks = VELOCITY_DAYS / 7;
  const weekly = new Array<number>(weeks).fill(0);
  const now = Date.now();
  for (const [date, count] of collect.recentDaily) {
    const daysAgo = Math.floor((now - Date.parse(date)) / 86_400_000);
    const bucket = weeks - 1 - Math.floor(daysAgo / 7);
    if (bucket >= 0 && bucket < weeks) weekly[bucket] += count;
  }
  const totalCommits = weekly.reduce((a, b) => a + b, 0);

  const activeCutoff = isoDaysAgo(ACTIVE_DAYS);
  let activeAuthors90 = 0;
  for (const last of collect.authorLast.values()) {
    if (last >= activeCutoff) activeAuthors90++;
  }

  const yearCutoff = isoDaysAgo(365);
  const releasesLastYear = releases.filter(r => r.date >= yearCutoff).length;

  return {
    weekly,
    avgPerWeek: Math.round((totalCommits / weeks) * 10) / 10,
    activeAuthors90,
    totalAuthors: collect.authorLast.size,
    lastRelease: releases[0] ?? null,
    releasesPerMonth: Math.round((releasesLastYear / 12) * 10) / 10,
  };
}

/** Version-like tags (v1.2.3, 1.2), newest first. */
export function collectReleases(root: string): ReleaseInfo[] {
  const out = runGit(
    ['tag', '--list', '--sort=-creatordate', '--format=%(creatordate:short)\t%(refname:short)'],
    root,
  );
  if (!out) return [];
  const releases: ReleaseInfo[] = [];
  for (const line of out.split('\n')) {
    const [date, tag] = line.split('\t');
    if (date && tag && RELEASE_TAG_RE.test(tag)) releases.push({ tag, date });
  }
  return releases;
}

/** Render weekly counts as a terminal sparkline (▁▂▃▄▅▆▇█). */
export function sparkline(weekly: number[]): string {
  const max = Math.max(...weekly, 1);
  return weekly.map(n => SPARK[Math.min(SPARK.length - 1, Math.round((n / max) * (SPARK.length - 1)))]).join('');
}
