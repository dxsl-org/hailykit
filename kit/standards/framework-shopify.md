# Shopify Standards

Detected via `shopify.app.toml`, `shopify.theme.toml`, `@shopify/cli` in deps, or `.liquid` files in repo root.

## Platform Components

- **Shopify CLI** — development workflow tool (`shopify app dev`, `shopify theme dev`)
- **GraphQL Admin API** — primary API (REST is maintenance-only, do not use for new code)
- **Polaris** — Shopify's React design system, mandatory for embedded admin UIs
- **Liquid** — template language for themes
- **App Bridge** — embeds your app inside the Shopify admin iframe with session tokens

## Choose Your Surface

| Build | When |
|---|---|
| **App** | External integrations, admin tools, cross-store features, paid functionality |
| **Theme** | Custom storefront, brand-specific layouts, custom shopping experience |
| **Extension** | Customize checkout/admin/POS, discount/payment/shipping logic, embedded theme blocks |
| **App + Theme Extension** | App handles backend/data, theme extension provides storefront UI (reviews, wishlists, size guides) |

## Quick Start

```bash
npm install -g @shopify/cli@latest

# App
shopify app init
cd my-app && shopify app dev

# Theme
shopify theme init       # or pull existing
shopify theme dev         # localhost:9292

# Extension (inside an app)
shopify app generate extension
# → checkout_ui_extension, admin_action, admin_block, pos_ui_extension, function
```

## Access Scopes

`shopify.app.toml`:
```toml
[access_scopes]
scopes = "read_products,write_products,read_orders"
```

**Request minimal scopes.** Adding scopes later forces every installed merchant to re-authorize. Audit before launch.

## GraphQL Admin API

Always GraphQL, never REST. Costs are point-based — query only fields you need:

```graphql
query GetProducts($first: Int!) {
  products(first: $first) {
    edges {
      node {
        id
        title
        handle
        variants(first: 5) {
          edges { node { id price inventoryQuantity } }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Rate limits:** Read response headers `X-Shopify-Shop-Api-Call-Limit` (REST) / cost extensions field (GraphQL). Implement exponential backoff on 429. Use **bulk operations** (`bulkOperationRunQuery`) for >250 items.

## Extensions

**Checkout UI (React):**
```tsx
import { reactExtension, BlockStack, TextField, useApi } from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <Extension />);

function Extension() {
  const [message, setMessage] = useState('');
  return (
    <BlockStack>
      <TextField label="Gift Message" value={message} onChange={setMessage} />
    </BlockStack>
  );
}
```

**Extension targets** are versioned API points (e.g. `purchase.checkout.block.render`). Pin via `shopify.extension.toml` — breaking changes only on major version bumps.

**Functions** (Rust/WASM): discount, payment customization, delivery customization, validation. Compiled with `shopify app function build`.

## Themes (Liquid)

```liquid
{% for product in collection.products %}
  <div class="product-card">
    <img src="{{ product.featured_image | img_url: 'medium' }}" alt="{{ product.title }}">
    <h3>{{ product.title }}</h3>
    <p>{{ product.price | money }}</p>
    <a href="{{ product.url }}">View Details</a>
  </div>
{% endfor %}
```

**Theme structure:**
```
sections/   — reusable, configurable page sections
templates/  — page layouts (product, collection, etc.)
snippets/   — reusable Liquid fragments
config/     — theme settings schema
assets/     — CSS/JS/images
locales/    — i18n strings
```

Use **Dawn** as reference theme — Shopify's free, performance-optimized starter.

Deploy:
```bash
shopify theme push --development   # to dev theme
shopify theme push --live           # to live (irreversible — confirm!)
shopify theme publish --theme=123   # set theme as published
```

## OAuth + Session Tokens

Embedded apps use **session tokens** (JWT) over OAuth-only:
- Frontend gets a token from App Bridge: `getSessionToken(app)`
- Send as `Authorization: Bearer <token>` to your backend
- Backend verifies via `@shopify/shopify-api` Node SDK
- Exchange session token for an offline access token on first install

Never store API keys in client code. Use env vars + your backend as the credential vault.

## Webhooks

- Subscribe via Admin API mutation `webhookSubscriptionCreate`
- **Always verify HMAC signature** before processing:
  ```ts
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const calculated = crypto.createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8').digest('base64');
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(calculated))) throw new Error('Invalid');
  ```
- Mandatory webhooks for app: `customers/data_request`, `customers/redact`, `shop/redact` (GDPR)
- Respond with `200` within 5s — queue heavy work in background

## Billing

- `appSubscriptionCreate` GraphQL mutation creates a subscription
- Returns confirmation URL — redirect merchant to approve
- Webhook `app_subscriptions/update` for lifecycle events
- Use **usage-based** billing for variable pricing (per-API-call, per-email-sent)

## Best Practices

**API:**
- Prefer GraphQL over REST (REST is in maintenance mode)
- Request only fields you need (GraphQL cost model)
- Paginate with cursor-based pagination, not offset
- Use bulk operations for >250 records

**Security:**
- Store credentials in env vars, never in code or theme files
- Verify all webhook HMAC signatures
- Request minimal access scopes
- Session tokens for embedded apps, not OAuth tokens in browser

**Performance:**
- Theme: minimize Liquid logic, cache where possible, optimize images via `img_url` filter
- Extension: lazy-load heavy UI, debounce API calls
- App: cache shop data (settings, themes) with reasonable TTL

**Versioning:**
- API releases quarterly: `2025-01`, `2025-04`, `2025-07`, `2025-10`
- 12-month support window per version
- Pin version in your API client; test before upgrading

## Common Pitfalls

- Using REST API for new code — switch to GraphQL
- Missing HMAC verification on webhooks → security hole
- Requesting `*` scopes upfront → merchants distrust install screen
- Storing credentials in `shopify.app.toml` (it's committed!)
- Skipping session token verification on backend
- Not handling rate limits → 429 errors in production
- Hardcoded theme IDs in code → breaks when merchants duplicate themes

## Troubleshooting

| Symptom | Check |
|---|---|
| Rate limit errors | `X-Shopify-Shop-Api-Call-Limit` header, implement exponential backoff |
| Webhook not firing | URL accessible publicly? HMAC verification not blocking? Logs in Partner Dashboard |
| Extension not appearing | Extension target correct? Published? App installed on store? |
| OAuth failures | Scopes match `shopify.app.toml`? Redirect URL whitelisted? |
| GraphQL "throttled" | Cost too high — split query, request fewer fields |

## Resources

- Docs: https://shopify.dev/docs
- GraphQL: https://shopify.dev/docs/api/admin-graphql
- CLI: https://shopify.dev/docs/api/shopify-cli
- Polaris: https://polaris.shopify.com
- Liquid: https://shopify.dev/docs/api/liquid
- Partner Dashboard: https://partners.shopify.com
