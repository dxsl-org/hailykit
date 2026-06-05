# Paddle Standards

Detected via `@paddle/paddle-node-sdk` or `@paddle/paddle-js` in `package.json` deps.

## When to Use Paddle

- Global SaaS subscriptions with **Merchant of Record** (MoR) — Paddle handles VAT, sales tax, dunning
- Subscription businesses needing **Retain** (Paddle's churn-prevention tools)
- B2B SaaS with complex tax requirements (EU VAT, US sales tax, GST)
- Need **inline checkout** (overlay or embedded) with Paddle branding

**MoR difference vs Stripe:** Paddle is the seller of record — they handle all global tax compliance, chargebacks, fraud. You receive a single payout net of fees + tax. Slightly higher fees (~5% + $0.50) but zero tax overhead.

## Entity Hierarchy

| Entity | Purpose |
|---|---|
| **Product** | A "thing" you sell (Pro Plan, Add-on Storage) |
| **Price** | A specific cost for a product (monthly $9, yearly $90, one-time $29) — products have multiple prices |
| **Customer** | A buyer record, identified by email |
| **Address** | Billing address (required for tax calc) |
| **Business** | B2B tax info (VAT number, company name) — optional |
| **Transaction** | A single payment or recurring charge |
| **Subscription** | Active recurring billing |

## Install

```bash
npm install @paddle/paddle-node-sdk @paddle/paddle-js
```

## Setup

```ts
import { Paddle, Environment } from '@paddle/paddle-node-sdk';

export const paddle = new Paddle(process.env.PADDLE_API_KEY!, {
  environment: Environment.sandbox,   // or Environment.production
});
```

Get API key from Dashboard → Developer tools → Authentication.

## Checkout — Overlay (Recommended)

```ts
// Client: load Paddle.js
import { initializePaddle, Paddle } from '@paddle/paddle-js';

let paddle: Paddle | undefined;
initializePaddle({
  environment: 'sandbox',
  token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
}).then(p => { paddle = p; });

// Open checkout
paddle?.Checkout.open({
  items: [{ priceId: 'pri_xyz', quantity: 1 }],
  customer: { email: user.email },
  customData: { userId: user.id },   // round-trips through webhook
});
```

## Checkout — Inline (Custom UI)

Pass `Checkout.open` a `frameTarget` selector to embed inside your page:
```ts
paddle?.Checkout.open({
  items: [...],
  settings: { displayMode: 'inline', frameTarget: '#checkout-container', frameInitialHeight: 450 },
});
```

## Subscriptions

```ts
// Get
const sub = await paddle.subscriptions.get(subscriptionId);

// Update (change quantity, switch plan)
await paddle.subscriptions.update(subscriptionId, {
  items: [{ priceId: 'pri_new', quantity: 1 }],
  prorationBillingMode: 'prorated_immediately',
});

// Pause
await paddle.subscriptions.pause(subscriptionId, { effectiveFrom: 'next_billing_period' });

// Cancel
await paddle.subscriptions.cancel(subscriptionId, { effectiveFrom: 'next_billing_period' });
```

**Statuses:** `active`, `trialing`, `past_due`, `paused`, `canceled`. Most lifecycle events arrive via webhook.

## Webhooks

```ts
import { EventName } from '@paddle/paddle-node-sdk';
import crypto from 'crypto';

export async function POST(req: Request) {
  const signature = req.headers.get('paddle-signature')!;
  const body = await req.text();

  if (!verifyPaddleSignature(body, signature, process.env.PADDLE_WEBHOOK_SECRET!)) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  switch (event.event_type) {
    case EventName.SubscriptionCreated:        /* provision */ break;
    case EventName.SubscriptionUpdated:        /* sync state */ break;
    case EventName.SubscriptionCanceled:       /* revoke at period end */ break;
    case EventName.TransactionCompleted:       /* mark order paid */ break;
    case EventName.TransactionPaymentFailed:   /* dunning */ break;
  }
  return new Response('ok');
}

// SHA256 HMAC verification
function verifyPaddleSignature(body: string, header: string, secret: string): boolean {
  const [ts, h1] = header.split(';').map(p => p.split('=')[1]);
  const expected = crypto.createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(h1), Buffer.from(expected));
}
```

**Always verify signature.** Paddle signs as `ts=...;h1=...` — verify both timestamp (replay protection) and HMAC.

## Retain (Churn Prevention)

Paddle includes Retain — dunning + cancellation flows that reduce churn:
- **Smart Retries** — auto-retry failed payments with optimal timing
- **Cancellation Flow** — offer pause/discount before letting customer cancel
- **Email Sequences** — automated dunning emails

Configure in Dashboard → Retain. No code needed for most flows.

## Tax + Invoices

Paddle auto-handles:
- VAT (EU) / GST (UK, Australia) / sales tax (US states)
- Reverse-charge for B2B with VAT number
- Compliant invoices in customer's language + currency
- VAT MOSS reporting

Just collect address — Paddle does the rest.

## Testing

- **Sandbox** environment: separate dashboard, separate API key, `Environment.sandbox`
- Test cards: same as Stripe (`4242 4242 4242 4242`)
- Trigger webhooks manually: Dashboard → Webhooks → Send test

## Best Practices

- Use `customData` to round-trip your internal IDs through checkout → subscription → webhook
- Store `paddleCustomerId` + `paddleSubscriptionId` in your DB
- Treat webhooks as source of truth; redirect URL is for UX only
- For B2B: capture VAT number at checkout, Paddle validates via VIES
- Use **price overrides** (`unitPriceOverrides`) sparingly — easier to create distinct Prices

## Common Pitfalls

- Hardcoded `Environment.production` in dev → real charges
- Webhook signature verification skipped → forgery vulnerability
- Granting access on success_url redirect → user closes tab, access not provisioned
- Forgetting `effectiveFrom: 'next_billing_period'` on cancel/pause → immediate cutoff surprises customer
- Mixing test/prod price IDs in same env vars

## Resources

- Docs: https://developer.paddle.com
- LLM-friendly: https://developer.paddle.com/llms.txt
- API: https://developer.paddle.com/api-reference
- Paddle.js: https://developer.paddle.com/paddlejs
- Retain: https://www.paddle.com/platform/retain
- Sandbox: https://sandbox-vendors.paddle.com
