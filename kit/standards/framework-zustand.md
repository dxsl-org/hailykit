# Zustand Standards

Detected via `zustand` in `package.json` — auto-injected as **extra**.

## What Zustand Is

Tiny (1KB) state management library for React. **The de-facto choice** when `useState` + `useContext` aren't enough but Redux is overkill. No providers, no boilerplate, no actions/reducers ceremony.

## Core API

```ts
import { create } from "zustand";

interface BearState {
    bears: number;
    increase: (by: number) => void;
    reset: () => void;
}

const useBearStore = create<BearState>()((set) => ({
    bears: 0,
    increase: (by) => set((state) => ({ bears: state.bears + by })),
    reset: () => set({ bears: 0 }),
}));

// In components
function Counter() {
    const bears = useBearStore((s) => s.bears);
    const increase = useBearStore((s) => s.increase);
    return <button onClick={() => increase(1)}>{bears}</button>;
}
```

**Subscribe to slices** — `useBearStore((s) => s.bears)` only re-renders when `bears` changes.

## Why Selectors Matter

```ts
// Bad: re-renders on ANY state change
const state = useBearStore();

// Good: re-renders only when bears changes
const bears = useBearStore((s) => s.bears);

// Multiple values: use shallow comparison
import { useShallow } from "zustand/react/shallow";

const { bears, fish } = useBearStore(
    useShallow((s) => ({ bears: s.bears, fish: s.fish }))
);
```

## Async Actions

```ts
const useUserStore = create<UserState>()((set, get) => ({
    user: null,
    loading: false,
    error: null,

    async loadUser(id: number) {
        set({ loading: true, error: null });
        try {
            const user = await fetch(`/api/users/${id}`).then(r => r.json());
            set({ user, loading: false });
        } catch (e) {
            set({ error: e.message, loading: false });
        }
    },
}));
```

`get()` lets you read current state without re-rendering.

## Middleware

Zustand supports composable middleware:

```ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const useStore = create<State>()(
    devtools(
        persist(
            immer((set) => ({
                count: 0,
                user: { name: "Alice", prefs: { theme: "dark" } },

                // immer lets you "mutate" — produces a new state under the hood
                setTheme: (theme: string) => set((state) => {
                    state.user.prefs.theme = theme;
                }),
            })),
            { name: "app-storage" }       // localStorage key
        ),
        { name: "app-store" }              // Redux DevTools name
    )
);
```

| Middleware | Use |
|---|---|
| `persist` | Save to localStorage / sessionStorage / custom |
| `devtools` | Redux DevTools integration |
| `immer` | Mutable-looking immutable updates |
| `subscribeWithSelector` | Selective subscriptions outside React |
| `combine` | Type inference for split state/actions |

## Persist (localStorage)

```ts
const useStore = create<State>()(
    persist(
        (set) => ({ count: 0, increment: () => set((s) => ({ count: s.count + 1 })) }),
        {
            name: "my-app",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ count: state.count }),   // only persist some fields
            version: 1,
            migrate: (persisted, version) => {
                if (version === 0) {
                    // upgrade old state shape
                }
                return persisted;
            },
        }
    )
);
```

## Splitting State + Actions

```ts
interface StateOnly {
    count: number;
    user: User | null;
}

interface Actions {
    increment: () => void;
    setUser: (user: User) => void;
}

type Store = StateOnly & Actions;

const useStore = create<Store>()((set) => ({
    count: 0,
    user: null,
    increment: () => set((s) => ({ count: s.count + 1 })),
    setUser: (user) => set({ user }),
}));

// In component
const count = useStore((s) => s.count);                  // re-render on count change
const increment = useStore((s) => s.increment);           // never changes
```

Actions are stable references (no closure capture issues) — always destructure them at the call site.

## Outside React

```ts
// Read current state
const state = useStore.getState();

// Subscribe (manual)
const unsub = useStore.subscribe((state) => console.log(state.count));
// later: unsub()

// Selective subscribe with `subscribeWithSelector` middleware
useStore.subscribe(
    (state) => state.count,
    (count, prevCount) => console.log("changed", count, prevCount)
);
```

Useful for non-React code (analytics, background workers, route guards).

## Slicing (Modular Stores)

```ts
import { StateCreator } from "zustand";

interface UserSlice {
    user: User | null;
    setUser: (user: User) => void;
}

const createUserSlice: StateCreator<UserSlice & PostsSlice, [], [], UserSlice> = (set) => ({
    user: null,
    setUser: (user) => set({ user }),
});

interface PostsSlice {
    posts: Post[];
    addPost: (post: Post) => void;
}

const createPostsSlice: StateCreator<UserSlice & PostsSlice, [], [], PostsSlice> = (set) => ({
    posts: [],
    addPost: (post) => set((s) => ({ posts: [...s.posts, post] })),
});

const useStore = create<UserSlice & PostsSlice>()((...a) => ({
    ...createUserSlice(...a),
    ...createPostsSlice(...a),
}));
```

Split big stores into slices for modularity.

## Best Practices

- **Selectors everywhere** — `useStore((s) => s.x)` not `useStore()`
- **Use `useShallow`** when selecting multiple values
- **Actions are stable** — they never re-create (unlike `useState` setters in custom hooks)
- **Pair with React Query / TanStack Query** for server state — Zustand for **client** state only
- **Slice large stores** by feature area
- **`persist` middleware** for user prefs, draft data, multi-tab state
- **devtools middleware** in development — Redux DevTools works perfectly
- Pin Zustand 5+ — older versions had subtly different APIs

## Common Pitfalls

- Subscribing to whole state (`useStore()` without selector) → re-renders on every change
- Selecting derived data inline → new reference every render → infinite re-render loop with `useEffect`
- Mutating state directly: `state.users.push(...)` → without `immer`, breaks immutability assumptions
- Using Zustand for server state (e.g. API cache) → use **TanStack Query** instead
- Forgetting `useShallow` when selecting object/array → equality check fails, re-renders
- Persisting non-serializable state (Maps, Dates) → breaks; convert in `partialize` or use `replacer`/`reviver`

## Zustand vs Alternatives

| Library | Strength |
|---|---|
| **Zustand** | Simple, no boilerplate, lightweight |
| **Jotai** | Atomic primitives, finer-grained reactivity |
| **Valtio** | Proxy-based, "just mutate" style |
| **Redux Toolkit** | Standard patterns for huge teams, time-travel debug |
| **TanStack Query** | Server state, not client state |
| **Context + useState** | Built in, but causes whole-tree re-renders |

Zustand wins for most React apps where you outgrow `useState`.

## Resources

- Docs: https://zustand.docs.pmnd.rs
- GitHub: https://github.com/pmndrs/zustand
- Awesome list: https://github.com/pmndrs/zustand#-references
- TkDodo on state: https://tkdodo.eu/blog/working-with-zustand
