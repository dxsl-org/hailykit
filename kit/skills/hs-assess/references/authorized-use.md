# Authorized Use — Scope, Rules of Engagement, Legal Framing

This checklist gates every `hs-assess` invocation. Do not proceed past Recon
until every applicable item is confirmed with the user.

## Authorization Checklist

Confirm before Recon begins:

- [ ] **Written authorization exists** — a signed pentest engagement letter, a
      published bug-bounty program's scope page, or ownership of the target
      (personal lab, self-hosted staging environment, CTF the user is
      registered for).
- [ ] **Target identity matches the authorization** — the hostname/IP/URL/
      repository the user names is the same asset the authorization document
      names. Subdomains, adjacent hosts, or third-party infrastructure
      discovered during Recon are NOT in scope unless explicitly listed.
- [ ] **Time window is current** — engagement letters and bounty scopes can
      expire or be paused; confirm the authorization is active, not historical.
- [ ] **Testing techniques are permitted** — some engagements exclude specific
      classes of testing (e.g., no social engineering, no physical access, no
      production-data exfiltration). Confirm technique scope, not just target
      scope.

If any item is unconfirmed, ask the user directly before Recon. Do not infer
authorization from context, urgency, or the user's confidence alone.

## Rules of Engagement

- **No mass-targeting** — test only the named target(s). Do not pivot to
  scanning unrelated hosts on the same network or IP range without separate
  authorization for each.
- **No denial-of-service** — exclude techniques whose primary effect is
  degrading availability (resource exhaustion, flooding, crash-inducing
  fuzzing against production) unless the authorization explicitly permits a
  DoS test window.
- **No evasion for malice** — anti-detection or obfuscation techniques are
  acceptable only when the engagement itself is a detection-capability test
  (e.g., a red-team exercise measuring blue-team response) and the user has
  confirmed that framing. Never use evasion to conceal unauthorized activity
  from the target owner.
- **Least-invasive proof** — validate a finding with the smallest action that
  conclusively demonstrates impact. Do not escalate beyond proof (e.g., do not
  exfiltrate a full database once a single record proves the injection).
- **Production caution** — for live production targets, prefer read-only or
  non-destructive validation techniques; flag any test that could alter data
  or state and get explicit user confirmation first.
- **Third-party infrastructure** — cloud provider APIs, CDNs, or shared
  hosting discovered during Recon belong to a separate legal entity unless the
  authorization names them; treat them as out of scope by default.

## Legal Framing

Unauthorized access to computer systems is a criminal offense in most
jurisdictions (e.g., the U.S. Computer Fraud and Abuse Act, the UK Computer
Misuse Act, and equivalent statutes elsewhere) even when no damage occurs and
even when the tester believes access was harmless. Authorization is the line
between a legitimate security assessment and a crime — it is not optional
paperwork.

`hs-assess` treats the checklist above as a precondition, not a formality:

- CTF platforms and personal lab environments carry implicit authorization by
  design (the user owns the environment or is a registered participant).
- Bug-bounty programs carry authorization only within the program's published
  scope — out-of-scope assets are unauthorized even on a bounty-covered domain.
- Client engagements require the engagement letter or statement of work naming
  the specific target; verbal claims of authorization without a document are
  insufficient for anything beyond the user's own infrastructure.

When scope is ambiguous or the target looks like it could belong to an
uninvolved third party, stop and ask rather than proceeding on the assumption
that silence implies permission.
