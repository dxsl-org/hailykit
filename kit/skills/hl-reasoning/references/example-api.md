---
name: example-api
description: Worked example — applying sequential reasoning to API design for multi-tenant SaaS authentication.
---

# Example: API Design

**Problem:** Design an authentication API for a multi-tenant SaaS application.

## Without Sequential Reasoning

"Use JWT with OAuth2. Add tenant ID to claims. Implement refresh tokens."

This skips edge cases, scaling concerns, and security trade-offs.

## With Sequential Reasoning

```
Thought 1/5: Clarify requirements

Multi-tenant SaaS authentication must:
- Enforce tenant isolation (no cross-tenant access)
- Scale to thousands of tenants
- Meet industry security standards

Open question: session-based vs. token-based? Stateful vs. stateless?
Next: evaluate the options

Thought 2/6: Evaluate approaches (total adjusted — more to cover)

Sessions vs. JWT:
- Sessions: server-side state, easy revocation, harder to scale horizontally
- JWT: stateless, scales well, revocation is more complex

Multi-tenancy makes sessions harder (which database stores them?).
JWT is better suited for distributed systems.
Next: design the JWT payload

Thought 3/6: JWT payload design

Payload includes: user ID, tenant ID, permissions, expiration.
Open question: should tenant verification happen at the gateway or in each service?
Next: design token refresh

Thought 4/6 [REVISION of Thought 3]: Security gap found

Original plan: tenant ID in JWT claims.
Issue: JWT claims are base64-encoded, not encrypted — tenant IDs are readable to anyone with the token.

Corrected approach:
- Keep tenant ID in claims (needed for routing)
- Add gateway verification to confirm the user belongs to that tenant
- Log all access attempts for audit

Impact: gateway security layer is now required

Thought 5/7: Token refresh strategy (total adjusted)

Access token: 15-minute expiry
Refresh token: 7-day expiry, rotated on each use

Storage:
- Access token: client memory (not localStorage — XSS risk)
- Refresh token: HttpOnly cookie + server-side revocation list

This enables revocation while preserving stateless access token benefits.

Thought 6/7: Gateway enforcement flow

1. Verify JWT signature
2. Extract tenant ID from claims
3. Confirm user belongs to that tenant (cache-first, DB fallback)
4. Forward request with verified tenant context

Addresses the security gap from Thought 4.

Thought 7/7 [FINAL]: Complete design

- JWT with rotating refresh tokens
- Tenant ID in claims + gateway verification
- 15-min access token, 7-day refresh token
- Refresh stored in HttpOnly cookie + revocation list
- Gateway enforces tenant isolation

Confidence: high
Key assumptions: distributed deployment, centralized gateway
Trade-off: slight latency overhead vs. robust security
```

## Techniques Demonstrated

1. **Revision caught a security gap** — tenant ID visibility was caught in Thought 4
2. **Dynamic adjustment** — expanded from 5 to 7 thoughts as complexity emerged
3. **Separation of concerns** — authentication, authorization, multi-tenancy, and revocation addressed separately, then integrated
