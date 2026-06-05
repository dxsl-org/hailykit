# TypeScript / JavaScript Standards

## Comments

### JSDoc (exported symbols only)
```ts
/**
 * Why this function exists + any non-obvious contract.
 * @param userId - Must be a valid UUID; throws if not found
 * @returns Resolved user or null when soft-deleted
 * @throws {NotFoundError} when userId doesn't exist
 */
export async function getUser(userId: string): Promise<User | null>
```

- Omit JSDoc for internal/unexported functions when signature + name are self-documenting
- `@param` descriptions: only write when the type alone is ambiguous (e.g., `string` that must match a specific format)
- Always document `@throws` for functions that can throw domain errors

### Anchor Comments
- `// NOTE:` — non-obvious invariant or constraint a reader must know
- `// FIXME: owner/issue` — known broken behavior, must include ticket ref
- `// TODO: owner/issue` — planned change, must include ticket ref
- `// SAFETY:` — before non-null assertion (`!`) or type cast (`as`) that is NOT obvious; explain the invariant

```ts
// SAFETY: session is guaranteed non-null here — router guard runs before this handler
const userId = session!.userId;
```

### Async Contracts
Document cancellation behavior and ordering when not obvious:
```ts
// Waits for inflight writes to flush before resolving — callers must not write after this returns
async function drain(): Promise<void>
```

## Key Idioms

- Prefer `interface` for object shapes; `type` for unions, intersections, mapped types
- Prefer `unknown` over `any` at system boundaries; narrow with type guards
- `Promise<void>` return: document whether rejection is expected (and should be caught by caller)
- Use `satisfies` over `as` for type narrowing when possible
- Prefer `const` assertions (`as const`) over manual enum for small fixed sets
