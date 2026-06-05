# SePay Standards

Detected via `sepay` in deps, `sepay.config.js` / `sepay.config.json` in repo root, or `VND` + Vietnamese bank context in env vars.

## When to Use SePay

- Vietnamese market — VND payments, local bank transfers
- VietQR (Vietnam's national QR standard) — works with 44+ Vietnamese banks
- Bank transfer reconciliation — SePay automates matching incoming transfers to orders
- Lower fees than international PSPs for VN-domestic transactions
- Need NAPAS / domestic card processing

**Not for:** international customers, USD/EUR billing, subscription recurring (use Stripe/Polar for global SaaS).

## Core Concept

Most Vietnamese e-commerce uses **bank transfer + manual reconciliation**: customer transfers money with a memo like "DH123" → seller checks bank statement → matches to order DH123. Slow, error-prone.

SePay automates this:
1. Customer scans VietQR with their banking app
2. Memo auto-fills with your reference (`DH123`)
3. Transfer hits your bank account
4. SePay polls/receives bank notifications → matches by memo → fires webhook to you
5. Your system marks order paid

Result: cash-equivalent UX with 30-60 second confirmation.

## Setup

```bash
npm install sepay     # if SDK published; otherwise use direct API
```

Get API token + linked bank account from Dashboard → API.

```ts
// Direct REST setup
const SEPAY_API = 'https://my.sepay.vn/userapi';
const headers = {
  Authorization: `Bearer ${process.env.SEPAY_API_TOKEN!}`,
  'Content-Type': 'application/json',
};
```

## Generate VietQR

```ts
// VietQR payload format (NAPAS spec)
function generateVietQR({ bankCode, accountNumber, amount, memo }: {
  bankCode: string;       // e.g. 'VCB' (Vietcombank), 'TCB' (Techcombank), 'MB'
  accountNumber: string;
  amount: number;         // VND (no decimals)
  memo: string;           // your order reference, e.g. 'DH123'
}): string {
  // Use img-tag service (easiest):
  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}`;
}
```

Display the QR + amount + memo in your checkout UI. User scans, bank app auto-fills.

## Reconciliation Webhooks

SePay fires a webhook when a matching transfer hits your linked bank account:

```ts
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.json();

  // Verify (SePay sends an `Authorization` header with bearer token)
  const auth = req.headers.get('authorization');
  if (auth !== `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Payload
  // {
  //   id, gateway, transactionDate, accountNumber, code, content,
  //   transferType: 'in', transferAmount: 100000, accumulated, subAccount,
  //   referenceCode, description
  // }

  const memo = body.code || extractOrderRef(body.content);
  // 'code' is parsed memo (your reference like 'DH123')
  // 'content' is raw bank statement line

  const order = await db.orders.findUnique({ where: { reference: memo } });
  if (order && body.transferAmount >= order.amount) {
    await markOrderPaid(order.id, body.id);
  }

  return new Response('ok');
}
```

**Idempotency:** Store `body.id` (SePay transaction ID) in DB — skip duplicates.

## Payment Flow (Standard)

```
[User checkout]
      ↓
[Generate VietQR with order ref + amount]
      ↓
[Display QR + poll your backend for status]
      ↓
[User scans + transfers in banking app]
      ↓ (~30-60s)
[Bank notifies SePay]
      ↓
[SePay webhook → your endpoint]
      ↓
[You mark order paid + notify frontend]
      ↓
[Customer sees success page]
```

Frontend polls `/api/orders/{id}/status` every 3-5s while QR is displayed. Stop polling on success or 15min timeout.

## Supported Banks

44+ banks, including:
- Vietcombank (VCB), Techcombank (TCB), MB Bank (MB), VPBank (VPB), ACB
- BIDV, Agribank, Sacombank, TPBank, VietinBank
- HDBank, OCB, SHB, SeABank, MSB, Eximbank
- VIB, NCB, BVB, Kienlongbank, Nam A Bank
- Full list: https://my.sepay.vn

Use bank's **BIN code** (3 digits) or **short code** (VCB, MB) in QR generation.

## API Endpoints

| Endpoint | Use |
|---|---|
| `GET /transactions/list` | List recent bank transactions |
| `GET /transactions/details/{id}` | Single transaction details |
| `GET /accounts/list` | List linked bank accounts |
| `POST /webhooks/test` | Trigger test webhook delivery |

Rate limit: **2 requests/second** per API token. For polling, use webhook instead.

## Best Practices

- Generate unique short memo per order (`DH` + numeric ID, e.g. `DH12345`) — fits in bank memo field (max 50 chars)
- Display QR + amount + memo prominently — users may type memo manually if QR scan fails
- Implement frontend polling for status (3-5s interval, 15min timeout)
- Use idempotency: store SePay transaction ID, ignore duplicate webhooks
- Verify `transferAmount >= expected` (allow overpayment, treat as paid in full)
- Underpayment: don't mark paid; alert support + send refund instructions to customer

## Security

- Webhook endpoint: validate `Authorization: Apikey ...` header — set in SePay Dashboard
- API token in env vars only
- Don't trust `content` field alone — use `code` (parsed memo) for matching
- Log raw webhook payload for audit + debugging

## Common Pitfalls

- Using `transferType: 'out'` events as paid — those are OUTGOING transfers from your account!
  Filter to `transferType === 'in'` only.
- Memo collisions: two orders share `DH1` → use longer IDs or include date
- Bank statement memos can have prefix banks add (e.g. `MBVCB.123456.DH1.XYZ`) — parse the `code` field, not raw content
- Not validating amount → customer transfers 1,000 VND instead of 100,000 VND → marked paid in full

## Combined with Card Payments

For broader reach, pair SePay (bank transfer) with card processing:
- **NAPAS** — domestic card network (ATM/credit cards from VN banks)
- **OnePay**, **Payoo**, **VNPAY** — gateways for international cards on VN sites
- Or accept Stripe/Paddle for international customers

Offer both: "Pay via VietQR" (instant, free for customer) + "Pay by card" (slight fee, works internationally).

## Resources

- Dashboard: https://my.sepay.vn
- API docs: https://docs.sepay.vn
- VietQR spec: https://vietqr.net
- VietQR generator: https://img.vietqr.io (free image service)
- NAPAS: https://napas.com.vn
