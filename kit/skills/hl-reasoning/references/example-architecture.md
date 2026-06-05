---
name: example-architecture
description: Worked example — applying sequential reasoning to an architecture decision for React state management in a growing application.
---

# Example: Architecture Decision

**Problem:** Choose a state management approach for a React application that has grown too complex for scattered `useState`.

## Sequential Reasoning Approach

```
Thought 1/4: Initial assessment

React app is becoming difficult to maintain. State is scattered across components.
Need a centralized state management solution.
Candidates: Redux, MobX, Zustand, Context API, Jotai.

Next: define the requirements before evaluating

Thought 2/5: Requirements (total adjusted — more to clarify)

The app requires:
- Real-time updates via WebSocket
- Offline support
- Complex nested state
- TypeScript type safety
- Maintainability across a team

These requirements rule out the simpler solutions.
Next: evaluate the remaining candidates

Thought 3/5 [REVISION of Thought 1]: Scope reframing

Original assumption: all state needs to be centralized.
Realization: different state types have different needs.

Better breakdown:
- Server state (API data) → React Query
- UI state (modals, forms) → local useState
- Auth state → Context API
- App-wide settings → a lightweight global store

This significantly reduces the problem. The question is no longer "which single library manages everything" but "what handles app-wide settings."
Next: re-evaluate with the refined scope

Thought 4/6: Narrowed evaluation (total adjusted)

Only app-wide settings need a global store.
Zustand fits well:
- Minimal boilerplate
- Excellent TypeScript support
- No provider wrapper required
- ~1KB bundle size

React Query handles server state (caching, refetch, optimistic updates, offline sync).
Most state stays local.

Next: verify this covers all requirements including real-time

Thought 5/6 [HYPOTHESIS]: Hybrid approach

Proposed: Zustand + React Query + local useState.

- Zustand: theme, user preferences, global UI flags
- React Query: all server data, caching, synchronization
- useState: component-local UI state

Benefits: simple, performant, maintainable.
Open question: does React Query handle WebSocket real-time updates?

Thought 6/6 [FINAL]: Verified solution

React Query supports WebSocket via custom hooks and query invalidation on socket events.
Zustand covers global UI state simply.
Local state handles component-specific concerns.

Architecture decision:
- Zustand for global UI state
- React Query for all server interactions
- Local useState for component state

Confidence: high
Key assumption: team is willing to learn React Query patterns
Trade-off: React Query has a learning curve, but eliminates most manual cache management
Comparison: simpler than Redux, more capable than Context API for server state
```

## Key Techniques Demonstrated

1. **Scope revision** — Thought 3 reframed "need global state" to "need different solutions for different state types"; this revision prevented over-engineering
2. **Separation of concerns** — different state categories mapped to the right tool rather than forcing one solution to handle all
3. **Hypothesis verification** — real-time WebSocket support was explicitly verified before finalizing
4. **YAGNI applied** — Redux rejected because the actual requirements did not justify its complexity

## What the Revision Prevented

Without the Thought 3 reframe, the analysis would likely have selected Redux for all state — a significant over-engineering choice. The revision produced a solution that is both simpler and more appropriate.
