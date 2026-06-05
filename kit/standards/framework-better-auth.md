# Better Auth Standards

Framework-agnostic TypeScript auth — pairs with Next.js, TanStack Start, Nuxt, SvelteKit, Remix, Astro, Hono, Express. Detected via `better-auth` in `package.json`.

## Setup

Install + env:
```bash
npm install better-auth
```

```env
BETTER_AUTH_SECRET=<32+ char secret>   # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
```

Server instance (`lib/auth.ts` or `src/auth.ts`):
```ts
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  database: { /* see Database section */ },
  emailAndPassword: { enabled: true, autoSignIn: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

## Database

Built-in adapters: **Prisma**, **Drizzle**, **Kysely**, **MongoDB**. Pick the one your project already uses.

```ts
// Drizzle
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
database: drizzleAdapter(db, { provider: 'pg' }),

// Prisma
import { prismaAdapter } from 'better-auth/adapters/prisma';
database: prismaAdapter(prisma, { provider: 'postgresql' }),
```

Generate schema:
```bash
npx @better-auth/cli generate    # writes schema/migration files
npx @better-auth/cli migrate     # applies (Kysely only)
```

## Mount API Handler

Framework-specific — pick yours:

```ts
// Next.js App Router: app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
export const { POST, GET } = toNextJsHandler(auth);

// TanStack Start: routes/api/auth/$.ts
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { auth } from '~/lib/auth';
export const Route = createAPIFileRoute('/api/auth/$')({
  GET: ({ request }) => auth.handler(request),
  POST: ({ request }) => auth.handler(request),
});

// Hono / Express: similar — pass request to auth.handler
```

## Client

```ts
// auth-client.ts
import { createAuthClient } from 'better-auth/client';
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});
```

```ts
// Usage
await authClient.signUp.email({ email, password, name });
await authClient.signIn.email({ email, password });
await authClient.signIn.social({ provider: 'github' });
await authClient.signOut();

const { data: session } = authClient.useSession();         // React/Vue/Svelte
const { data: session } = await authClient.getSession();   // anywhere
```

## Plugins (Pick What You Need)

Add via `plugins: [...]` in server config. Each may require running `generate` again to add tables.

| Plugin | Use Case |
|---|---|
| `twoFactor` | TOTP-based 2FA |
| `passkey` | WebAuthn / passkeys (passwordless) |
| `magicLink` | Email login links (no password) |
| `username` | Login via username instead of email |
| `organization` | Multi-tenant / teams / orgs |
| `admin` | Admin role + user management endpoints |
| `apiKey` | Generate/revoke API keys per user |
| `oneTimeToken` | Short-lived tokens for verification flows |

```ts
import { twoFactor, passkey } from 'better-auth/plugins';

export const auth = betterAuth({
  // ...
  plugins: [twoFactor(), passkey()],
});
```

## Email

Required for verification + password reset. Bring your own sender:

```ts
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    await sendEmail({ to: user.email, subject: 'Reset password', html: `<a href="${url}">Reset</a>` });
  },
},
emailVerification: {
  sendOnSignUp: true,
  sendVerificationEmail: async ({ user, url }) => { /* ... */ },
},
```

## Sessions

- Default: HTTP-only cookie, encrypted, 7-day expiry, rolling refresh
- DB-backed sessions (rotatable, revocable) over JWT for most apps
- `getSession()` is cached per request — call freely in server code
- Revoke: `auth.api.revokeSession({ sessionId })` (e.g. on password change)

## Rate Limiting

Built-in, enable in production:
```ts
rateLimit: {
  enabled: true,
  window: 60,         // seconds
  max: 100,           // requests per window per IP+endpoint
},
```

Per-endpoint overrides via `customRules`.

## Protected Routes

```ts
// Next.js middleware example
import { auth } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.redirect(new URL('/sign-in', req.url));
  return NextResponse.next();
}
```

## Common Pitfalls

- Forgetting `BETTER_AUTH_SECRET` in prod env → cookie verification breaks silently
- `BETTER_AUTH_URL` mismatched with actual deploy URL → OAuth redirect failures
- Not running `generate` + `migrate` after adding a plugin → missing tables
- Mounting the handler at the wrong path → 404 on `/api/auth/*`
- Using JWT mode without revocation strategy → can't kick compromised sessions

## Implementation Checklist

- [ ] `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` set
- [ ] Database adapter wired
- [ ] `npx @better-auth/cli generate` ran successfully
- [ ] API handler mounted in framework
- [ ] Client instance created with correct `baseURL`
- [ ] Sign-in / sign-up UI built
- [ ] Email sender wired (verification + reset)
- [ ] Protected routes use `getSession()` / `useSession()`
- [ ] Rate limiting enabled for production
- [ ] Plugins added + re-migrated as needed
