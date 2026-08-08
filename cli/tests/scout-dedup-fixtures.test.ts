import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type MetricKey =
  | 'fullScoutCount'
  | 'reuseHitCount'
  | 'quickDeltaCount'
  | 'directExploreScoutCount'
  | 'nestedReportWrites'
  | 'packFallbackCount';

type RouteEvent = {
  step: string;
  routeDecision: string;
  source: string;
  metrics: Record<MetricKey, number>;
  forbiddenFallbacks?: string[];
};

type WorkflowFixture = {
  workflowId: string;
  chain: string[];
  routeEvents: RouteEvent[];
  expected: {
    maxFullScoutCount: number;
    minReuseHitCount: number;
    maxQuickDeltaCount: number;
    maxDirectExploreScoutCount: number;
    maxNestedReportWrites: number;
    maxPackFallbackCount: number;
  };
};

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, 'cli', 'tests', 'fixtures', 'scout-dedup');
const WORKFLOW_FIXTURES = [
  'workflow-hc-new-docs.json',
  'workflow-cook-review.json',
  'workflow-fix-debug.json',
] as const;

function readFixture(fileName: typeof WORKFLOW_FIXTURES[number]): WorkflowFixture {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fileName), 'utf8')) as WorkflowFixture;
}

function aggregateMetrics(fixture: WorkflowFixture): Record<MetricKey, number> {
  return fixture.routeEvents.reduce<Record<MetricKey, number>>((totals, event) => {
    for (const key of Object.keys(totals) as MetricKey[]) {
      totals[key] += event.metrics[key];
    }
    return totals;
  }, {
    fullScoutCount: 0,
    reuseHitCount: 0,
    quickDeltaCount: 0,
    directExploreScoutCount: 0,
    nestedReportWrites: 0,
    packFallbackCount: 0,
  });
}

function eventFor(fixture: WorkflowFixture, step: string): RouteEvent {
  const event = fixture.routeEvents.find((entry) => entry.step === step);
  assert.ok(event, `missing route event for ${step} in ${fixture.workflowId}`);
  return event;
}

test('workflow scout fixtures stay deterministic and synthetic', () => {
  for (const fileName of WORKFLOW_FIXTURES) {
    const fixture = readFixture(fileName);
    assert.ok(fixture.workflowId);
    assert.ok(fixture.chain.length >= 2);
    assert.ok(fixture.routeEvents.length >= 2);
    assert.ok(fixture.routeEvents.every((event) => !/[A-Z]:\\|\/home\//.test(JSON.stringify(event))));
  }
});

test('workflow fixtures enforce max full-scout and no-direct-Explore budgets', () => {
  for (const fileName of WORKFLOW_FIXTURES) {
    const fixture = readFixture(fileName);
    const totals = aggregateMetrics(fixture);
    assert.ok(totals.fullScoutCount <= fixture.expected.maxFullScoutCount, `${fixture.workflowId}: full scout budget exceeded`);
    assert.ok(totals.reuseHitCount >= fixture.expected.minReuseHitCount, `${fixture.workflowId}: reuse hits below expected floor`);
    assert.ok(totals.quickDeltaCount <= fixture.expected.maxQuickDeltaCount, `${fixture.workflowId}: quick delta count exceeded`);
    assert.equal(totals.directExploreScoutCount, fixture.expected.maxDirectExploreScoutCount, `${fixture.workflowId}: direct Explore scout count changed`);
    assert.equal(totals.nestedReportWrites, fixture.expected.maxNestedReportWrites, `${fixture.workflowId}: nested scout-report write detected`);
    assert.equal(totals.packFallbackCount, fixture.expected.maxPackFallbackCount, `${fixture.workflowId}: pack fallback count changed`);
  }
});

test('hc-new to docs-init fixture reuses verified handoff instead of full re-scout', () => {
  const fixture = readFixture('workflow-hc-new-docs.json');
  const totals = aggregateMetrics(fixture);
  const docsInit = eventFor(fixture, 'hc-docs init');

  assert.equal(totals.fullScoutCount, 1);
  assert.equal(docsInit.metrics.fullScoutCount, 0);
  assert.match(docsInit.routeDecision, /reuse-verified-handoff/);
  assert.match(docsInit.routeDecision, /quick-delta/);
});

test('hc-fix to hc-debug fixture forbids docs/codebase-summary and routine pack fallback', () => {
  const fixture = readFixture('workflow-fix-debug.json');
  const totals = aggregateMetrics(fixture);
  const debug = eventFor(fixture, 'hc-debug');

  assert.equal(totals.fullScoutCount, 0);
  assert.equal(totals.packFallbackCount, 0);
  assert.ok(debug.forbiddenFallbacks?.includes('docs/codebase-summary.md'));
  assert.ok(debug.forbiddenFallbacks?.includes('{skill:hc-scout} --pack'));
  assert.equal(debug.metrics.packFallbackCount, 0);
  assert.match(debug.routeDecision, /reuse-session-recon/);
});
