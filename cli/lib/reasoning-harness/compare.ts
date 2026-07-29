import fs from 'node:fs';
import type { RunnerManifest, RunnerRow } from './types';

export interface CellSummary {
  label: string;
  variant: string;
  requestedModel: string;
  rows: number;
  parsed: number;
  /**
   * Rows that actually measured the model — a scored answer, or output the model produced and
   * the parser rejected. Timeouts, auth refusals and wrong-model rows are excluded. This is the
   * denominator every rate below uses; `rows` is only the size of the attempt.
   */
  measured: number;
  solved: number;
  meanScore: number;
  medianOutputBytes: number;
}

export interface Comparison {
  /** Every cell shares these, or the comparison is refused. */
  fixtureHash: string;
  promptDigest: string;
  cells: CellSummary[];
  /**
   * Per-model power check: rows needed per arm to read that model's variant gap at 80% power,
   * against the rows actually present. Grouped by model on purpose — the widest gap in a
   * multi-model table is the gap *between* models, which is expected and not the hypothesis;
   * reporting its power made an underpowered comparison look readable.
   */
  power: Array<{ model: string; from: string; to: string; solvedFrom: number; solvedTo: number; measured: number; neededPerArm: number | null; readable: boolean }>;
  /**
   * False when any artifact predates the `promptDigest` manifest field, so template identity
   * could not be checked. Surfaced rather than thrown: `fixtureHash` still matched, and a
   * caller that reports this honestly is better served than one blocked on old artifacts.
   */
  promptDigestVerified: boolean;
}

/**
 * Load and cross-check a set of eval artifacts before anything compares their numbers.
 *
 * Two cells scored under different fixture definitions are not a comparison, they are two
 * unrelated measurements printed next to each other. This happened in practice: a brittle
 * phrase check was dropped between running the two arms of one pair, and the resulting
 * "1 of 25 difference" was meaningless because the second arm was scored by different rules.
 * Nothing in the artifact format prevented it — the hash was recorded and simply never read.
 *
 * A cell that measured nothing is refused outright: an all-timeout or all-quota-refused artifact
 * has a solved count of zero for reasons that have nothing to do with the model, and every rate
 * computed from it is fiction. Cells with *some* unmeasured rows are kept and reported — a 40-of-41
 * arm is informative — with `measured` carrying the real denominator so the shrink is visible.
 *
 * @param paths NDJSON artifacts written by the runner, at least two
 * @throws when fixture or prompt identity differs, or when a cell contains no measured rows
 */
export function compareCells(paths: string[]): Comparison {
  if (paths.length < 2) throw new Error('a comparison needs at least two cells');
  const loaded = paths.map((p) => readCell(p));

  const [first] = loaded;
  for (const cell of loaded.slice(1)) {
    if (cell.manifest.fixtureHash !== first.manifest.fixtureHash) {
      throw new Error(`fixture identity differs: ${label(first)} scored ${first.manifest.fixtureHash.slice(0, 12)}, ${label(cell)} scored ${cell.manifest.fixtureHash.slice(0, 12)} — re-run one arm so both share a definition`);
    }
    const [a, b] = [promptDigest(cell.manifest), promptDigest(first.manifest)];
    if (a && b && a !== b) {
      throw new Error(`prompt template differs between ${label(first)} and ${label(cell)} — scores are not comparable across template edits`);
    }
  }

  const cells = loaded.map(({ manifest, rows }) => summarize(manifest, rows));
  for (const cell of cells) {
    if (!cell.measured) throw new Error(`${cell.label} measured no rows out of ${cell.rows} — every rate from it would describe the environment, not the model`);
  }
  return {
    fixtureHash: first.manifest.fixtureHash,
    promptDigest: promptDigest(first.manifest) ?? 'unrecorded',
    cells,
    power: withinModelPower(cells),
    promptDigestVerified: loaded.every(({ manifest }) => Boolean(promptDigest(manifest))),
  };
}

function readCell(filePath: string): { manifest: RunnerManifest; rows: RunnerRow[] } {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
  const manifest = JSON.parse(lines[0]) as RunnerManifest;
  if (manifest.kind !== 'manifest') throw new Error(`${filePath}: first line is not a manifest`);
  const rows = lines.slice(1).map((l) => JSON.parse(l) as RunnerRow).filter((r) => r.kind === 'row');
  return { manifest, rows };
}

function summarize(manifest: RunnerManifest, rows: RunnerRow[]): CellSummary {
  const scored = rows.filter((r) => r.weightedScore !== null);
  // Measured rows only. This column is read as "how long are the answers", so a timed-out row
  // contributing a zero — or an error envelope contributing its own bytes — describes the
  // environment while looking like the model got terser.
  const bytes = scored.map((r) => r.outputBytes).sort((a, b) => a - b);
  return {
    label: `${manifest.requestedModel}/${manifest.variant}`,
    variant: manifest.variant,
    requestedModel: manifest.requestedModel,
    rows: rows.length,
    parsed: rows.filter((r) => r.status === 'success').length,
    measured: scored.length,
    solved: scored.filter((r) => r.weightedScore === 1).length,
    meanScore: scored.length ? scored.reduce((a, r) => a + (r.weightedScore ?? 0), 0) / scored.length : 0,
    medianOutputBytes: bytes.length ? bytes[Math.floor(bytes.length / 2)] : 0,
  };
}

/** Consecutive variant pairs within each model, so each row answers one hypothesis. */
function withinModelPower(cells: CellSummary[]): Comparison['power'] {
  const byModel = new Map<string, CellSummary[]>();
  for (const c of cells) byModel.set(c.requestedModel, [...(byModel.get(c.requestedModel) ?? []), c]);

  const out: Comparison['power'] = [];
  for (const [model, group] of byModel) {
    for (let i = 1; i < group.length; i++) {
      const [a, b] = [group[0], group[i]];
      // Measured rows, not attempted ones. A timed-out row is not a failure the model produced,
      // so counting it in the denominator understates the rate and, in the all-unmeasured case,
      // would invent one outright.
      const measured = Math.min(a.measured, b.measured);
      const needed = rowsNeeded(a.solved / a.measured, b.solved / b.measured);
      out.push({
        model, from: a.variant, to: b.variant, solvedFrom: a.solved, solvedTo: b.solved, measured,
        neededPerArm: needed, readable: needed !== null && needed <= measured,
      });
    }
  }
  return out;
}

/**
 * Rows per arm for roughly 80% power at alpha 0.05 on a two-proportion difference. Null when the
 * two rates are identical. A normal approximation, so treat it as an order of magnitude rather
 * than an exact requirement — it is here to answer "is this gap even readable", not to license a
 * p-value.
 */
function rowsNeeded(p1: number, p2: number): number | null {
  const d = Math.abs(p1 - p2);
  if (!d) return null;
  const p = (p1 + p2) / 2;
  // Guard the degenerate p=0 or p=1 case, where the approximation would report zero rows.
  const variance = Math.max(p * (1 - p), 0.01);
  return Math.ceil((16 * variance) / (d * d));
}

/**
 * Null for artifacts written before `promptDigest` became a manifest field. Deliberately not
 * substituted with `manifestHash`: that value legitimately differs between two variants of the
 * same comparison, so using it as a stand-in made every valid pair look like a template change.
 */
function promptDigest(manifest: RunnerManifest): string | null {
  return (manifest as unknown as { promptDigest?: string }).promptDigest ?? null;
}

function label(cell: { manifest: RunnerManifest }): string {
  return `${cell.manifest.requestedModel}/${cell.manifest.variant}`;
}
