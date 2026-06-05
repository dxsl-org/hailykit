# Next.js Standards (App Router)

## App Router Structure

```
app/
  layout.tsx              # Root layout (server component)
  page.tsx                # Route page
  loading.tsx             # Suspense boundary
  error.tsx               # Error boundary (must be 'use client')
  not-found.tsx           # 404
  api/[route]/route.ts    # Route Handler (GET/POST/etc.)
  [slug]/page.tsx         # Dynamic route
  (group)/                # Route group — no URL impact
```

Routing conventions: folder = segment, `[param]` = dynamic, `(group)` = group, `_private` = excluded.

## Server vs Client Components

Default is Server Component — runs on server only, no client JS bundle, can `await` directly, direct DB access OK.

Opt into client with `'use client'` directive — required for hooks, state, browser APIs, event handlers.

**Rule:** push `'use client'` as far down the tree as possible. Keep server components at the top.

## Data Fetching & Caching

| Pattern | Behavior | When to use |
|---------|----------|-------------|
| `fetch(url)` | Cached forever | Static data |
| `fetch(url, { cache: 'no-store' })` | Always fresh | User-specific, real-time |
| `fetch(url, { next: { revalidate: 60 } })` | ISR — revalidate every N seconds | Semi-static |
| `fetch(url, { next: { tags: ['x'] } })` | Tag-based on-demand revalidation | CMS, dynamic invalidation |

On-demand: `revalidateTag('x')` or `revalidatePath('/path')`

Static pre-generation: `generateStaticParams()` for dynamic routes.

## Server Actions

Mutations without API routes — mark with `'use server'`:

```ts
'use server';
export async function createPost(formData: FormData) {
    const title = formData.get('title');
    await db.posts.create({ data: { title } });
    revalidatePath('/posts');
}
```

Use directly in `<form action={createPost}>` or call from client components.

## Partial Prerendering (PPR)

Static shell + dynamic streaming holes. Enable in `next.config.js`:
```js
experimental: { ppr: 'incremental' }
```
Per page: `export const experimental_ppr = true;`

## Optimization Built-ins

- `<Image>` — auto-optimization, lazy load, responsive (always use instead of `<img>`)
- `<Link>` — prefetch on hover
- `next/font` — zero CLS, self-hosted Google Fonts
- `next/script` — defer/async loading strategies
- `export const dynamic = 'force-static'` / `'force-dynamic'` per route segment

## Best Practices

- Default Server Components; opt client only when needed
- `loading.tsx` + `error.tsx` per route segment
- `metadata` export per page for SEO
- Caching ladder: `force-cache` (static) → `revalidate` (ISR) → `no-store` (dynamic)
- Server Actions over API routes for mutations when possible
- `<Image>` for all images
