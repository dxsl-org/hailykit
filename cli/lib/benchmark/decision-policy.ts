import type { BenchmarkDecision } from './types';
import type { PairedStatistics } from './statistics';

export interface DecisionPolicyInput {
  quality: PairedStatistics;
  efficiency: PairedStatistics;
  margin: { value: number; frozen: boolean; identityValid: boolean } | null;
  calibrationComplete: boolean;
  holdout: { expectedHash: string; observedHash: string; containsRawPrompts: boolean } | null;
  criticalFlagCount: number;
  modelsVerified: boolean;
  providerFootprint: 'complete' | 'inconclusive';
  judgeRequired: boolean;
  judgeCalibrated: boolean;
  minimumEffectivePairs: number;
}
export interface DecisionPolicyResult { decision: BenchmarkDecision; reasons: string[]; qualityStatus: 'pass' | 'fail' | 'inconclusive'; efficiencyStatus: 'pass' | 'inconclusive'; }

export function decideBenchmarkOutcome(input: DecisionPolicyInput): DecisionPolicyResult {
  if (input.criticalFlagCount > 0) return result('no_go', [`critical safety flag count ${input.criticalFlagCount}`], 'fail', 'inconclusive');
  if (provenQualityRegression(input)) return result('no_go', ['quality confidence interval is below the registered non-inferiority margin'], 'fail', 'inconclusive');
  const reasons = prerequisites(input);
  const margin = input.margin?.value;
  if (margin !== undefined && input.quality.ci95 && input.quality.ci95[0] < -margin) reasons.push('quality non-inferiority is not established at 95% confidence');
  if (reasons.length) return result('inconclusive', reasons, 'inconclusive', 'inconclusive');
  const efficiencyReasons: string[] = [];
  if (input.efficiency.descriptiveOnly) efficiencyReasons.push('efficiency comparison is descriptive only');
  if (!input.efficiency.ci95 || input.efficiency.ci95[1] >= 0) efficiencyReasons.push('efficiency improvement is not established at 95% confidence');
  if (input.efficiency.effectivePairs < input.minimumEffectivePairs) efficiencyReasons.push('efficiency effective sample size is underpowered');
  if (input.efficiency.incompletePairs || input.efficiency.identityMismatchPairs) efficiencyReasons.push('efficiency pairs are incomplete or identity-mismatched');
  if (efficiencyReasons.length) return result('inconclusive', efficiencyReasons, 'pass', 'inconclusive');
  return result('go', ['quality is non-inferior and efficiency improvement is decision-grade'], 'pass', 'pass');
}

function provenQualityRegression(input: DecisionPolicyInput): boolean {
  return input.margin !== null && input.quality.ci95 !== null && input.quality.ci95[1] < -input.margin.value;
}
function prerequisites(input: DecisionPolicyInput): string[] {
  const reasons: string[] = [];
  if (!input.margin || !Number.isFinite(input.margin.value) || input.margin.value < 0) reasons.push('registered margin is missing or invalid');
  else { if (!input.margin.frozen) reasons.push('registered margin is not frozen'); if (!input.margin.identityValid) reasons.push('registered margin identity drifted'); }
  if (!input.calibrationComplete) reasons.push('live calibration batches are incomplete');
  if (!input.holdout) reasons.push('private holdout artifact is missing');
  else { if (input.holdout.containsRawPrompts) reasons.push('private holdout artifact contains raw prompts'); if (input.holdout.expectedHash !== input.holdout.observedHash) reasons.push('private holdout hash mismatch'); }
  if (!input.modelsVerified) reasons.push('one or more live models are unverified');
  if (input.providerFootprint !== 'complete') reasons.push('Claude and Codex installed footprints are incomplete');
  if (input.judgeRequired && !input.judgeCalibrated) reasons.push('judge-only evidence is uncalibrated');
  if (input.quality.effectivePairs < input.minimumEffectivePairs) reasons.push('quality effective sample size is underpowered');
  if (input.quality.incompletePairs || input.quality.identityMismatchPairs) reasons.push('quality pairs are incomplete or identity-mismatched');
  if (input.quality.degenerateRepeats) reasons.push('quality repeats are degenerate');
  if (input.quality.flakeBudgetExceeded) reasons.push('quality flake budget exceeded');
  if (input.quality.descriptiveOnly || !input.quality.ci95) reasons.push('quality evidence is not decision-grade');
  return reasons;
}
function result(decision: BenchmarkDecision, reasons: string[], qualityStatus: DecisionPolicyResult['qualityStatus'], efficiencyStatus: DecisionPolicyResult['efficiencyStatus']): DecisionPolicyResult { return { decision, reasons, qualityStatus, efficiencyStatus }; }
