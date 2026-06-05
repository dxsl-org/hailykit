# Polar Standards

Detected via `@polar-sh/sdk` or `@polar-sh/nextjs` / `@polar-sh/better-auth` in `package.json` deps.

## When to Use Polar

- Global SaaS subscriptions with **Merchant of Record** (MoR) — Polar handles VAT, sales tax, dunning
- Indie/developer-focused tools needing fast checkout
- Automated benefit delivery (GitHub repo access, Discord role grants, license keys, file downloads)
- Usage-based / metered billing
- Need lower fees than Stripe + don't want to build tax compliance

**MoR vs PSP:** Polar = Merchant of Record (sells to your customer, you sell to Polar). Stripe = Payment Service Provider (you sell directly). MoR means **Polar handles all tax filings globally** — much simpler for SaaS but slightly higher fees (~4% + 0.40$ vs Stripe's 2.9% + 0.30$).

## Install

```bash
npm install @polar-sh/sdk
# Framework helpers
npm install @polar-sh/nextjs       # Next.js
npm install @polar-sh/better-auth  # Better Auth integration
```

## Setup

```ts
import { Polar } from '@polar-sh/sdk';

export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'production',   // or 'sandbox' for testing
});
```

Token from Polar Dashboard → Settings → API Tokens. Use **organization tokens** for server, never expose client-side.

## Products + Pricing

Products live in Polar dashboard. Each product can have multiple **prices** (one-time, recurring monthly/yearly, metered).

```ts
const products = await polar.products.list({ organizationId });
// One-shot: { type: 'one_time', priceAmount: 1999, priceCurrency: 'usd' }
// Recurring: { type: 'recurring', recurringInterval: 'month', priceAmount: 999 }
// Metered: { type: 'metered_unit', priceAmount: 5, unitAmount: 1000 }  // $0.05/unit
```

## Checkout

Polar-hosted checkout — easiest:

```ts
const checkout = await polar.checkouts.create({
  productPriceId: 'price_xyz',
  successUrl: `${origin}/success?checkout_id={CHECKOUT_ID}`,
  customerEmail: user.email,        // pre-fill
  metadata: { userId: user.id },     // links back to your DB
});
return Response.redirect(checkout.url);
```

**Custom checkout** (embedded): use `@polar-sh/checkout` JS SDK — Polar provides a popup or inline flow you can theme.

## Subscriptions

Created automatically when a recurring product is purchased. Manage via webhooks + API:

```ts
const sub = await polar.subscriptions.get({ id: subscriptionId });
// Statuses: trialing, active, canceled, incomplete, incomplete_expired, past_due, unpaid

// Cancel at period end
await polar.subscriptions.update({
  id: subscriptionId,
  subscriptionUpdate: { cancelAtPeriodEnd: true },
});

// Immediate cancel
await polar.subscriptions.revoke({ id: subscriptionId });
```

## Benefits (Automated Delivery)

Polar's killer feature — configure benefits on a product, Polar grants them on purchase:

- **GitHub repository access** — adds user to private repo
- **Discord server role** — grants role in your Discord
- **License keys** — generates and emails a key
- **File downloads** — grants signed-URL access to files
- **Custom** — webhook fires, you grant whatever you want

Configure in Polar Dashboard → Products → Benefits.

## Webhooks

```ts
import { validateEvent } from '@polar-sh/sdk/webhooks';

export async function POST(req: Request) {
  const headers = Object.fromEntries(req.headers);
  const body = await req.text();

  let event;
  try {
    event = validateEvent(body, headers, process.env.POLAR_WEBHOOK_SECRET!);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.created':           /* track funnel */ break;
    case 'checkout.updated':           /* status changes */ break;
    case 'order.created':              /* fulfillment */ break;
    case 'subscription.created':       /* provision access */ break;
    case 'subscription.updated':       /* sync status */ break;
    case 'subscription.canceled':      /* schedule revoke */ break;
    case 'subscription.revoked':       /* revoke immediately */ break;
    case 'benefit_grant.created':      /* grant succeeded */ break;
    case 'benefit_grant.revoked':      /* benefit removed */ break;
  }
  return new Response('ok');
}
```

**Idempotency:** Store `event.id` in DB; skip if already processed.

## Better Auth Integration

`@polar-sh/better-auth` adds Polar plugin to Better Auth — links Polar customer to auth user automatically:

```ts
import { polar as polarPlugin } from '@polar-sh/better-auth';

export const auth = betterAuth({
  // ...
  plugins: [
    polarPlugin({
      client: polar,
      createCustomerOnSignUp: true,
    }),
  ],
});
```

Now `auth.api.getSession()` includes `polarCustomerId`. Use it in checkout creation.

## Next.js Helper

```ts
// app/api/checkout/route.ts
import { Checkout } from '@polar-sh/nextjs';

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: '/success',
});
// Visit /api/checkout?productPriceId=xxx to launch checkout
```

```ts
// app/api/webhook/route.ts
import { Webhooks } from '@polar-sh/nextjs';

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onCheckoutCreated: async (event) => { /* ... */ },
  onSubscriptionActive: async (event) => { /* ... */ },
});
```

## Rate Limits

- 300 requests/min per organization
- Use SDK's built-in retry/backoff (`retryConfig` option in client)
- Bulk operations: use list endpoints with pagination, not parallel fetches

## Testing

- **Sandbox mode**: separate org, `server: 'sandbox'`
- Test cards: same as Stripe (Polar uses Stripe under the hood)
- Manually trigger webhooks via Polar Dashboard → Webhooks → "Send test event"

## Best Practices

- Store `polarCustomerId`, `polarSubscriptionId` in your DB linked to your user model
- Treat webhooks as source of truth; your DB is a cache
- Use `metadata` field in checkouts/subscriptions to round-trip your internal IDs
- For benefits like GitHub access — verify the user's connected GitHub before purchase to avoid stranded payments
- Use **trial periods** for SaaS — Polar handles trial lifecycle automatically

## Common Pitfalls

- Forgetting `server: 'sandbox'` in test code → real production charges
- Skipping webhook signature verification
- Granting access on `successUrl` redirect → user can close tab before confirmation
- Hardcoded product IDs across sandbox/production — use env vars for both
- Not handling `subscription.canceled` (period-end) vs `subscription.revoked` (immediate) — they're different events

## Resources

- Docs: https://docs.polar.sh
- SDK reference: https://docs.polar.sh/api-reference
- Better Auth plugin: https://docs.polar.sh/integrate/sdk/adapters/better-auth
- Next.js helper: https://docs.polar.sh/integrate/sdk/adapters/nextjs
- Dashboard: https://polar.sh
