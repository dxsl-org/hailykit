# TanStack Start Standards

## Project Structure

```
src/
  routes/
    __root.tsx          # Root layout (required)
    index.tsx           # /
    posts.$postId.tsx   # /posts/:postId (dot = path separator)
  router.tsx            # createRouter config
  routeTree.gen.ts      # AUTO-GENERATED — never edit manually
  start.ts              # Global middleware
app.config.ts           # Nitro/Start config
```

## Server Functions

Type-safe RPC — run on server, callable from client:

```ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const getUser = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => db.user.findUnique({ where: { id: data.id } }));
```

## Route with Loader

```ts
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params }) => getPost({ data: { id: params.postId } }),
  component: PostComponent,
});

function PostComponent() {
  const post = Route.useLoaderData();
  return <div>{post.title}</div>;
}
```

## TanStack Query — Suspense Pattern

```ts
import { useSuspenseQuery } from '@tanstack/react-query';

// Works with React Suspense — no isLoading checks needed
const { data } = useSuspenseQuery({
  queryKey: ['posts', id],
  queryFn: () => postsApi.get(id),
});
```

Cache invalidation after mutation:
```ts
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: postsApi.update,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
});
```

## Middleware

```ts
import { createMiddleware } from '@tanstack/react-start';

export const authMiddleware = createMiddleware()
  .server(async ({ next, context }) => {
    const session = await getSession(context.request);
    return next({ context: { user: session.user } });
  });
```

## TanStack Form

Headless, type-safe form library. Pairs with Zod/Valibot/Yup for validation.

```tsx
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';

const form = useForm({
  defaultValues: { email: '', age: 0 },
  validatorAdapter: zodValidator,
  onSubmit: async ({ value }) => { await saveUser(value); },
});

<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
  <form.Field
    name="email"
    validators={{ onChange: z.string().email('Invalid email') }}
  >
    {(field) => (
      <input
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
    )}
  </form.Field>

  <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
    {([canSubmit, isSubmitting]) => (
      <button disabled={!canSubmit}>{isSubmitting ? 'Saving...' : 'Save'}</button>
    )}
  </form.Subscribe>
</form>
```

**Key patterns:**
- `validators.onChange` — sync validation per keystroke
- `validators.onChangeAsync` + `onChangeAsyncDebounceMs` — async validation (uniqueness checks)
- `validators.onBlurAsync` + `onBlurAsyncDebounceMs` — validate on blur, prefer over onChange for expensive checks
- `form.Subscribe` — selective re-renders for submit button state
- `createServerValidate` — SSR-safe validation for Start
- `form.Field` array helpers: `pushValue`, `removeValue`, `swapValues` for dynamic lists

## TanStack AI (Alpha)

Streaming AI chat + structured output. Adapters: OpenAI, Anthropic, Google Gemini, Ollama.

```tsx
// Client
import { useChat } from '@tanstack/react-ai';
import { fetchServerSentEvents } from '@tanstack/ai';

const { messages, sendMessage, isStreaming } = useChat({
  connection: fetchServerSentEvents('/api/chat'),
});

return (
  <>
    {messages.map((m) => <div key={m.id}>{m.role}: {m.content}</div>)}
    <input onKeyDown={(e) => e.key === 'Enter' && sendMessage(e.currentTarget.value)} />
  </>
);
```

```ts
// Server route (Start)
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { chat, toStreamResponse } from '@tanstack/ai';
import { openaiAdapter } from '@tanstack/ai-openai';

export const Route = createAPIFileRoute('/api/chat')({
  POST: async ({ request }) => {
    const { messages } = await request.json();
    const stream = chat({
      adapter: openaiAdapter({ apiKey: process.env.OPENAI_API_KEY }),
      messages,
      model: 'gpt-4o',
    });
    return toStreamResponse(stream);
  },
});
```

**Features:**
- Structured output via Zod schemas (`structuredOutput: { schema: ZodSchema }`)
- Isomorphic tools (run on client OR server, declared once)
- Multimodal: image + text in same message
- Token usage tracking via stream events

## Key Rules

- `routeTree.gen.ts` is auto-generated — never edit, commit as-is
- Server functions are the primary mutation mechanism (no manual API routes needed)
- `useSuspenseQuery` over `useQuery` — eliminates `isLoading` conditional renders
- Route loaders run on server; prefer them over `useEffect` data fetching
- TanStack Form: prefer `onBlurAsync` over `onChangeAsync` for expensive validations
- TanStack AI is alpha — pin version and watch for breaking changes
