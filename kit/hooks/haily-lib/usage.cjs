'use strict';

/**
 * Claude API quota cache for HailyKit hooks.
 *
 * Persists a single flat JSON record to tmpdir so every hook invocation can
 * read quota status without making a network call. The record holds both
 * eligibility state and normalised utilization — no second file needed.
 *
 * Record shape: { ts, eligible, note, fiveHour, week, resetsAt }
 *
 * Only Pro / Max / Team / Enterprise subscribers get quota data;
 * free-tier and API-key users get `eligible: false`.
 *
 * @module usage
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_FETCH_TIMEOUT_MS = 5_000;
const DEFAULT_USER_AGENT = 'hailykit/1.0';

const USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const CLAUDE_OAUTH_BETA = 'oauth-2025-04-20';

// ── Cache path ─────────────────────────────────────────────────────────────

function getUsageCachePath() {
  return process.env.HL_USAGE_CACHE_PATH ?? path.join(os.tmpdir(), 'hl-usage-limits-cache.json');
}

// ── Atomic write ───────────────────────────────────────────────────────────

function atomicWrite(destPath, content, now) {
  const tmp = `${destPath}.${process.pid}.${now}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, destPath);
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// ── Cache read / write ─────────────────────────────────────────────────────

/**
 * Read the flat quota cache record.
 * @param {string} [cachePath]
 * @returns {{ ts: number, eligible: boolean, note: string, fiveHour: number|null, week: number|null, resetsAt: string|null }|null}
 */
function readUsageCache(cachePath = getUsageCachePath()) {
  try {
    const obj = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return obj && typeof obj.ts === 'number' ? obj : null;
  } catch {
    return null;
  }
}

function writeUsageCache(record, { cachePath = getUsageCachePath(), now = Date.now() } = {}) {
  const payload = JSON.stringify({
    ts: now,
    eligible: record.eligible,
    note: record.note,
    fiveHour: record.fiveHour ?? null,
    week: record.week ?? null,
    resetsAt: record.resetsAt ?? null,
  });
  atomicWrite(cachePath, payload, now);
}

function getCacheAgeMs(cache, now = Date.now()) {
  if (!cache || typeof cache.ts !== 'number') return Number.POSITIVE_INFINITY;
  return Math.max(0, now - cache.ts);
}

function isUsageCacheFresh(cache, maxAgeMs, now = Date.now()) {
  return getCacheAgeMs(cache, now) <= maxAgeMs;
}

// ── Utilization normalization ──────────────────────────────────────────────

// NOTE: API returns percent (0-100); fractional 0-1 fallback handles any format variation
function normalizeUtilization(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const percent = value > 0 && value < 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

// ── Credential providers ───────────────────────────────────────────────────

function buildCredentialProviders(platform, homedir, execSyncFn) {
  return [
    platform === 'darwin'
      ? () => {
          try {
            const raw = execSyncFn(
              'security find-generic-password -s "Claude Code-credentials" -w',
              { timeout: 5_000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] },
            ).trim();
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
          } catch { return null; }
        }
      : null,
    () => {
      try {
        const parsed = JSON.parse(
          fs.readFileSync(path.join(homedir, '.claude', '.credentials.json'), 'utf8'),
        );
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch { return null; }
    },
  ].filter(Boolean);
}

/**
 * Load Claude credentials, trying macOS keychain before the credentials file.
 * @param {{ platform?: string, homedir?: string, execSyncImpl?: Function }} [opts]
 * @returns {Record<string,unknown>|null}
 */
function readClaudeCredentials({ platform = os.platform(), homedir = os.homedir(), execSyncImpl = execSync } = {}) {
  for (const provider of buildCredentialProviders(platform, homedir, execSyncImpl)) {
    const creds = provider();
    if (creds) return creds;
  }
  return null;
}

// ── Subscription check ─────────────────────────────────────────────────────

function hasAnthropicRuntimeOverride(env = process.env) {
  return ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'].some(
    (k) => typeof env?.[k] === 'string' && env[k].trim() !== '',
  );
}

function getClaudeAccessToken(creds) {
  return creds?.claudeAiOauth?.accessToken ?? null;
}

/**
 * Returns true for paid tiers (Pro / Max / Team / Enterprise).
 * @param {Record<string,unknown>|null} creds
 */
function hasSupportedClaudeSubscription(creds) {
  const sub = String(creds?.claudeAiOauth?.subscriptionType ?? '').trim().toLowerCase();
  if (sub && sub !== 'free' && sub !== 'none') return true;
  return /claude|max|pro|team|enterprise/.test(
    String(creds?.claudeAiOauth?.rateLimitTier ?? '').trim().toLowerCase(),
  );
}

// ── Eligibility resolution ─────────────────────────────────────────────────

/**
 * Determine whether quota fetch is eligible for this session.
 * Reads and writes the unified cache file — no separate eligibility file.
 *
 * @param {{ accessToken?: string, credentials?: unknown, useCache?: boolean,
 *           cachePath?: string, cacheTtlMs?: number, now?: number,
 *           env?: NodeJS.ProcessEnv } & Parameters<typeof readClaudeCredentials>[0]} [opts]
 * @returns {{ eligible: boolean, note: string, accessToken: string|null }}
 */
function resolveQuotaDisplayEligibility(opts = {}) {
  if (hasAnthropicRuntimeOverride(opts.env)) {
    return { eligible: false, note: 'runtime-override', accessToken: null };
  }

  const hasExplicitToken = typeof opts.accessToken === 'string' && opts.accessToken.trim() !== '';
  const hasExplicitCreds = Object.prototype.hasOwnProperty.call(opts, 'credentials');

  if (opts.useCache && !hasExplicitToken && !hasExplicitCreds) {
    const cached = readUsageCache(opts.cachePath);
    const ttl = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    if (isUsageCacheFresh(cached, ttl, opts.now) && typeof cached.eligible === 'boolean') {
      return { eligible: cached.eligible, note: cached.note ?? 'cached', accessToken: null };
    }
  }

  const creds = hasExplicitCreds ? opts.credentials : readClaudeCredentials(opts);

  if (hasExplicitToken) {
    const token = opts.accessToken.trim();
    if (creds && !hasSupportedClaudeSubscription(creds)) {
      return { eligible: false, note: 'non-subscription-auth', accessToken: null };
    }
    return { eligible: true, note: 'eligible', accessToken: token };
  }

  const token = getClaudeAccessToken(creds);
  if (!token) return { eligible: false, note: 'missing-credentials', accessToken: null };
  if (!hasSupportedClaudeSubscription(creds)) return { eligible: false, note: 'non-subscription-auth', accessToken: null };
  return { eligible: true, note: 'eligible', accessToken: token };
}

// ── Fetch ──────────────────────────────────────────────────────────────────

/**
 * Fetch current quota utilization from the Claude OAuth endpoint.
 * @param {{ fetchImpl?: typeof fetch, fetchTimeoutMs?: number, userAgent?: string } & Parameters<typeof resolveQuotaDisplayEligibility>[0]} [opts]
 * @returns {Promise<{ ok: boolean, note: string, record: { eligible: boolean, note: string, fiveHour: number|null, week: number|null, resetsAt: string|null } }>}
 */
async function fetchUsageLimits(opts = {}) {
  const {
    fetchImpl = fetch,
    fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    userAgent = DEFAULT_USER_AGENT,
  } = opts;

  const eligibility = resolveQuotaDisplayEligibility(opts);
  if (!eligibility.eligible || !eligibility.accessToken) {
    return {
      ok: false, note: eligibility.note ?? 'missing-credentials',
      record: { eligible: false, note: eligibility.note ?? 'missing-credentials', fiveHour: null, week: null, resetsAt: null },
    };
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), fetchTimeoutMs) : null;

  try {
    const resp = await fetchImpl(USAGE_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${eligibility.accessToken}`,
        'anthropic-beta': CLAUDE_OAUTH_BETA,
        'User-Agent': userAgent,
      },
      signal: controller?.signal ?? undefined,
    });

    if (!resp.ok) {
      return {
        ok: false, note: `http-${resp.status}`,
        record: { eligible: true, note: `http-${resp.status}`, fiveHour: null, week: null, resetsAt: null },
      };
    }

    const body = await resp.json();
    if (!body || typeof body !== 'object') {
      return {
        ok: false, note: 'invalid-body',
        record: { eligible: true, note: 'invalid-body', fiveHour: null, week: null, resetsAt: null },
      };
    }

    return {
      ok: true, note: 'fetched',
      record: {
        eligible: true,
        note: 'fetched',
        fiveHour: normalizeUtilization(body.five_hour?.utilization),
        week: normalizeUtilization(body.seven_day?.utilization),
        resetsAt: typeof body.five_hour?.resets_at === 'string' ? body.five_hour.resets_at : null,
      },
    };
  } catch (err) {
    const note = err?.name === 'AbortError' ? 'timeout' : 'fetch-failed';
    return {
      ok: false, note,
      record: { eligible: true, note, fiveHour: null, week: null, resetsAt: null },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fetch quota data and persist to unified cache. Fails silently — never throws.
 * @param {Parameters<typeof fetchUsageLimits>[0]} [opts]
 * @returns {Promise<{ ok: boolean, note: string, cache: ReturnType<typeof readUsageCache> }>}
 */
async function refreshUsageCache(opts = {}) {
  const result = await fetchUsageLimits(opts);
  writeUsageCache(result.record, opts);
  return { ok: result.ok, note: result.note, cache: readUsageCache(opts.cachePath) };
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
  getUsageCachePath,
  readUsageCache,
  getCacheAgeMs,
  isUsageCacheFresh,
  hasAnthropicRuntimeOverride,
  readClaudeCredentials,
  hasSupportedClaudeSubscription,
  resolveQuotaDisplayEligibility,
  fetchUsageLimits,
  refreshUsageCache,
};
