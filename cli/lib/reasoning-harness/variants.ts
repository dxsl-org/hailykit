import path from 'node:path';
import { sha256 } from './hash';
import type { EvalTier, HarnessVariant, VariantSpec } from './types';

const LEGACY_THINK = 'ultrathink: reason exhaustively before concluding — verify assumptions, consider alternatives, and check your work before responding.';
const LEGACY_REASON = 'State competing hypotheses/options → cite file:line evidence per claim → end with verdict + confidence (high/medium/low) + what would change it.';

/**
 * The proposed variants read the shipped hook rather than a copy of its wording, so an eval
 * can never score text the product no longer injects. Body only, no `## Reasoning Procedure`
 * header, matching how the legacy variant used its section bodies. `HL_SESSION_MODEL` is left
 * unset on purpose: eval providers are not Claude, so this captures exactly what a non-Claude
 * session receives (no `ultrathink:` keyword).
 */
function shippedHarness(tier: EvalTier): string {
  const hook = path.resolve(__dirname, '..', '..', '..', 'kit', 'hooks', 'haily-lib', 'subagent.cjs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- dev-only eval tool reading a kit hook
  const { buildReasoningHarness } = require(hook) as {
    buildReasoningHarness(env: Record<string, string>, config?: unknown): string[];
  };
  // The harness ships off, so the eval opts in explicitly — measuring the default
  // would silently score an empty prelude and label it `proposed`.
  const text = buildReasoningHarness({ HL_MODEL_TIER: tier }, { reasoningHarness: { enabled: true } }).slice(1).join('\n');
  if (!text) throw new Error(`shipped harness produced no text for tier ${tier}`);
  return text;
}

/**
 * The context block a judgment agent actually receives at SubagentStart, at shipped
 * defaults (reasoning harness off). Env values are pinned rather than read from the
 * machine so the variant hash is reproducible across checkouts — the point is to measure
 * the *shape and volume* of the injection, which a different repo path would not change.
 */
function shippedInjection(tier: EvalTier, only?: string[], omit?: string[]): string {
  const hook = path.resolve(__dirname, '..', '..', '..', 'kit', 'hooks', 'haily-lib', 'subagent.cjs');
  /* eslint-disable @typescript-eslint/no-var-requires -- dev-only eval tool reading a kit hook */
  const s = require(hook);
  const env: Record<string, string> = {
    HL_MODEL_TIER: tier,
    HL_REPORTS_PATH: '.agents/reports',
    HL_DOCS_PATH: 'docs',
    HL_PLANS_PATH: '.agents',
    HL_NAME_PATTERN: '260101-0000',
    HL_PACKAGE_MANAGER: 'npm',
  };
  const agentType = 'haily-planner';
  const builders: Record<string, () => string[]> = {
    id: () => s.buildIdSection(agentType, ''),
    plan: () => s.buildPlanSection({}, env),
    reports: () => s.buildReportsSection(env),
    lang: () => s.buildLangSection(env),
    rules: () => s.buildRulesSection(env),
    venv: () => s.buildVenvSection(env),
    naming: () => s.buildNamingSection(env),
    'plan-cli': () => s.buildPlanCliSection(agentType),
    trust: () => s.buildTrustSection({}),
    prefix: () => s.buildPrefixSection(env),
    reasoning: () => s.buildReasoningHarness(env, {}),
    econ: () => s.buildEconSection(),
  };
  const text = s.getSections(agentType)
    .filter((key: string) => (!only || only.includes(key)) && !(omit ?? []).includes(key))
    .map((key: string) => builders[key]?.() ?? [])
    .filter((lines: string[]) => lines.length > 0)
    .map((lines: string[]) => lines.join('\n'))
    .join('\n\n');
  if (!text) throw new Error('shipped injection produced no text');
  return text;
}

const VARIANTS: Record<HarnessVariant, VariantSpec> = {
  none: {
    name: 'none',
    tier: 'fast',
    thinkSection: '',
    reasonSection: '',
    description: 'Disable only the legacy think/reason sections.',
  },
  legacy: {
    name: 'legacy',
    tier: 'fast',
    thinkSection: LEGACY_THINK,
    reasonSection: LEGACY_REASON,
    description: 'Current pre-Phase4 legacy think/reason wording.',
  },
  'ultra-baseline': {
    name: 'ultra-baseline',
    tier: 'ultra',
    thinkSection: '',
    reasonSection: '',
    description: 'Current ultra behavior: no injected think/reason sections.',
  },
  proposed: {
    name: 'proposed',
    tier: 'fast',
    thinkSection: '',
    reasonSection: shippedHarness('fast'),
    description: 'Phase 4 Outcome Floor -> Ground -> Split -> Attack -> Deliver, full form.',
  },
  'proposed-compressed': {
    name: 'proposed-compressed',
    tier: 'thinking',
    thinkSection: '',
    reasonSection: shippedHarness('thinking'),
    description: 'Phase 4 sequence, compressed form served to the thinking tier.',
  },
  'full-injection': {
    name: 'full-injection',
    tier: 'ultra',
    thinkSection: '',
    reasonSection: shippedInjection('ultra'),
    description: 'The whole SubagentStart context block a judgment agent gets at shipped defaults.',
  },
  // Ablations. `full-injection` moves the score; these two locate which part does it,
  // which is the only way to slim the block without guessing.
  'econ-only': {
    name: 'econ-only',
    tier: 'ultra',
    thinkSection: '',
    reasonSection: shippedInjection('ultra', ['econ']),
    description: 'Output Economy alone — the section most likely to drive answer shape.',
  },
  'full-minus-econ': {
    name: 'full-minus-econ',
    tier: 'ultra',
    thinkSection: '',
    reasonSection: shippedInjection('ultra', undefined, ['econ']),
    description: 'Everything except Output Economy — the complement of econ-only.',
  },
};

export function getVariant(name: HarnessVariant): VariantSpec {
  return VARIANTS[name];
}

export function variantHash(name: HarnessVariant): string {
  const variant = getVariant(name);
  return sha256(JSON.stringify({
    name: variant.name,
    tier: variant.tier,
    thinkSection: variant.thinkSection,
    reasonSection: variant.reasonSection,
    description: variant.description,
  }));
}

export function variantPrelude(name: HarnessVariant): string {
  const variant = getVariant(name);
  return [variant.thinkSection, variant.reasonSection].filter(Boolean).join('\n');
}
