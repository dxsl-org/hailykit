# React Standards

## Eliminate Waterfalls (CRITICAL)

- Use `Promise.all()` for independent async operations — never sequential awaits
- Start promises early in the function body, `await` late (near the usage)
- Use Suspense boundaries to parallelize independent data fetching trees
- Avoid sequential `await` inside `useEffect` chains

```ts
// Bad — sequential
const user = await getUser(id);
const posts = await getPosts(id);

// Good — parallel
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

## Bundle Size (CRITICAL)

- Import directly, never from barrel files: `import { fn } from './module'` not `from './index'`
- `React.lazy` / `next/dynamic` for heavy components (charts, editors, DataGrid, code editors)
- Load analytics/logging scripts after hydration, not in `<head>`
- Conditionally import modules only when the feature is activated
- Defer third-party scripts (analytics, chat widgets) past First Contentful Paint
- Preload critical chunks with `<link rel="modulepreload">`

```ts
const HeavyChart = React.lazy(() => import('./HeavyChart'));
// Use inside Suspense boundary
```

## Re-render Optimization

- Don't subscribe to state only used in event callbacks — read inside the handler with refs
- Use primitive values as `useEffect` dependencies, not object/array references
- `startTransition` for non-urgent updates (search input, filter changes)
- Functional setState for stable callbacks: `setCount(c => c + 1)` not `setCount(count + 1)`
- `useState(() => expensiveInit())` — pass a function for expensive initial values
- Extract static JSX outside the component to prevent object recreation on every render
- `useCallback` for handlers passed as props to memoized children
- `useMemo` only for expensive computations or referential stability needs — not by default

## Server-Side (RSC / Next.js)

- `React.cache()` for per-request deduplication of data fetches
- `after()` for non-blocking post-response work (analytics, logging)
- Minimize serialized data passed from Server → Client components
- Parallel fetching in server components — kick off all data before any `await`
- Use LRU cache (e.g. `lru-cache`) for cross-request memoization

## Rendering Performance

- Use ternary `{cond ? <A /> : <B />}` not `{cond && <B />}` — avoids rendering `0`/`""`
- `Set` / `Map` for O(1) lookups in render-path code
- Hoist RegExp and static constants outside components
- `content-visibility: auto` for offscreen sections (long lists, sidebars)
- SVG: round coordinates to 2-3 decimals to reduce DOM size
- Wrap CSS-animated children in static parents to isolate paint
- `<View>` / `<Activity>` for "keep mounted but hidden" patterns (preserves state)

## JavaScript Microperformance

- Cache property access in hot loops: `const len = arr.length`
- Cache function results when called repeatedly with same args
- Combine iterations: one `for` loop > chained `.filter().map().reduce()`
- Early exit from loops/functions when result is determined
- `arr.toSorted()` over `[...arr].sort()` for immutability without spread cost
- Min/max via single loop, not `Math.max(...arr)` (stack overflow on large arrays)

## Component Patterns

- `React.FC<Props>` with TypeScript for type safety
- Structure order: Props → Hooks → Derived state → Handlers → Effects → Render
- Default export at bottom, named export for testing
- Lazy-load route-level components and heavy widgets
- Wrap lazy components in Suspense with a meaningful fallback (skeleton, not spinner)

```tsx
const Dashboard = React.lazy(() => import('./Dashboard'));

export const App: React.FC = () => (
  <Suspense fallback={<DashboardSkeleton />}>
    <Dashboard />
  </Suspense>
);
```

## Loading & Error States

**CRITICAL:** No early returns with spinners — causes layout shift (CLS).

```tsx
// Bad
if (isLoading) return <Spinner />;
return <Content data={data} />;

// Good — Suspense boundary, content takes its final layout space
<Suspense fallback={<ContentSkeleton />}>
  <Content />
</Suspense>
```

- Use Error Boundaries (`error.tsx` in Next.js, `<ErrorBoundary>` in plain React)
- Show skeleton UIs that match the final layout dimensions
- TanStack Query: handle `onError` in the query config, surface via toast/snackbar

## File Organization

```
src/
├── components/        # Truly reusable (Button, Dialog, Suspense fallbacks)
├── features/          # Domain-specific
│   └── posts/
│       ├── api/       # postsApi.ts
│       ├── components/
│       ├── hooks/
│       ├── helpers/
│       ├── types/
│       └── index.ts   # Public exports
├── hooks/             # App-level hooks (useAuth, useSnackbar)
├── lib/               # Framework-agnostic utilities
└── types/             # Shared types
```

`features/` for domain logic, `components/` for reusable primitives. Never the reverse.

## TypeScript

- Strict mode on, no `any`
- Explicit return types on exported functions
- Type-only imports: `import type { User } from './types'`
- Prop interfaces colocated with component, exported only if reused

## Critical Rules

- Ternary over `&&` for conditional rendering
- `Set` / `Map` for lookups in render
- Hoist RegExp + static data outside components
- `useCallback` for props to memoized children — not for every handler
- No early `return <Spinner />` — use Suspense
