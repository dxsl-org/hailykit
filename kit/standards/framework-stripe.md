# Stripe Standards

Detected via `stripe` in `package.json` deps (Node) or `stripe` in Python `requirements.txt` / `pyproject.toml`.

## When to Use Stripe

- Custom checkout flows (Payment Element, Express Checkout)
- Marketplace / multi-party payments (Connect)
- Complex billing logic, usage-based pricing, metered billing
- Enterprise PCI compliance requirements
- Global card processing with high control

Not the right pick for:
- Tax compliance / MoR (use Paddle, Polar, or Creem instead)
- Vietnamese bank transfers (use SePay)

## Install

```bash
npm install stripe @stripe/stripe-js
# or
pip install stripe
```

## Core Architecture

| Object | Purpose |
|---|---|
| `PaymentIntent` | Single payment (one-shot or after subscription invoice) |
| `SetupIntent` | Save card without charging — used for future off-session payments |
| `Customer` | Persistent record tied to email; holds payment methods + subscriptions |
| `PaymentMethod` | A card / bank / wallet attached to a customer |
| `Subscription` | Recurring billing tied to a Price |
| `Invoice` | Generated from subscription, lists line items |
| `Checkout Session` | Stripe-hosted checkout page (easiest integration) |

## Checkout Sessions (Hosted Checkout)

Easiest path — Stripe hosts the page:

```ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const session = await stripe.checkout.sessions.create({
  mode: 'subscription',                 // or 'payment' (one-time), 'setup' (save card)
  line_items: [{ price: 'price_xyz', quantity: 1 }],
  success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/cancel`,
  customer_email: 'user@example.com',   // pre-fill
  client_reference_id: userId,           // links session back to your DB
});
return Response.redirect(session.url!);
```

## Payment Element (Embedded Checkout)

When you need branded checkout in your own UI:

```tsx
// Server: create PaymentIntent
const intent = await stripe.paymentIntents.create({
  amount: 1999,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
});
return { clientSecret: intent.client_secret };

// Client
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK!);

<Elements stripe={stripePromise} options={{ clientSecret }}>
  <CheckoutForm />
</Elements>
```

In `CheckoutForm`, `stripe.confirmPayment({ elements, confirmParams: { return_url } })`.

## Subscriptions

```ts
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: 'price_xyz' }],
  payment_behavior: 'default_incomplete',  // creates pending invoice if no card
  expand: ['latest_invoice.payment_intent'],
});
```

**Lifecycle states:** `trialing` → `active` → `past_due` / `unpaid` → `canceled`. Watch `customer.subscription.updated` webhook.

## Webhooks (CRITICAL)

Webhooks are the source of truth for payment status — never rely on success_url redirects alone (user might close the tab).

```ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':       /* mark order paid */ break;
    case 'invoice.paid':                      /* extend subscription */ break;
    case 'invoice.payment_failed':            /* notify user, dunning */ break;
    case 'customer.subscription.deleted':     /* revoke access */ break;
  }
  return new Response('ok');
}
```

**Idempotency:** Stripe may deliver the same event twice. Store `event.id` in DB; skip if already processed.

**Verify signature** — never skip. Without it, attackers can forge webhooks and grant themselves access.

## Connect (Marketplaces)

For platforms where you charge customers and pay out to vendors:
- **Standard accounts** — vendors have full Stripe dashboard, you take application fee
- **Express accounts** — Stripe-hosted onboarding, lighter dashboard
- **Custom accounts** — you handle all UI; required PCI compliance level rises
- Transfers: `stripe.transfers.create({ amount, currency, destination: vendorAccount })`
- Application fees: `payment_intent_data: { application_fee_amount: 200, transfer_data: { destination: vendorAccount } }`

## Testing

- Test mode: `sk_test_*` keys, separate webhook endpoint
- Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (insufficient funds), full list at https://stripe.com/docs/testing
- **Stripe CLI** for local webhook testing:
  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  stripe trigger checkout.session.completed
  ```

## Security

- API keys in env vars only; never commit `sk_test_*` or `sk_live_*`
- Use **restricted API keys** (Dashboard → Developers → API keys → Create restricted key) for narrow-scope server work
- Webhook secret per endpoint — separate test/prod secrets
- Always verify webhook signature with constant-time comparison
- HTTPS-only in production; Stripe rejects insecure webhook URLs

## Best Practices

- **Save customer in DB before** creating Stripe Customer — use `client_reference_id` to link
- Store Stripe IDs (`customer.id`, `subscription.id`) in your DB, not your DB ID in Stripe metadata only
- Use **idempotency keys** on retried writes: `stripe.paymentIntents.create({...}, { idempotencyKey: 'order-123' })`
- Subscription state: webhook is truth, your DB is cache — re-sync on mismatch
- Test the dunning flow (failed renewal → retry → cancel) in staging
- Use **Stripe Tax** for automated tax — handles VAT/sales tax for you

## Common Pitfalls

- Marking orders paid on `success_url` redirect → user can close tab before payment confirms; webhook is source of truth
- Skipping webhook signature verification → forgery attacks
- Not handling `payment_intent.requires_action` → 3D Secure / SCA users fail silently
- Hardcoded price amounts in code → use Stripe Prices, change pricing without redeploy
- Polling subscription status instead of listening to webhooks → rate limit issues + stale data
- Treating test mode like prod — separate keys, separate DB or namespaced records

## Resources

- Docs: https://docs.stripe.com
- LLM-friendly: https://docs.stripe.com/llms.txt
- API: https://docs.stripe.com/api
- Testing: https://docs.stripe.com/testing
- CLI: https://docs.stripe.com/stripe-cli
- Webhooks: https://docs.stripe.com/webhooks
