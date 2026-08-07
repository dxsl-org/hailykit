import { sha256, stableStringify } from '../reasoning-harness/hash';

export interface JudgeEnvelope {
  schemaVersion: 1;
  payloadHash: string;
  escapedPreview: string;
  result: 'pass' | 'fail' | 'inconclusive';
  orderSwapApplied: boolean;
  orderSwapConsistent: boolean;
  perturbationResult: 'pass' | 'fail' | 'untested';
  calibrationSampleId: string | null;
  agreement: number | null;
}

export function quarantineJudgePayload(input: {
  raw: unknown;
  result: JudgeEnvelope['result'];
  orderSwapApplied?: boolean;
  orderSwapConsistent?: boolean;
  perturbationResult?: JudgeEnvelope['perturbationResult'];
  calibrationSampleId?: string | null;
  agreement?: number | null;
}): JudgeEnvelope {
  const serialized = stableStringify(input.raw);
  const agreement = input.agreement ?? null;
  if (agreement !== null && (!Number.isFinite(agreement) || agreement < 0 || agreement > 1)) throw new Error('judge agreement must be between 0 and 1');
  return {
    schemaVersion: 1, payloadHash: sha256(serialized), escapedPreview: inertPreview(serialized), result: input.result,
    orderSwapApplied: input.orderSwapApplied ?? false, orderSwapConsistent: input.orderSwapConsistent ?? false,
    perturbationResult: input.perturbationResult ?? 'untested', calibrationSampleId: input.calibrationSampleId ?? null, agreement,
  };
}

export function isJudgeCalibrated(judge: JudgeEnvelope, minimumAgreement = 0.8): boolean {
  return judge.orderSwapApplied && judge.orderSwapConsistent && judge.perturbationResult === 'pass'
    && Boolean(judge.calibrationSampleId) && judge.agreement !== null && judge.agreement >= minimumAgreement;
}

function inertPreview(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>&`\[\]()]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, 160);
}
