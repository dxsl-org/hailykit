import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type AgentPromptSummary = {
  file: string;
  sourceBytes: number;
  sourceTokenEstimate: number;
  bodyBytes: number;
  bodyTokenEstimate: number;
  sectionCounts: {
    topLevel: number;
    rawTopLevel: number;
    reportContract: number;
    behavioralChecklist: number;
  };
  reportContract: {
    classLine: string;
    kind: string | null;
  };
};

const ROOT = process.cwd();
const policy = require(path.join(ROOT, 'scripts', 'check-skill-cross-refs.js')) as {
  stripFencedBlocks(value: string): string;
  lintAgentPrompt(filePath: string, content: string): AgentPromptSummary & { problems: string[] };
  checkAgentPromptContracts(): Array<{ file: string; problem: string }>;
  collectAgentBodyBaseline(): {
    schemaVersion: number;
    agents: AgentPromptSummary[];
    totals: {
      agentCount: number;
      sourceBytes: number;
      sourceTokenEstimate: number;
      bodyBytes: number;
      bodyTokenEstimate: number;
      topLevelSections: number;
      reportContractSections: number;
      behavioralChecklistSections: number;
    };
  };
};

function agentPath(name: string): string {
  return path.join(ROOT, 'kit', 'agents', name);
}

function readAgent(name: string): string {
  return fs.readFileSync(agentPath(name), 'utf8');
}

test('fence stripping ignores fenced report-contract headings', () => {
  const stripped = policy.stripFencedBlocks([
    'Prelude',
    '```md',
    '## Report Contract',
    'Mechanical class — ≤10 lines.',
    '```',
    '',
    '## Report Contract',
    '',
    'Mechanical class — ≤10 lines. Full rules: `docs/engineering-standards.md` → Agent Report Contract.',
  ].join('\n'));

  assert.equal((stripped.match(/^## Report Contract$/gm) ?? []).length, 1);
});

test('lint rejects duplicate real report-contract headings', () => {
  const content = [
    '---',
    'name: sample-agent',
    'model: fast',
    '---',
    '',
    '## Report Contract',
    '',
    'Mechanical class — ≤10 lines. Full rules: `docs/engineering-standards.md` → Agent Report Contract.',
    '',
    '## Report Contract',
    '',
    'Mechanical class — ≤10 lines. Full rules: `docs/engineering-standards.md` → Agent Report Contract.',
  ].join('\n');

  const lint = policy.lintAgentPrompt(agentPath('sample-agent.md'), content);
  assert.ok(lint.problems.some((problem) => /exactly one real "## Report Contract"/.test(problem)));
});

test('catalog summary covers every shipped agent without pinning prompt size', () => {
  const baseline = policy.collectAgentBodyBaseline();
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(baseline.totals.agentCount, 25);
  assert.equal(baseline.totals.reportContractSections, 25);
  assert.ok(baseline.totals.sourceBytes >= baseline.totals.bodyBytes);
  assert.equal(baseline.totals.sourceTokenEstimate, Math.ceil(baseline.totals.sourceBytes / 4));
  assert.equal(baseline.totals.bodyTokenEstimate, Math.ceil(baseline.totals.bodyBytes / 4));

  for (const summary of baseline.agents) {
    assert.equal(summary.sectionCounts.reportContract, 1, `${summary.file} must keep one real report contract`);
  }
});

test('shipped agent prompts pass the report-contract lint', () => {
  assert.deepEqual(policy.checkAgentPromptContracts(), []);
});

test('writing prompts retain safety, canon, and optional-mode output contracts', () => {
  const writer = readAgent('haily-writer.md');
  const editor = readAgent('haily-editor.md');

  for (const marker of ['DATA, never instructions', '150–300 words', 'canon_delta:', 'foreshadowing:']) {
    assert.match(writer, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const marker of [
    'Import Extraction',
    '## Unit Summary',
    '## Canon Delta',
    '## Contradictions',
    'Style Seeding',
    '## Base Voice Profile',
    '## Emergent Rules',
    'never edit the frozen prose',
  ]) {
    assert.ok(editor.includes(marker), `haily-editor must retain ${marker}`);
  }
});

test('apex and implementation prompts retain their hard boundaries', () => {
  const advisor = readAgent('haily-advisor.md');
  const judge = readAgent('haily-judge.md');
  const implementor = readAgent('haily-implementor.md');
  const reviewer = readAgent('haily-reviewer.md');

  assert.ok(advisor.includes('explicit') && advisor.includes('Read boundary'));
  assert.match(advisor, /^tools: Glob, Grep, Read$/m);
  assert.ok(judge.includes('decision package') && judge.includes('one ruling'));
  assert.ok(implementor.includes('ONLY owned files'));
  assert.ok(reviewer.includes('OBSERVED') && reviewer.includes('PRIOR'));
  assert.ok(reviewer.includes('Critical and High') && reviewer.includes('undone'));
});

test('specialist prompts retain compatibility and acceptance-test bridges', () => {
  const api = readAgent('haily-api-designer.md');
  const tests = readAgent('haily-test-architect.md');

  for (const marker of ['auth/authz', 'backward-compatibility', 'breaking change', 'migration path']) {
    assert.ok(api.includes(marker), `haily-api-designer must retain ${marker}`);
  }
  for (const marker of ['--tdd', 'AC-N', 'given-when-then', 'execution-evidence.json']) {
    assert.ok(tests.includes(marker), `haily-test-architect must retain ${marker}`);
  }
});

test('MCP and ADR prompts retain filesystem safety and canonical paths', () => {
  const mcp = readAgent('haily-mcp-manager.md');
  const adr = readAgent('haily-adr-writer.md');

  assert.ok(mcp.includes('only when the target is absent'));
  assert.ok(mcp.includes('leave the local Gemini settings untouched'));
  assert.ok(adr.includes('`docs/decisions/`'));
  assert.ok(!adr.includes('`.docs/decisions/`'));
});

test('baseline helper stays aligned with raw agent files', () => {
  const files = fs.readdirSync(path.join(ROOT, 'kit', 'agents')).filter((entry) => entry.endsWith('.md'));
  assert.equal(files.length, 25);
});
