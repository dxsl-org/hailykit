# [Feature Name] Implementation Plan

**Date**: YYYY-MM-DD  
**Type**: Feature Implementation  
**Status**: Planning  
**Context Tokens**: <200 words

> **Required — deviation-log:** Log every Decision / Deviation / Surprise in § Deviation Log the moment it occurs — not from memory at the end. On an edge case that diverges from this plan, choose the smallest reversible option, log four lines, and continue; escalate only irreversible or contract-breaking divergence.

## Executive Summary
Brief 2-3 sentence description of the feature and its business value.

## Context Links
- **Related Plans**: [List other plan files - no full content]
- **Dependencies**: [External systems, APIs, existing features]
- **Reference Docs**: [Link to docs in ./docs directory]

## Requirements
### Functional Requirements
- [ ] Requirement 1
- [ ] Requirement 2

### Non-Functional Requirements  
- [ ] Performance target
- [ ] Security requirement
- [ ] Scalability requirement

## Architecture Overview
```mermaid
[Simple component diagram]
```

### Key Components
- **Component 1**: Brief description
- **Component 2**: Brief description

### Data Models
- **Model 1**: Key fields
- **Model 2**: Key fields

## Implementation Phases

### Phase 1: [Name] (Est: X days)
**Scope**: Specific boundaries
**Tasks**:
1. [ ] Task 1 - file: `path/to/file.ts`
2. [ ] Task 2 - file: `path/to/file.ts`

**Acceptance Criteria**:
- [ ] Criteria 1
- [ ] Criteria 2

**Evidence** *(required before marking phase done — paste actual command output)*:
<!-- e.g. "npm test: 24 passed, 0 failed (2026-05-28)" or "npm run lint: clean" -->

### Phase 2: [Name] (Est: X days)
[Repeat structure]

## Testing Strategy
- **Unit Tests**: Specific test coverage targets
- **Integration Tests**: Key interaction points
- **E2E Tests**: Critical user flows

## Security Considerations
- [ ] Security item 1
- [ ] Security item 2

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | High | Mitigation strategy |

## Quick Reference
### Key Commands
```bash
npm run command
```

### Configuration Files
- `config/file.ts`: Purpose
- `.env.example`: Environment variables

## TODO Checklist
- [ ] Phase 1 Task 1
- [ ] Phase 1 Task 2
- [ ] Phase 2 Task 1
- [ ] Testing complete — **evidence recorded in phase Evidence section**
- [ ] Documentation updated
- [ ] Code review passed

## Deviation Log

<Append-only during implementation. One entry per Decision / Deviation / Surprise, logged when it happens. If empty on close, write "None.">

- <Decision|Deviation|Surprise>: <what, one line>
  Why: <what triggered it>
  Impact: <files or contract affected>
  Revert: <how to undo — or "irreversible, escalated">