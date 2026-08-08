const SOURCE_KINDS = new Set(['session', 'scout-report', 'context-snippets', 'fresh-run']);
const RECON_MODES = new Set(['full', 'ext', 'quick', 'contracts', 'graph', 'deps', 'pack']);
const FRESHNESS = new Set(['observed', 'same-plan', 'prior', 'stale']);
const ROUTE_HINTS = new Set(['reuse', 'quick', 'parallel', 'graph', 'deps', 'pack']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function push(errors, path, message) {
  errors.push({ path, message });
}

function normalizePath(value) {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.?\//, '').replace(/\/$/, '').toLowerCase();
}

function validateStringArray(errors, value, path) {
  if (!Array.isArray(value)) {
    push(errors, path, 'must be an array');
    return [];
  }
  const normalized = [];
  value.forEach((entry, index) => {
    if (!hasText(entry)) push(errors, `${path}[${index}]`, 'must be a non-empty string');
    else normalized.push(normalizePath(entry.trim()));
  });
  return normalized;
}

function validateEnum(errors, value, path, allowed, label) {
  if (!hasText(value)) push(errors, path, 'must be a non-empty string');
  else if (!allowed.has(value)) push(errors, path, `must be ${label}`);
}

function validateOwnedPathOverlap(errors, ownedPaths) {
  for (let left = 0; left < ownedPaths.length; left += 1) {
    for (let right = left + 1; right < ownedPaths.length; right += 1) {
      const a = ownedPaths[left];
      const b = ownedPaths[right];
      if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) {
        push(errors, 'ownedPaths', 'must not contain overlapping path scopes');
        return;
      }
    }
  }
}

function validateReconEnvelope(value) {
  const errors = [];
  if (!isObject(value)) return [{ path: 'reconEnvelope', message: 'must be an object' }];

  if (!hasText(value.targetDigest)) push(errors, 'targetDigest', 'must be a non-empty string');
  validateEnum(errors, value.sourceKind, 'sourceKind', SOURCE_KINDS, 'session, scout-report, context-snippets, or fresh-run');
  if (!hasText(value.sourceRef)) push(errors, 'sourceRef', 'must be a non-empty string');
  validateEnum(errors, value.mode, 'mode', RECON_MODES, 'full, ext, quick, contracts, graph, deps, or pack');
  validateEnum(errors, value.freshness, 'freshness', FRESHNESS, 'observed, same-plan, prior, or stale');
  if (!hasText(value.repoHead)) push(errors, 'repoHead', 'must be a non-empty string');
  if (!hasText(value.dirtyScopeFingerprint)) push(errors, 'dirtyScopeFingerprint', 'must be a non-empty string');
  validateEnum(errors, value.routeHint, 'routeHint', ROUTE_HINTS, 'reuse, quick, parallel, graph, deps, or pack');
  if (typeof value.complete !== 'boolean') push(errors, 'complete', 'must be boolean');
  if (!hasText(value.createdAt) || Number.isNaN(Date.parse(value.createdAt))) {
    push(errors, 'createdAt', 'must be an ISO timestamp');
  }

  const coveredPaths = validateStringArray(errors, value.coveredPaths, 'coveredPaths');
  validateStringArray(errors, value.excludedPaths, 'excludedPaths');
  const ownedPaths = validateStringArray(errors, value.ownedPaths, 'ownedPaths');
  const gaps = validateStringArray(errors, value.gaps, 'gaps');

  if (coveredPaths.length === 0) push(errors, 'coveredPaths', 'must include at least one covered path');
  validateOwnedPathOverlap(errors, ownedPaths);
  if (value.complete === true && gaps.length > 0) push(errors, 'gaps', 'must be empty when complete is true');
  if (value.complete === true && value.routeHint !== 'reuse') {
    push(errors, 'routeHint', 'must be reuse when complete is true');
  }
  if (value.complete === false && gaps.length === 0) push(errors, 'gaps', 'must identify uncovered work when complete is false');
  if (value.complete === false && value.routeHint === 'reuse') {
    push(errors, 'routeHint', 'must not be reuse when complete is false');
  }
  if (value.routeHint === 'quick' && (gaps.length < 1 || gaps.length > 2)) {
    push(errors, 'routeHint', 'quick requires one or two gap slices');
  }
  if (value.routeHint === 'parallel' && gaps.length < 3) {
    push(errors, 'routeHint', 'parallel requires at least three gap slices');
  }
  if ((value.freshness === 'prior' || value.freshness === 'stale') && value.routeHint === 'reuse') {
    push(errors, 'routeHint', 'prior or stale recon must not route to reuse');
  }

  return errors;
}

module.exports = {
  SOURCE_KINDS,
  RECON_MODES,
  FRESHNESS,
  ROUTE_HINTS,
  validateReconEnvelope
};
