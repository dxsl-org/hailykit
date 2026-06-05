#!/usr/bin/env node
/**
 * naming.cjs — Naming pattern formatting helpers.
 *
 * Formats {date}-{issue}-{slug} plan names from plan config and git branch.
 * Re-exported through config.cjs — callers import via that module.
 *
 * @module naming
 */

'use strict';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function sanitizeSlug(slug) {
  return (slug || 'task')
    .toLowerCase()
    .replace(INVALID_FILENAME_CHARS, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

/**
 * Extract a numeric issue ID from a branch name (e.g. `feat/123-auth` → `'123'`).
 * @param {string|null} branch
 * @returns {string|null}
 */
function extractIssueFromBranch(branch) {
  if (!branch) return null;
  const m = branch.match(/[/#](\d+)/);
  return m ? m[1] : null;
}

/**
 * @param {string|null} issueId
 * @param {Object} planConfig
 * @returns {string}
 */
function formatIssueId(issueId, planConfig) {
  if (!issueId) return '';
  const prefix = planConfig?.issuePrefix ?? '';
  return `${prefix}${issueId}`;
}

/**
 * Format the current date per the given format string.
 * Supported tokens: YYYY, YY, MM, DD, HH, mm.
 * @param {string} format
 * @returns {string}
 */
function formatDate(format) {
  const n = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return (format || 'YYMMDD-HHmm')
    .replace('YYYY', String(n.getFullYear()))
    .replace('YY', String(n.getFullYear()).slice(-2))
    .replace('MM', pad(n.getMonth() + 1))
    .replace('DD', pad(n.getDate()))
    .replace('HH', pad(n.getHours()))
    .replace('mm', pad(n.getMinutes()));
}

function extractSlugFromBranch(branch, pattern) {
  if (!branch || !pattern) return null;
  try {
    const m = branch.match(new RegExp(pattern));
    return m ? sanitizeSlug(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Format a naming pattern like `{date}-{issue}-{slug}` into a concrete string.
 * @param {Object} planConfig
 * @param {string|null} gitBranch
 * @returns {string}
 */
function resolveNamingPattern(planConfig, gitBranch) {
  const fmt = planConfig?.namingFormat || '{date}-{issue}-{slug}';
  const date = formatDate(planConfig?.dateFormat);
  const issue = extractIssueFromBranch(gitBranch) || '';
  const slug = extractSlugFromBranch(gitBranch, planConfig?.resolution?.branchPattern) || '';
  return fmt
    .replace('{date}', date)
    .replace('{issue}', issue ? formatIssueId(issue, planConfig) : '')
    .replace('{slug}', slug)
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateNamingPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, error: 'Pattern must be a string' };
  }
  if (!pattern.includes('{date}')) {
    return { valid: false, error: 'Pattern must contain {date}' };
  }
  return { valid: true };
}

function extractTaskListId(config) {
  return config?.taskListId || null;
}

module.exports = {
  INVALID_FILENAME_CHARS,
  sanitizeSlug,
  extractIssueFromBranch,
  formatIssueId,
  formatDate,
  extractSlugFromBranch,
  resolveNamingPattern,
  validateNamingPattern,
  extractTaskListId,
};
