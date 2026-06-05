# Remix Standards

Detected via `@remix-run/node` or `@remix-run/react` in `package.json` deps.

> **Note:** Remix v3 is merging into React Router as React Router v7. New projects → consider React Router v7 framework mode instead. This rule covers Remix v2 (stable, widely deployed).

## When to Use

- Web-standards-first React framework (real Forms, Fetch API, web APIs)
- Nested routing with parallel data loading
- Strong progressive enhancement story (works without JS)
- Multi-region edge deployment (Fly, Vercel Edge, Cloudflare Workers)

## Project Structure

```
app/
├── root.tsx                 # Root layout + meta + links
├── entry.client.tsx         # Client hydration entry
├── entry.server.tsx         # Server render entry
├── routes/
│   ├── _index.tsx           # / (the `_` prefix = pathless)
│   ├── posts.$id.tsx        # /posts/:id (dot = path segment)
│   ├── posts_.new.tsx       # /posts/new (trailing _ = break nesting)
│   └── api.posts.ts         # /api/posts (no UI, action/loader only)
└── styles/
```

**Routing convention** (file-based with dots):
- `.` = nested route segment OR pathless layout
- `$param` = dynamic
- `_prefix` = pathless layout
- `_index` = index route
- `route_.child` = trailing underscore breaks parent nesting

## Loader (Server Data Loading)

```tsx
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await db.post.findUnique({ where: { id: params.id } });
  if (!post) throw new Response('Not found', { status: 404 });
  return json({ post });
}

export default function PostRoute() {
  const { post } = useLoaderData<typeof loader>();
  return <article>{post.title}</article>;
}
```

Loaders run server-side on initial load + on navigation. Type via `typeof loader` for inference.

## Action (Mutations)

```tsx
import { redirect, type ActionFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const title = formData.get('title');
  const post = await db.post.create({ data: { title } });
  return redirect(`/posts/${post.id}`);
}

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" />
      <button>Create</button>
    </Form>
  );
}
```

`<Form>` works without JS. With JS, it's enhanced — no full page reload, automatic revalidation.

## Nested Routes + Outlets

`<Outlet />` renders child routes. Each nesting level can have its own loader → **parallel data fetching**:

```tsx
// app/routes/dashboard.tsx
export async function loader() {
  return json({ user: await getUser() });
}
export default function Dashboard() {
  return (
    <div>
      <Nav />
      <Outlet />  {/* Renders dashboard.* children */}
    </div>
  );
}
```

## Error Boundaries

Per-route:
```tsx
export function ErrorBoundary() {
  const error = useRouteError();
  return <div>Error: {error.message}</div>;
}
```

Bubbles up to nearest boundary — keeps the rest of the page interactive.

## Resource Routes

No `default` export = API-only route:
```ts
// app/routes/api.posts.ts
export async function loader() {
  return json({ posts: await db.post.findMany() });
}
```

Returns JSON, never renders UI. Useful for webhooks, RSS feeds, downloads.

## useFetcher (Background Mutations)

```tsx
const fetcher = useFetcher();
return (
  <fetcher.Form method="post">
    <button>Save</button>
  </fetcher.Form>
);
// fetcher.state: 'idle' | 'submitting' | 'loading'
// fetcher.data: returned data from action
```

For mutations that shouldn't navigate (e.g. like button, inline edit).

## Best Practices

- **Loader = server only** — never imports browser code
- Use `<Form>` over `useFetcher` when navigation should happen
- Server-side validation in action — return errors via `json({ errors }, { status: 400 })`
- `headers()` export for per-route cache headers (Cache-Control, etc.)
- `meta()` export for per-page SEO
- Defer slow data with `defer()` + `<Await>` for streaming SSR

## Common Pitfalls

- Importing server-only code (`db`, env secrets) into component scope → bundled to client
- Using `useEffect` to fetch — defeats Remix's loader model
- Forgetting `redirect()` after action mutation → form re-submits on refresh
- `useNavigate` + form submit instead of `<Form>` → loses progressive enhancement
- File naming: `posts/$id.tsx` (slash) is old v1 syntax; v2 uses `posts.$id.tsx`

## Resources

- Docs: https://remix.run/docs
- React Router v7 (Remix's successor): https://reactrouter.com
