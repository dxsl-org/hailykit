# JavaScript Standards (modern ES2022+, Node.js)

> For TypeScript projects, see `lang-typescript.md` — this file covers
> vanilla JS / Node.js where types aren't enforced by the compiler.

## Comments

### JSDoc (exported symbols)
Without TypeScript, JSDoc is the contract — type information matters more than usual.
```js
/**
 * Why this function exists + non-obvious contract.
 *
 * @param {string} userId  Must be a valid UUID
 * @param {{ includeDeleted?: boolean }} [opts]
 * @returns {Promise<User | null>}  Resolves to null when soft-deleted
 * @throws {NotFoundError} when userId doesn't exist
 */
export async function getUser(userId, opts = {}) { /* ... */ }
```

- Always JSDoc exported functions in vanilla JS — IDE autocompletion and runtime safety depend on it
- `@param` types are required even when the name suggests the type (no compiler to enforce)
- `@throws` for any domain error a caller is expected to handle
- `// @ts-check` at the top of a file enables JSDoc-driven type checking in VS Code

### Anchor Comments
- `// NOTE:` — non-obvious invariant
- `// TODO(owner):` / `// FIXME(owner):` — must include owner + issue link
- `// eslint-disable-next-line rule -- reason` — reason mandatory after `--`

## Key Idioms

### Modules (ESM by default)
```js
// Prefer ESM over CommonJS for new code
import { readFile } from 'node:fs/promises';   // node: prefix for builtins
import { getUser } from './user-store.js';     // explicit .js extension (Node ESM rule)

export async function load() { /* ... */ }
```
- `package.json` must declare `"type": "module"` for ESM
- Use the `node:` protocol for all builtin imports — disambiguates from npm packages
- Avoid default exports in shared modules — named exports refactor better

### Async
```js
// Promise.all for independent operations — never await sequentially without reason
const [user, prefs] = await Promise.all([fetchUser(id), fetchPrefs(id)]);

// Promise.allSettled when you need partial success
const results = await Promise.allSettled(ids.map(fetchUser));

// Top-level await is supported in ESM — use it for initialization
const config = await loadConfig();
```

### Error Handling
```js
// Throw Errors, not strings or plain objects — Error preserves stack traces
class NotFoundError extends Error {
    constructor(id) {
        super(`Not found: ${id}`);
        this.name = 'NotFoundError';
        this.code = 'NOT_FOUND';
    }
}

// Use cause for wrapping
try {
    await load();
} catch (err) {
    throw new Error('load failed', { cause: err });
}

// Never swallow errors silently — at minimum log with structured context
```

### Modern Built-ins (prefer these)
```js
structuredClone(value)                  // deep clone — replaces JSON.parse(JSON.stringify(...))
Object.hasOwn(obj, 'key')               // replaces obj.hasOwnProperty('key')
crypto.randomUUID()                     // standard, no library needed
Array.prototype.at(-1)                  // last element — replaces arr[arr.length - 1]
arr.findLast(pred) / arr.findLastIndex(pred)

// Optional chaining + nullish coalescing
const city = user?.address?.city ?? 'Unknown';
```

### Patterns to Avoid
```js
var x;                                  // never — use const/let
x == y                                  // never — use === / !==
arguments                               // never — use rest params: (...args)
new Number(5) / new Boolean(true)       // never — use literals
for (let k in obj) {}                   // dangerous — iterates prototype; use Object.keys/entries
JSON.parse(JSON.stringify(obj))         // use structuredClone instead
```

### Object & Class Patterns
```js
// Prefer plain objects + functions over classes when no state/lifetime is needed
export function makeCounter(start = 0) {
    let count = start;
    return {
        inc:  () => ++count,
        get:  () => count,
    };
}

// Use class when you need instanceof checks, private fields, or inheritance
class UserStore {
    #cache = new Map();              // # = truly private (not just convention)
    get(id) { return this.#cache.get(id); }
}
```

## Naming
- Variables/functions: `camelCase`
- Classes/Constructors: `PascalCase`
- Constants (module-level, truly constant): `SCREAMING_SNAKE_CASE` or `camelCase` — pick one per project
- Private (convention): leading `_` for legacy, `#` for true private fields in classes
- Files: `kebab-case.js` (matches HailyKit convention)
- Boolean variables: `isX`, `hasX`, `canX`

## Tooling
- ESLint + Prettier — keep configs minimal and shared
- Node 20+ for `--test` runner, native ESM, top-level await, fetch built-in
- `npm pkg set type=module` for new packages
- Prefer `import.meta.url` over `__dirname` / `__filename` in ESM
