# [Bug Fix] Implementation Plan

**Date**: YYYY-MM-DD  
**Type**: Bug Fix  
**Priority**: [Critical/High/Medium/Low]  
**Context Tokens**: <150 words

> **Required — deviation-log:** Log every Decision / Deviation / Surprise in § Deviation Log the moment it occurs — not from memory at the end. On an edge case that diverges from this plan, choose the smallest reversible option, log four lines, and continue; escalate only irreversible or contract-breaking divergence.

## Executive Summary
Brief description of the bug and its impact.

## Issue Analysis
### Symptoms
- [ ] Symptom 1
- [ ] Symptom 2

### Root Cause
Brief explanation of the underlying cause.

### Evidence
- **Logs**: Reference to log files (don't include full logs)
- **Error Messages**: Key error patterns
- **Affected Components**: List of impacted files/modules

## Context Links
- **Related Issues**: [GitHub issue numbers]
- **Recent Changes**: [Relevant commits or PRs]
- **Dependencies**: [Related systems]

## Solution Design
### Approach
High-level fix strategy in 2-3 sentences.

### Changes Required
1. **File 1** (`path/to/file.ts`): Brief change description
2. **File 2** (`path/to/file.ts`): Brief change description

### Testing Changes
- [ ] Update existing tests
- [ ] Add new test cases
- [ ] Validate fix doesn't break existing functionality

## Implementation Steps
1. [ ] Step 1 - file: `path/to/file.ts`
2. [ ] Step 2 - file: `path/to/file.ts`
3. [ ] Run test suite
4. [ ] Validate fix in relevant environments

## Verification Plan
### Test Cases
- [ ] Test case 1: Expected behavior
- [ ] Test case 2: Edge case handling
- [ ] Regression test: Ensure no new issues

**Evidence** *(required before marking fix done — paste actual command output)*:
<!-- e.g. "npm test: 31 passed, 0 failed (2026-05-28). Bug scenario from issue #123 no longer reproduces." -->

### Rollback Plan
If the fix causes issues:
1. Revert commit: `git revert <commit-hash>`
2. Restore previous behavior in files X, Y, Z

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | Medium | Mitigation plan |

## TODO Checklist
- [ ] Implement fix
- [ ] Update tests
- [ ] Run full test suite — **evidence recorded in Verification Plan Evidence section**
- [ ] Code review
- [ ] Deploy and verify

## Deviation Log

<Append-only during implementation. One entry per Decision / Deviation / Surprise, logged when it happens. If empty on close, write "None.">

- <Decision|Deviation|Surprise>: <what, one line>
  Why: <what triggered it>
  Impact: <files or contract affected>
  Revert: <how to undo — or "irreversible, escalated">