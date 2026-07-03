#!/usr/bin/env node
/**
 * style-stats.mjs — whole-manuscript style statistics for hl-write's Verify sweep.
 *
 * Computes facts, never verdicts: per-unit review windows are blind to tics that
 * are individually invisible but systemically overused (a phrase appearing 40x
 * across the book, identical ending cadence, verbatim self-repetition). The
 * numbers become evidence for haily-editor's Voice/Style pass — the editor
 * judges whether they are a problem.
 *
 * Usage: node style-stats.mjs <manuscript-dir> [--json]
 * Zero dependencies. Latin/Vietnamese text (word-boundary based, not CJK).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PHRASE_WINDOW = 20;      // n-gram mining scope: most recent units only ("current tics, not historical")
const NGRAM_MIN = 3, NGRAM_MAX = 6;
const MIN_SENTENCE_LEN = 40;   // chars — below this, repeats are idiom, not self-plagiarism
const SHORT_ENDING_LEN = 60;   // chars — threshold for the "short punchy last line" cadence
const MIN_UNITS = 5;           // below this, stats are noise
const OPENING_CUES = /^(the (sun|dawn|morning|night)|dawn|morning|at (dawn|dusk|night)|(he|she|they) (woke|awoke)|sáng (hôm sau|sớm)|bình minh|hoàng hôn|màn đêm|đêm (đó|ấy|nay)|(tỉnh|thức) (dậy|giấc))/i;

function stripMarkdown(text) {
  return text
    .replace(/^#{1,6} .*$/gm, "")
    .replace(/^>+ ?/gm, "")
    .replace(/[*_`]+/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

function sentences(text) {
  return text.split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

function words(text) {
  // Strip edge punctuation so "wind," and "wind" key the same n-gram —
  // otherwise a tic that sometimes carries a comma fragments below threshold.
  return text.split(/\s+/)
    .map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(w => /\p{L}/u.test(w));
}

// Proper-noun heuristic: Vietnamese names capitalize every syllable, so an
// n-gram that is mostly capitalized words is a character/place name, not a tic.
function isMostlyProperNoun(gram) {
  const ws = gram.split(" ");
  return ws.filter(w => /^\p{Lu}/u.test(w)).length / ws.length >= 2 / 3;
}

function mineNgrams(unitTexts) {
  // Threshold scales with the MINED window, not total units — a once-per-unit
  // tic can never exceed PHRASE_WINDOW occurrences, so a total-based threshold
  // would silently disable detection on long manuscripts.
  const windowSize = Math.min(unitTexts.length, PHRASE_WINDOW);
  const threshold = Math.max(8, Math.ceil(windowSize / 2));
  const counts = new Map();
  for (const text of unitTexts.slice(-PHRASE_WINDOW)) {
    for (const s of sentences(text)) {
      const ws = words(s);
      for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
        for (let i = 0; i + n <= ws.length; i++) {
          const gram = ws.slice(i, i + n).join(" ");
          if (isMostlyProperNoun(gram)) continue;
          const key = gram.toLowerCase();
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
  }
  // Length-desc within equal counts so the longest form of a tic is kept and
  // its sub-grams are deduped away, not the other way round.
  const hits = [...counts.entries()]
    .filter(([, c]) => c >= threshold)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  // Substring dedupe: drop a shorter gram contained in a longer surviving one
  // with a similar count (the longer form is the actual tic).
  const kept = [];
  for (const [gram, count] of hits) {
    if (kept.some(([g, c]) => g.includes(gram) && c >= count * 0.8)) continue;
    kept.push([gram, count]);
  }
  return { threshold, top: kept.slice(0, 10).map(([phrase, count]) => ({ phrase, count })) };
}

function findRepeatedSentences(units) {
  const seen = new Map(); // sentence -> Set(unit)
  for (const { name, text } of units) {
    for (const s of sentences(text)) {
      if (s.length < MIN_SENTENCE_LEN) continue;
      if (!seen.has(s)) seen.set(s, new Set());
      seen.get(s).add(name);
    }
  }
  return [...seen.entries()]
    .filter(([, us]) => us.size >= 3)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 5)
    .map(([sentence, us]) => ({ sentence, units: [...us] }));
}

function endingShape(units) {
  const lens = units.map(({ text }) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    return lines.length ? lines[lines.length - 1].length : 0;
  });
  const sorted = [...lens].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const shortRatio = lens.filter(l => l > 0 && l <= SHORT_ENDING_LEN).length / (lens.length || 1);
  return { short_ratio: +shortRatio.toFixed(2), median_ending_length: median };
}

function openingCueRate(units) {
  const hits = units.filter(({ text }) => {
    const first = text.split("\n").map(l => l.trim()).filter(Boolean)[0] ?? "";
    return OPENING_CUES.test(first);
  });
  return { rate: +(hits.length / (units.length || 1)).toFixed(2), units: hits.map(u => u.name) };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const dir = args.find(a => !a.startsWith("--"));
  if (!dir) {
    console.error("Usage: node style-stats.mjs <manuscript-dir> [--json]");
    process.exit(1);
  }
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".md")).sort();
  } catch (err) {
    console.error(`Cannot read directory: ${err.message}`);
    process.exit(1);
  }
  const units = files.map(f => ({
    name: f,
    text: stripMarkdown(readFileSync(join(dir, f), "utf8")),
  }));

  const ngrams = mineNgrams(units.map(u => u.text));
  const result = {
    units: units.length,
    low_sample: units.length < MIN_UNITS,
    recurring_phrases: { window: Math.min(PHRASE_WINDOW, units.length), threshold: ngrams.threshold, top: ngrams.top },
    repeated_sentences: findRepeatedSentences(units),
    ending_shape: endingShape(units),
    opening_time_cue: openingCueRate(units),
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const r = result;
  console.log(`# Style stats — ${r.units} unit(s)${r.low_sample ? " (below " + MIN_UNITS + ": treat as noise)" : ""}\n`);
  console.log(`## Recurring phrases (last ${r.recurring_phrases.window} units, threshold ${r.recurring_phrases.threshold}x)`);
  console.log(r.recurring_phrases.top.length
    ? r.recurring_phrases.top.map(p => `- "${p.phrase}" — ${p.count}x`).join("\n") : "- none above threshold");
  console.log(`\n## Verbatim sentences in ≥3 units`);
  console.log(r.repeated_sentences.length
    ? r.repeated_sentences.map(s => `- (${s.units.length} units: ${s.units.join(", ")}) "${s.sentence}"`).join("\n") : "- none");
  console.log(`\n## Ending shape`);
  console.log(`- short-ending ratio (≤${SHORT_ENDING_LEN} chars): ${r.ending_shape.short_ratio} · median last-line length: ${r.ending_shape.median_ending_length}`);
  console.log(`\n## Opening time/waking cue`);
  console.log(`- rate: ${r.opening_time_cue.rate}${r.opening_time_cue.units.length ? " (" + r.opening_time_cue.units.join(", ") + ")" : ""}`);
}

main();
