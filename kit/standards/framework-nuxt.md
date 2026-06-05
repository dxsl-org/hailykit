# Nuxt Standards

Detected via `nuxt` in `package.json` deps.

## When to Use

- Vue-based full-stack apps with SSR/SSG/ISR
- File-based routing + auto-imports for ergonomics
- Server routes (Nitro) for backend without separate framework
- Hybrid rendering (per-route caching strategies)

## Project Structure

```
.
├── app.vue                  # Root component
├── nuxt.config.ts           # Config
├── pages/                   # File-based routes (auto-routed)
│   ├── index.vue            # /
│   └── posts/[id].vue       # /posts/:id
├── layouts/                 # Page layouts
├── components/              # Auto-imported components
├── composables/             # Auto-imported composables (useX)
├── server/
│   ├── api/                 # API routes (Nitro)
│   └── middleware/
├── middleware/              # Route middleware
├── plugins/                 # Auto-loaded plugins
├── public/                  # Static assets
└── assets/                  # Bundled assets (CSS, images)
```

Folder names are conventions Nuxt scans — don't rename without `nuxt.config.ts` override.

## Auto-imports

`components/`, `composables/`, `utils/`, and Vue/Nuxt APIs are all auto-imported. No manual `import` for them.

```vue
<script setup>
// useFetch, useState, useRoute, navigateTo all auto-imported
const { data } = await useFetch('/api/posts');
</script>
```

## Data Fetching

| Composable | Use |
|---|---|
| `useFetch(url)` | Universal fetch (SSR + client), cached |
| `useAsyncData(key, fn)` | Custom async data (e.g. DB call) |
| `useLazyFetch` | Like `useFetch` but doesn't block navigation |
| `$fetch` | Programmatic fetch (no Vue reactivity) |

Always pass a stable `key` to `useAsyncData` — otherwise hydration mismatch.

## Server Routes (Nitro)

```ts
// server/api/posts/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  return await db.post.findUnique({ where: { id } });
});
```

File naming: `[name].[method].ts` (e.g. `users.post.ts` = POST /api/users). Without method → all methods.

## Rendering Modes

Per-route in `nuxt.config.ts`:
```ts
routeRules: {
  '/': { prerender: true },                          // SSG
  '/blog/**': { isr: 3600 },                          // ISR
  '/dashboard/**': { ssr: false },                    // SPA
  '/api/_supabase/**': { proxy: 'https://...' },     // Proxy
}
```

## State Management

- `useState(key, init)` — SSR-safe shared state (per-request on server, persistent on client)
- **Pinia** for complex stores (auto-imported via `@pinia/nuxt`)
- Avoid `ref()` at module level — leaks between requests on server

## Modules

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/image',          // Image optimization
    '@nuxtjs/tailwindcss',  // Tailwind
    '@pinia/nuxt',          // Pinia store
    '@nuxtjs/i18n',         // i18n
    '@nuxt/content',        // Markdown/MDX content
  ],
});
```

Modules are first-class extensions — prefer them over manual setup.

## Best Practices

- File-based routing only — no manual router config
- Server state via `useState`, not module-level refs
- Pass stable keys to `useAsyncData` / `useFetch` to avoid hydration mismatch
- Use `routeRules` for caching strategy per-route
- `useHead()` / `useSeoMeta()` for per-page SEO
- Component naming: `components/User/Profile.vue` → auto-imports as `<UserProfile />`

## Common Pitfalls

- Module-level `ref()` shared across SSR requests → data leaks between users
- `import { ref } from 'vue'` when it's auto-imported → harmless but unnecessary
- `useFetch` inside `onMounted` → doesn't run on server, loses SSR benefit
- Forgetting `await` on `useFetch` in setup → hydration mismatch
- Mixing `useFetch` and `$fetch` for same endpoint with different keys → double fetch

## Resources

- Docs: https://nuxt.com/docs
- Modules: https://nuxt.com/modules
- Nitro: https://nitro.unjs.io
