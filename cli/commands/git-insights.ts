import fs from 'node:fs';
import path from 'node:path';
import {
  collectGitData, deriveGitInsights, diffNumstat, isGitRepo,
  type GitInsights, type NumstatEntry,
} from '../lib/git';
import { collectReleases, deriveActivity, sparkline, type ActivityInsights } from '../lib/activity';
import { emit, ok, type Envelope } from '../lib/json-output';
import { scan } from './stats/scanner';

/**
 * `git-insights` — surfaces the churn / bus-factor / velocity / risk math the
 * stats engine already computes, plus a change-impact view for a ref, as a
 * reusable JSON command. Replaces the awk/sort/uniq pipelines and LLM-derived
 * change-impact in hc-git retro/analyze.
 *
 * JSON contract: ALWAYS exits 0; outside a repo, `data.git` is null with a
 * reason (mirrors stats, which sets git: null rather than failing). Consumers
 * read the field, not the exit code.
 */

export interface GitInsightsOptions {
  path: string;
  since: number;
  top: number;
  json: boolean;
  /** Base ref for change-impact: diff <ref>..HEAD. */
  ref?: string;
}

const STALE_DAYS = 365;

interface ChangeImpact {
  base: string;
  filesChanged: number;
  highRiskTouched: number;
  files: Array<{ file: string; adds: number | null; dels: number | null; highRisk: boolean }>;
}

interface GitInsightsData {
  git: GitInsights | null;
  activity: ActivityInsights | null;
  changeImpact?: ChangeImpact;
  reason?: string;
}

export function cmdGitInsights(opts: GitInsightsOptions): number {
  const root = path.resolve(opts.path);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`✗ Not a directory: ${opts.path}`);
    return 1;
  }

  const data: GitInsightsData = { git: null, activity: null };
  const warnings: string[] = [];

  if (!isGitRepo(root)) {
    data.reason = 'not a git repository';
    emit(ok('git-insights', data, ['not a git repository']), opts.json, human);
    return 0;
  }

  const { files } = scan(root, {});
  const collect = collectGitData(root, opts.since);
  if (collect && collect.perFile.size > 0) {
    data.git = deriveGitInsights(collect.perFile, files, {
      windowDays: opts.since, staleDays: STALE_DAYS, top: opts.top,
    });
    data.activity = deriveActivity(collect, collectReleases(root));
  } else {
    warnings.push('no commit history collected');
  }

  if (opts.ref) {
    data.changeImpact = buildChangeImpact(opts.ref, root, data.git);
  }

  emit(ok('git-insights', data, warnings), opts.json, human);
  return 0;
}

/**
 * Cross-reference the ref's diff with the risk hotspots. Both sides use repo-root
 * relative, `/`-normalized paths, so the set intersection is reliable on Windows
 * too (no `\` vs `/` mismatch). Assumes `path` is the repo root.
 */
function buildChangeImpact(ref: string, root: string, git: GitInsights | null): ChangeImpact {
  const riskFiles = new Set((git?.riskHotspots ?? []).map(h => h.file));
  const entries: NumstatEntry[] = diffNumstat(ref, root);
  const fileRows = entries.map(e => ({ ...e, highRisk: riskFiles.has(e.file) }));
  return {
    base: ref,
    filesChanged: fileRows.length,
    highRiskTouched: fileRows.filter(r => r.highRisk).length,
    files: fileRows,
  };
}

function human(env: Envelope<GitInsightsData>): void {
  const { git, activity, changeImpact, reason } = env.data;
  if (!git) {
    console.log(`git-insights: ${reason ?? 'no git data'}`);
  } else {
    console.log(`Bus factor: ${git.busFactor}   (window ${git.windowDays}d)`);
    console.log(`Owners: ${git.owners.map(o => `${o.author} ${o.share}%`).join(', ') || '—'}`);
    console.log(`Risk hotspots (churn × complexity):`);
    for (const h of git.riskHotspots) console.log(`  ${h.risk}  ${h.file}  (churn ${h.churn} × cx ${h.complexity})`);
    console.log(`Stale (>${git.staleDays}d): ${git.staleTotal} files`);
    if (activity) {
      console.log(`Velocity: ${sparkline(activity.weekly)}  ${activity.avgPerWeek}/wk   active authors (90d): ${activity.activeAuthors90}`);
      if (activity.lastRelease) console.log(`Last release: ${activity.lastRelease.tag} (${activity.lastRelease.date})   ${activity.releasesPerMonth}/mo`);
    }
  }
  if (changeImpact) {
    console.log(`\nChange impact vs ${changeImpact.base}: ${changeImpact.filesChanged} files, ${changeImpact.highRiskTouched} high-risk`);
    for (const f of changeImpact.files) {
      const delta = f.adds === null ? 'bin' : `+${f.adds}/-${f.dels}`;
      console.log(`  ${f.highRisk ? '⚠ ' : '  '}${f.file}  ${delta}`);
    }
  }
  for (const w of env.warnings ?? []) console.log(`! ${w}`);
}
