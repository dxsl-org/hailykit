# Astro Standards

Detected via `astro` in `package.json` deps.

## When to Use

- Content-heavy sites (blogs, docs, marketing, e-commerce catalogs)
- "Islands architecture" — ship zero JS by default, hydrate only interactive components
- Multi-framework: use React + Vue + Svelte in same page
- Static-first with selective SSR

Not the best for highly interactive SPAs — use Next/Nuxt/SvelteKit instead.

## Project Structure

```
src/
├── pages/                   # File-based routes
│   ├── index.astro          # /
│   ├── blog/[slug].astro    # Dynamic
│   └── api/posts.ts         # API endpoints (.ts, .js)
├── layouts/
├── components/              # .astro, .tsx, .vue, .svelte all OK
├── content/                 # Type-safe content collections
│   └── blog/                # Markdown/MDX entries
├── styles/
└── assets/                  # Imported assets (optimized at build)
public/                      # Served as-is
astro.config.mjs
content.config.ts             # Content collection schemas
```

## Astro Components

```astro
---
// Component script — runs at build (or request for SSR)
const { title } = Astro.props;
const posts = await fetch('https://api.example.com/posts').then(r => r.json());
---
<article>
  <h1>{title}</h1>
  {posts.map(p => <p>{p.title}</p>)}
</article>

<style>
  /* Scoped to this component */
  h1 { color: blue; }
</style>
```

Astro components render to HTML — no client JS unless you opt in.

## Islands (Selective Hydration)

```astro
---
import Counter from '../components/Counter.tsx';
---
<!-- Hydration directives -->
<Counter client:load />           <!-- Hydrate immediately -->
<Counter client:idle />            <!-- Hydrate when browser idle -->
<Counter client:visible />         <!-- Hydrate when scrolled into view -->
<Counter client:media="(max-width: 768px)" />  <!-- Conditional -->
<Counter client:only="react" />    <!-- Skip server render -->
```

**Default = zero JS shipped.** Add `client:*` only when you need interactivity.

## Content Collections

Type-safe content via `content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
```

Query in pages:
```astro
---
import { getCollection } from 'astro:content';
const posts = await getCollection('blog');
---
```

## Rendering Modes

Default: SSG (all pages pre-built). Switch in `astro.config.mjs`:
```js
export default defineConfig({
  output: 'static',         // SSG (default)
  // output: 'server',      // SSR per request
  // output: 'hybrid',      // SSG + opt-in SSR per page
});
```

Per-page SSR opt-out (in hybrid mode):
```astro
---
export const prerender = false;
---
```

## Integrations

```bash
npx astro add react vue svelte tailwind mdx sitemap
```

Adds the integration + updates `astro.config.mjs` automatically.

## Best Practices

- **Default to static** — opt into SSR only when truly dynamic
- Use **content collections** for blogs/docs — type-safe, hot-reloaded
- Pick **ONE UI framework** as primary (React or Vue) — mixing 3+ inflates bundle
- `client:visible` for below-the-fold widgets
- `<Image>` from `astro:assets` for auto-optimized images
- View Transitions API (`<ClientRouter />`) for SPA-like nav without SPA cost

## Common Pitfalls

- Adding `client:load` to every component → loses Astro's zero-JS advantage
- Mixing 4+ UI frameworks in one project → bundle bloat
- Forgetting `content.config.ts` schema → silent type errors
- Putting reactive state in `.astro` files (they're not reactive) — extract to islands
- Using `Astro.glob` (legacy) instead of `getCollection`

## Resources

- Docs: https://docs.astro.build
- Integrations: https://astro.build/integrations
