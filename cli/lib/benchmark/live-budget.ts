import { asRecord, assertKeys, optNonNegative, reqInt, reqNonNegative } from './schema-helpers';

export interface WorkflowLiveBudget {
  projectedCalls: number;
  projectedSpendUsd: number | null;
  maxCalls: number;
  maxSpendUsd: number | null;
  maxWallMs: number;
  maxOutputBytes: number;
}

export interface WorkflowBudgetUsage {
  calls: number;
  costUsd: number | null;
  wallMs: number | null;
  outputBytes: number | null;
}

export interface WorkflowBudgetState {
  spentCalls: number;
  spentUsd: number;
  spentWallMs: number;
  spentOutputBytes: number;
}

const BUDGET_KEYS = ['projectedCalls', 'projectedSpendUsd', 'maxCalls', 'maxSpendUsd', 'maxWallMs', 'maxOutputBytes'] as const;

export function validateWorkflowLiveBudget(value: unknown): WorkflowLiveBudget {
  const record = asRecord(value, 'workflow budget');
  assertKeys(record, BUDGET_KEYS, 'workflow budget');
  const budget = {
    projectedCalls: reqInt(record.projectedCalls, 'workflow budget.projectedCalls', 1),
    projectedSpendUsd: optNonNegative(record.projectedSpendUsd, 'workflow budget.projectedSpendUsd'),
    maxCalls: reqInt(record.maxCalls, 'workflow budget.maxCalls', 1),
    maxSpendUsd: optNonNegative(record.maxSpendUsd, 'workflow budget.maxSpendUsd'),
    maxWallMs: reqNonNegative(record.maxWallMs, 'workflow budget.maxWallMs'),
    maxOutputBytes: reqNonNegative(record.maxOutputBytes, 'workflow budget.maxOutputBytes'),
  };
  if (budget.projectedCalls > budget.maxCalls) throw new Error('projected live calls exceed maxCalls');
  if (budget.projectedSpendUsd !== null && budget.maxSpendUsd !== null && budget.projectedSpendUsd > budget.maxSpendUsd) throw new Error('projected live spend exceeds maxSpendUsd');
  return budget;
}

export function assertWorkflowBudgetAcknowledged(live: boolean, acknowledged: boolean, budget: WorkflowLiveBudget): void {
  if (!live) return;
  if (!acknowledged) throw new Error('live workflow trials require explicit budget acknowledgement');
  if (budget.maxSpendUsd === null) throw new Error('live workflow trials require maxSpendUsd');
  if (budget.projectedSpendUsd === null) throw new Error('live workflow trials require projectedSpendUsd');
}

export function assertProjectedWorkflowCalls(budget: WorkflowLiveBudget, exactCalls: number): void {
  if (budget.projectedCalls !== exactCalls) throw new Error(`projectedCalls must equal exact schedule size ${exactCalls}`);
  if (exactCalls > budget.maxCalls) throw new Error('exact workflow schedule exceeds maxCalls');
}

export function createWorkflowBudgetState(): WorkflowBudgetState {
  return { spentCalls: 0, spentUsd: 0, spentWallMs: 0, spentOutputBytes: 0 };
}

export function assertCanStartWorkflowCall(state: WorkflowBudgetState, budget: WorkflowLiveBudget): void {
  if (state.spentCalls + 1 > budget.maxCalls) throw new Error('live budget maxCalls would be exceeded');
}

export function consumeWorkflowBudget(state: WorkflowBudgetState, budget: WorkflowLiveBudget, usage: WorkflowBudgetUsage, failClosed: boolean): WorkflowBudgetState {
  const next = {
    spentCalls: state.spentCalls + usage.calls,
    spentUsd: state.spentUsd + numericUsage(usage.costUsd, 'costUsd', failClosed),
    spentWallMs: state.spentWallMs + numericUsage(usage.wallMs, 'wallMs', failClosed),
    spentOutputBytes: state.spentOutputBytes + numericUsage(usage.outputBytes, 'outputBytes', failClosed),
  };
  if (next.spentCalls > budget.maxCalls) throw new Error('live budget maxCalls exceeded');
  if (budget.maxSpendUsd !== null && next.spentUsd > budget.maxSpendUsd) throw new Error('live budget maxSpendUsd exceeded');
  if (next.spentWallMs > budget.maxWallMs) throw new Error('live budget maxWallMs exceeded');
  if (next.spentOutputBytes > budget.maxOutputBytes) throw new Error('live budget maxOutputBytes exceeded');
  return next;
}

function numericUsage(value: number | null, field: string, failClosed: boolean): number {
  if (value !== null) return reqNonNegative(value, `workflow usage.${field}`);
  if (failClosed) throw new Error(`live budget requires known ${field}`);
  return 0;
}
