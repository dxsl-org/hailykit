# Creem Standards

Detected via `creem` in `package.json` deps.

## When to Use Creem

- Selling **digital products** (software licenses, courses, downloadable files) globally
- Need **Merchant of Record** (MoR) with simpler pricing than Paddle
- Software licensing with **device activation** flow
- Revenue splits between collaborators (no Stripe Connect setup needed)
- Want **no-code** checkout links you can drop in social bios, README files, emails

## Setup

```bash
npm install creem
```

```ts
import { Creem } from 'creem';

export const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: 0,   // 0 = production, 1 = test mode
});
```

API key from Dashboard → Developers → API Keys.

## Products

Created in dashboard. Each product has:
- `id` (Creem's ID) — use in checkout
- `name`, `description`, `image_url`
- Multiple **prices**: one-time or recurring (monthly/yearly/custom interval)
- Optional **license key config** (for software products)
- Optional **file delivery** (signed download links)

## Checkout Sessions

```ts
const session = await creem.createCheckout({
  request_id: orderId,                 // your idempotency key + DB link
  product_id: 'prod_xyz',
  customer: { email: user.email, name: user.name },
  success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  metadata: { userId: user.id },
});
return Response.redirect(session.checkout_url);
```

## No-Code Links

Each product has a permanent checkout URL: `https://www.creem.io/payment/prod_xyz`. Use in:
- README badges
- Social bio links
- Email footers
- Documentation sites

When customer clicks → Creem checkout → on success, webhook fires + you provision.

## Subscriptions

```ts
// Get
const sub = await creem.getSubscription(subscriptionId);

// Update quantity (seats)
await creem.updateSubscription({
  id: subscriptionId,
  items: [{ price_id: 'price_xyz', quantity: 5 }],
});

// Cancel
await creem.cancelSubscription({ id: subscriptionId, cancel_at_period_end: true });
```

**Statuses:** `active`, `trialing`, `past_due`, `canceled`, `paused`.

## License Keys (Software Activation)

Creem's standout feature. Configure on product → Creem auto-generates and emails a key on purchase.

**Activate** (on customer's device/app):
```ts
const result = await creem.activateLicense({
  license_key: userInputKey,
  instance_id: deviceFingerprint,   // e.g. machine UUID
  metadata: { app_version: '1.2.0' },
});
// → { valid: true, expires_at: ..., max_instances: 3, current_instances: 1 }
```

**Validate** (on every app launch):
```ts
const result = await creem.validateLicense({
  license_key: storedKey,
  instance_id: deviceFingerprint,
});
if (!result.valid) /* lock features */;
```

**Deactivate** (on uninstall or "sign out of this device"):
```ts
await creem.deactivateLicense({ license_key: key, instance_id: deviceFingerprint });
```

License config: max instances (1 = single device, N = multi-device), expires on subscription end / never, revocable on refund.

## Webhooks

```ts
import crypto from 'crypto';

export async function POST(req: Request) {
  const signature = req.headers.get('creem-signature')!;
  const body = await req.text();

  const expected = crypto.createHmac('sha256', process.env.CREEM_WEBHOOK_SECRET!)
    .update(body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  switch (event.eventType) {
    case 'checkout.completed':           /* mark order paid */ break;
    case 'subscription.active':          /* provision */ break;
    case 'subscription.canceled':        /* revoke at period end */ break;
    case 'subscription.expired':         /* immediate revoke */ break;
    case 'subscription.trialing':        /* trial start */ break;
    case 'subscription.paid':            /* renewal payment */ break;
    case 'refund.created':               /* revoke + revoke license */ break;
    case 'dispute.created':              /* alert team */ break;
  }
  return new Response('ok');
}
```

## Revenue Splits

Configure split recipients per product in dashboard — Creem auto-routes payouts:
- Recipient = Creem user account (verified) or external bank
- Percentage or fixed amount
- Useful for collabs, affiliate programs, multi-author products

No code required — splits happen automatically on each transaction.

## Storefront

Each Creem org gets a public storefront at `creem.io/{org_slug}` listing all active products. Customize branding in Dashboard → Storefront. Good for indie sellers who don't have their own marketing site yet.

## Testing

- **Test mode**: toggle in dashboard or use `serverIdx: 1` in SDK
- Test cards: standard Stripe-style (`4242...`)
- Webhook simulator in Dashboard → Webhooks → Test

## Best Practices

- Use `request_id` as idempotency key — set to your order ID
- Round-trip your user/order IDs via `metadata`
- Store `creemCustomerId`, `creemSubscriptionId`, `licenseKey` in your DB
- For licensing: always include `instance_id` — protects against shared keys
- Validate license on app launch + periodically (every 24h) for offline-tolerance
- Treat webhooks as source of truth

## Common Pitfalls

- Forgetting `serverIdx: 1` in test code → real charges
- Skipping webhook signature verification
- Using `license_key` validation without `instance_id` → users share keys across devices
- Granting access on success_url without webhook confirmation
- Not handling refund webhook → revoked customers still have access

## Resources

- Docs: https://docs.creem.io
- LLM-friendly: https://docs.creem.io/llms.txt
- API: https://docs.creem.io/api-reference
- Better Auth integration: https://docs.creem.io/integrations/better-auth
- Next.js integration: https://docs.creem.io/integrations/nextjs
- Dashboard: https://creem.io
