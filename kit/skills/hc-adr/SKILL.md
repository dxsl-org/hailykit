---
name: hc-adr
description: "Capture and auto-discover Architecture Decision Records. Default mode guides writing one ADR for an agreed decision. scan mode detects undocumented decisions from codebase patterns and git history."
when_to_use: "Invoke after agreeing on a significant architectural decision, or run hc-adr scan to surface undocumented decisions in an existing codebase."
user-invocable: true
argument-hint: "[<context>] | scan [--dir <path>]"
metadata:
  category: project
  keywords: [adr, architecture, decisions, documentation, scan, technical-debt]
---

# hc:adr — Architecture Decision Records

Captures the *why* behind architectural decisions as permanent records. Default mode guides writing a single ADR for a known decision. `scan` mode auto-discovers implicit decisions already encoded in the codebase but never formally documented.

## Usage

```
{skill:hc-adr} [<context>]            # guided ADR for a known decision
{skill:hc-adr} scan                   # detect undocumented decisions across codebase
{skill:hc-adr} scan --dir <path>      # scope scan to a subtree
```

```
{skill:hc-adr} "we chose JWT over session cookies for stateless scaling"
{skill:hc-adr} .agents/260601-auth/plan.md
{skill:hc-adr} scan
{skill:hc-adr} scan --dir src/payments
```

## Constraints

> **Required — decisions only, not implementations:** ADRs document *why* a decision was made. The implementation is in the code; the ADR explains why that code exists.

> **Required — rejected alternatives:** Every ADR must document at least two rejected options, each with a concrete reason for rejection — not just a list.

## Process

1. **Recon** — run `hailykit adr-next --dir docs/decisions --slug "<title>" --json` to compute the next sequence number and filename deterministically (empty dir → 0001, follows the existing scheme, sanitizes the slug); then identify related existing ADRs that should be cross-linked.

2. **Draft** — delegate to `haily-adr-writer` agent with full context (conversation summary, plan files, or provided description). The agent writes: context, decision drivers, considered options with pros/cons, decision, and consequences.

3. **Checkpoint** — present draft to user: Approve / Revise / Abort. On Revise, the agent applies feedback and re-presents.

4. **Save** — write to `docs/decisions/ADR-NNN-<slug>.md`. Cross-link related ADRs bidirectionally. Log `✓ ADR-NNN saved: <title>`.

## --scan Mode

Scans the codebase for architectural patterns that represent implicit decisions — choices already implemented but never formally recorded.

Detection signals (applied in parallel):

| Signal | What it finds |
|--------|--------------|
| **New abstraction layers** | Directories like `core/`, `lib/`, `adapters/`, `ports/` with no corresponding ADR |
| **Dependency choices** | Packages in `package.json` / `pyproject.toml` / `go.mod` not referenced in any ADR |
| **Consistent design patterns** | Repository, CQRS, Event-driven, Hexagonal usage spanning ≥3 modules |
| **Uniform error contracts** | Consistent retry logic, circuit breaker, or error-shape across the codebase |
| **Git signals** | Commits containing "switch to", "replace", "migrate from", "use X instead" with no ADR in the same time window |

Filters out already-documented decisions by reading existing ADRs first.

For each candidate: draft a skeleton ADR and present a numbered list. User approves, skips, or combines candidates. Only approved items are saved.

Log `✓ Scan: [N] candidates found — [M] approved, [K] skipped`.

## Workflow Position

**Follows:** `{skill:hc-plan}` — after an architectural choice has been agreed on
**Follows:** `{skill:hc-ship}` — after shipping features with structural changes (prompted passively by hc-ship)
**Related:** `{skill:hc-scout}` — scout surfaces existing patterns; hc-adr documents why they exist

## References

- `haily-adr-writer` agent — writes ADR prose from context; handles numbering, formatting, and cross-linking
