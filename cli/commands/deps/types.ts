/** Common advisory schema across package-manager auditors. Leaf module. */

export type AdvisorySeverity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown';

export interface Advisory {
  package: string;
  severity: AdvisorySeverity;
  /** Advisory / CVE / OSV identifier. */
  id: string;
  vulnerableRange: string | null;
  patchedIn: string | null;
  direct: boolean;
}

export interface EcosystemResult {
  ecosystem: string;
  advisories: Advisory[];
  summary: Record<AdvisorySeverity, number>;
  /** Set when the audit could not run (auditor missing, spawn/parse failure). */
  error?: string;
}

/** Map a vendor severity label to the common scale. */
export function normalizeSeverity(s: string | undefined | null): AdvisorySeverity {
  switch ((s ?? '').toLowerCase()) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'moderate': case 'medium': return 'moderate';
    case 'low': case 'info': case 'informational': return 'low';
    default: return 'unknown';
  }
}

/** Tally advisories by severity. */
export function summarize(advisories: Advisory[]): Record<AdvisorySeverity, number> {
  const s: Record<AdvisorySeverity, number> = { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0 };
  for (const a of advisories) s[a.severity]++;
  return s;
}
