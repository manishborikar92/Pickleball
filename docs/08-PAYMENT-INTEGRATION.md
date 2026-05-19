# Pickleball Platform — Payment Integration (PhonePe PG v2 + Wallet)

This document covers the complete payment and checkout lifecycle for the web platform, including PhonePe Standard Checkout API v2, wallet credit system integration, refund flows, failure recovery, idempotency, webhook handling, reconciliation, and all edge cases.

> **Scope:** Website (Next.js frontend + Express.js backend). This is not a mobile app. The Flutter SDK integration described in the original research document does not apply — no `startTransaction()`, no SDK callbacks, no `INTERRUPTED` state. The web integration uses PhonePe's redirect/iFrame pay page flow.

---

## 1. Integration Architecture

### 1.1 Web Flow vs. Flutter Flow

| Concern | Flutter SDK | Web (This Platform) |
|---|---|---|
| Pay page presentation | Native SDK `startTransaction()` | Redirect or iFrame via JS bundle |
| Payment result delivery | SDK callback (`SUCCESS`/`FAILURE`/`INTERRUPTED`) | Browser redirect back to `redirectUrl` |
| Verification trigger | App calls backend after SDK callback | Backend redirect handler + webhook |
| `INTERRUPTED` state | Possible (app backgrounded) | Not applicable |

### 1.2 System Architecture

```
Next.js Frontend                Express.js Backend              PhonePe PG
      │                                  │                           │
      │── POST /api/payment/initiate ───►│                           │
      │                                  │── GET /oauth/token ──────►│
      │                                  │◄── { access_token } ──────│
      │                                  │                           │
      │                                  │── POST /checkout/v2/pay ─►│
      │                                  │◄── { redirectUrl } ───────│
      │◄── { redirectUrl, orderId } ─────│                           │
      │                                  │                           │
      │  [Load PhonePe JS bundle]        │                           │
      │  PhonePeCheckout.transact()      │                           │
      │────────────── iFrame / Redirect ────────────────────────────►│
      │                                  │                           │  User pays
      │◄──────────── Redirect to redirectUrl ────────────────────────│
      │                                  │                           │
      │── GET /api/payment/redirect ────►│                           │
      │                                  │── GET /checkout/v2/order ►│
      │                                  │◄── { state: COMPLETED } ──│
      │                                  │  [Confirm booking]        │
      │◄── Redirect to /booking/success ─│                           │
      │                                  │◄── Webhook (S2S) ─────────│
      │                                  │  [Idempotent confirm]     │
```

### 1.3 Payment Modes — UPI Only

Only UPI payment modes are enabled. This is configured via `paymentModeConfig.enabledPaymentModes` in the Create Payment request body:

```json
"paymentModeConfig": {
  "enabledPaymentModes": [
    { "type": "UPI_INTENT" },
    { "type": "UPI_COLLECT" },
    { "type": "UPI_QR" }
  ]
}
```

- **`UPI_INTENT`** — Redirects to installed UPI apps (PhonePe, GPay, Paytm, etc.) — works on mobile browsers.
- **`UPI_COLLECT`** — User enters a VPA (e.g., `user@ybl`); PhonePe sends a collect request — works on desktop and mobile.
- **`UPI_QR`** — QR code for scanning — shown on desktop view only by PhonePe's page.

Cards and net banking are not included in `enabledPaymentModes`. PhonePe will show only the three UPI instruments listed.

---

## 2. Credentials & Environments

### 2.1 Credentials (from `business.phonepe.com → Developer Settings → API Keys`)

| Credential | Used For |
|---|---|
| `PHONEPE_CLIENT_ID` | OAuth token generation |
| `PHONEPE_CLIENT_SECRET` | OAuth token generation — **backend only, never exposed to frontend** |
| `PHONEPE_CLIENT_VERSION` | OAuth token generation (integer) |
| `PHONEPE_MERCHANT_ID` | Stored in orders for reference; used in status checks |
| `PHONEPE_WEBHOOK_USERNAME` | Webhook auth verification |
| `PHONEPE_WEBHOOK_PASSWORD` | Webhook auth verification |

### 2.2 Environment URLs

| Operation | UAT URL | Production URL |
|---|---|---|
| OAuth Token | `https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token` | `https://api.phonepe.com/apis/identity-manager/v1/oauth/token` |
| Create Payment | `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay` | `https://api.phonepe.com/apis/pg/checkout/v2/pay` |
| Order Status | `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/{merchantOrderId}/status` | `https://api.phonepe.com/apis/pg/checkout/v2/order/{merchantOrderId}/status` |
| Initiate Refund | `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/refund` | `https://api.phonepe.com/apis/pg/checkout/v2/order/refund` |

> Note: The `v2` Create Payment endpoint (`/checkout/v2/pay`) is common for both UAT and Production — the base URL changes but the path is the same.

### 2.3 SDK Node.js Installation

PhonePe's backend SDK is not published on npm. Install from their private cloud repository:

```
npm install https://phonepe.mycloudrepo.io/public/repositories/phonepe-pg-sdk-node/releases/v2/phonepe-pg-sdk-node.tgz
```

The SDK (`pg-sdk-node`) wraps the auth token caching, order creation, status check, and refund APIs into a `StandardCheckoutClient`. Using the SDK is recommended over raw `axios` calls to reduce auth-token management complexity.

### 2.4 Environment Variables

```env
PHONEPE_CLIENT_ID=
PHONEPE_CLIENT_SECRET=
PHONEPE_CLIENT_VERSION=1
PHONEPE_MERCHANT_ID=
PHONEPE_ENV=SANDBOX              # SANDBOX | PRODUCTION
PHONEPE_WEBHOOK_USERNAME=
PHONEPE_WEBHOOK_PASSWORD=
FRONTEND_BASE_URL=https://besanagpur.com
BACKEND_BASE_URL=https://api.besanagpur.com
```

---

## 3. Complete Checkout Flow

### 3.1 Price Quote & Wallet Application (Pre-Payment)

Before any interaction with PhonePe, the backend computes the complete price quote:

```
total_payable = base_amount + modifier_amount - coupon_discount - credits_applied + tax_amount
phonepe_amount = total_payable - credits_applied
```

**Three cases for `credits_applied`:**

| Scenario | Logic |
|---|---|
| User has no wallet credits | `credits_applied = 0`; full `total_payable` goes to PhonePe |
| Wallet covers the entire amount | `credits_applied = total_payable`; `phonepe_amount = 0`; skip PhonePe entirely |
| Wallet partially covers | `credits_applied = users.wallet_credits` (full balance); `phonepe_amount = total_payable - credits_applied` |

**Minimum PhonePe amount:** The API requires the amount to be at least **₹1 (100 paisa)**. If `phonepe_amount` is between ₹0.01 and ₹0.99 due to rounding, deduct one extra paisa from wallet credits to bring it to ₹0 (wallet-only path) or adjust the applied credit to bring the PhonePe amount up to ₹1.

### 3.2 Wallet-Only Payment (Zero PhonePe Involvement)

When `credits_applied == total_payable`:

1. Backend verifies the user has sufficient `wallet_credits`.
2. Database transaction:
   - Deduct `credits_applied` from `users.wallet_credits`.
   - Insert `wallet_transactions` record (type: `credit_redeemed`).
   - Update `bookings.status` → `confirmed`.
   - Insert `payments` record with `gateway = 'wallet'`, `status = 'success'`, `amount = 0`.
3. Trigger booking confirmation flow (WhatsApp notification, PostHog event).
4. No PhonePe API call is made.

### 3.3 Standard UPI Payment Flow (Step by Step)

**Step 1 — Frontend: User clicks "Confirm & Pay"**

Frontend sends to backend:
```json
POST /api/payment/initiate
{
  "booking_id": "<uuid>",
  "use_wallet_credits": true
}
```

**Step 2 — Backend: Validate & Build Quote**

- Verify booking is in `pending_payment` state and not expired.
- Verify `waiver_accepted = true`.
- Look up user's `wallet_credits`.
- Compute the full price quote (see Section 3.1).
- If `phonepe_amount == 0`, execute wallet-only path and return `{ type: "wallet_only", booking_id }`.

**Step 3 — Backend: Create PhonePe Order**

If `phonepe_amount > 0`:

```javascript
const merchantOrderId = `PP-${bookingId.replace(/-/g,'').slice(0,20)}`;

const payload = {
  merchantOrderId,
  amount: phonepe_amount_in_paisa,  // phonepe_amount * 100, integer
  expireAfter: 600,                  // 10 minutes (matches our slot hold TTL)
  metaInfo: {
    udf1: booking_id,
    udf2: user_id,
  },
  paymentFlow: {
    type: 'PG_CHECKOUT',
    message: `Court booking — ${court_name} ${slot_date} ${slot_start_time}`,
    merchantUrls: {
      redirectUrl: `${BACKEND_BASE_URL}/api/payment/redirect?orderId=${merchantOrderId}`,
    },
    paymentModeConfig: {
      enabledPaymentModes: [
        { type: 'UPI_INTENT' },
        { type: 'UPI_COLLECT' },
        { type: 'UPI_QR' },
      ],
    },
  },
};
```

Save to `payments` table:
```
gateway_order_id = merchantOrderId
status = 'initiated'
amount = phonepe_amount
idempotency_key = merchantOrderId
```

Also record the `credits_applied` amount and lock it (deduct from `users.wallet_credits` optimistically, to be rolled back on failure).

**Step 4 — Backend: Return redirectUrl**

```json
{
  "type": "phonepe",
  "merchant_order_id": "PP-abc123",
  "redirect_url": "https://mercury-uat.phonepe.com/transact/uat_v2?token=...",
  "credits_applied": 200.00,
  "phonepe_amount": 4260.40,
  "total_amount": 4460.40,
  "expires_at": "2025-05-17T09:20:00Z"
}
```

**Step 5 — Frontend: Invoke PhonePe Pay Page**

Load PhonePe JS bundle (add to checkout page `<head>` or lazy-load):

```html
<script src="https://mercury.phonepe.com/web/bundle/checkout.js"></script>
```

Use iFrame mode (recommended — user stays on the platform's page):

```javascript
function openPhonePePayPage(redirectUrl) {
  if (window.PhonePeCheckout && window.PhonePeCheckout.transact) {
    window.PhonePeCheckout.transact({
      tokenUrl: redirectUrl,
      callback: handlePhonePeCallback,
      type: 'IFRAME',         // or 'REDIRECT' for full-page redirect
    });
  }
}

function handlePhonePeCallback(response) {
  if (response === 'USER_CANCEL') {
    // User closed the iFrame; poll for status or show retry
    showPaymentCancelled();
  } else if (response === 'CONCLUDED') {
    // Transaction in terminal state; verify with backend
    verifyPaymentWithBackend(merchantOrderId);
  }
}
```

> **Redirect mode** (`type: 'REDIRECT'`): Use this as fallback if iFrame fails. PhonePe navigates the entire browser window to the pay page, then redirects back to `redirectUrl` when done. For mobile browsers, this is often more reliable than iFrame.

> **Never launch the pay page in a new tab/window.** PhonePe requires either iFrame or redirect. Opening in a new window breaks the referrer and leads to blank merchant URL errors.

**Step 6 — PhonePe: User Completes UPI Payment**

PhonePe's hosted page handles all UPI logic: intent (opens installed UPI apps), collect (VPA entry), or QR display. The platform has no role here.

**Step 7 — PhonePe: Browser Redirect Back**

After the transaction reaches a terminal state, PhonePe redirects the browser to the `redirectUrl` specified in the Create Payment request:

```
GET https://api.besanagpur.com/api/payment/redirect?orderId=PP-abc123
```

> The redirect is informational only. Never confirm the booking based on this redirect alone. Always verify via Order Status API.

**Step 8 — Backend: Redirect Handler**

```javascript
// GET /api/payment/redirect
router.get('/redirect', async (req, res) => {
  const { orderId } = req.query;

  const status = await verifyOrderStatus(orderId);

  if (status === 'COMPLETED') {
    // Confirm booking (idempotent)
    await confirmBooking(orderId);
    return res.redirect(`${FRONTEND_BASE_URL}/booking/success?orderId=${orderId}`);
  } else if (status === 'FAILED') {
    await handlePaymentFailure(orderId);
    return res.redirect(`${FRONTEND_BASE_URL}/booking/failed?orderId=${orderId}`);
  } else {
    // PENDING — payment still processing; show pending page, webhook will follow
    return res.redirect(`${FRONTEND_BASE_URL}/booking/pending?orderId=${orderId}`);
  }
});
```

**Step 9 — Webhook (Primary Confirmation)**

PhonePe fires a server-to-server webhook when the order reaches a terminal state (see Section 6).

---

## 4. Auth Token Management

The OAuth token is long-lived (check `expires_at` epoch). Cache it server-side; never re-fetch per request.

```javascript
// src/features/payment/phonepeAuth.js

const axios = require('axios');
const qs = require('qs');

let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && tokenCache.expiresAt > now + 60) {
    return tokenCache.token;  // Return cached token if valid for >60s
  }

  const response = await axios.post(
    process.env.PHONEPE_AUTH_URL,
    qs.stringify({
      client_id: process.env.PHONEPE_CLIENT_ID,
      client_version: process.env.PHONEPE_CLIENT_VERSION,
      client_secret: process.env.PHONEPE_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, expires_at } = response.data;
  tokenCache = { token: access_token, expiresAt: expires_at };
  return access_token;
}
```

**Token error recovery:** If any PhonePe API call returns `401 Unauthorized`, immediately invalidate the cache (`tokenCache = { token: null, expiresAt: 0 }`) and retry once with a freshly fetched token. Do not retry more than once per request to avoid infinite loops on a real credential failure.

---

## 5. Order Status Verification

Always use this to determine the true payment state. Never trust the browser redirect or iFrame callback alone.

**Endpoint:** `GET /checkout/v2/order/{merchantOrderId}/status`

**Headers:**
```
Authorization: O-Bearer {access_token}
Content-Type: application/json
```

**Response states:**

| `state` | Meaning | Action |
|---|---|---|
| `COMPLETED` | Payment successful | Confirm booking |
| `FAILED` | Payment failed | Release wallet hold; show failure UI |
| `PENDING` | Still processing | Do not confirm; wait for webhook |
| `CREATED` | Order created but not attempted | Payment not started yet |

```javascript
async function verifyOrderStatus(merchantOrderId) {
  const token = await getAccessToken();
  const url = `${PG_BASE_URL}/checkout/v2/order/${merchantOrderId}/status`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `O-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data.state;  // 'COMPLETED' | 'FAILED' | 'PENDING' | 'CREATED'
}
```

---

## 6. Webhook Handling

Webhooks are the **primary** confirmation mechanism. The redirect handler is the secondary. Both must process booking confirmation idempotently.

### 6.1 Webhook Setup

In `business.phonepe.com → Developer Settings → Webhook`:
- **Webhook URL:** `https://api.besanagpur.com/api/webhooks/phonepe`
- **Username / Password:** Values used in SHA256 auth header verification.
- **Subscribe to events:** `checkout.order.completed`, `checkout.order.failed`, `pg.refund.accepted`, `pg.refund.completed`, `pg.refund.failed`.

### 6.2 Webhook Authorization Verification

PhonePe signs webhook requests by sending an `Authorization` header:

```
Authorization: SHA256(username + ":" + password)
```

Verify on every webhook request before processing:

```javascript
const crypto = require('crypto');

function verifyWebhookAuth(authHeader) {
  const expected = crypto
    .createHash('sha256')
    .update(`${process.env.PHONEPE_WEBHOOK_USERNAME}:${process.env.PHONEPE_WEBHOOK_PASSWORD}`)
    .digest('hex');
  return authHeader === expected;
}
```

Reject with `401` if verification fails.

### 6.3 Webhook Payload

```json
{
  "event": "checkout.order.completed",
  "payload": {
    "orderId": "OMO...",
    "merchantId": "YOUR_MERCHANT_ID",
    "merchantOrderId": "PP-abc123",
    "state": "COMPLETED",
    "amount": 45000,
    "expireAt": 1724866793837,
    "metaInfo": { "udf1": "<booking_id>", "udf2": "<user_id>" },
    "paymentDetails": [
      {
        "paymentMode": "UPI_INTENT",
        "transactionId": "OM...",
        "timestamp": 1724866793837,
        "amount": 45000,
        "state": "COMPLETED",
        "splitInstruments": [
          {
            "amount": 45000,
            "rail": { "type": "UPI", "upiTransactionId": "4293...", "vpa": "user@ybl" },
            "instrument": { "type": "ACCOUNT", "accountType": "SAVINGS" }
          }
        ]
      }
    ]
  }
}
```

### 6.4 Webhook Handler

```javascript
// POST /api/webhooks/phonepe
router.post('/phonepe', express.json(), async (req, res) => {
  // 1. Verify auth header immediately
  if (!verifyWebhookAuth(req.headers['authorization'])) {
    return res.status(401).end();
  }

  // 2. Respond 200 immediately — before any processing
  // PhonePe will retry if it doesn't receive 200 quickly
  res.status(200).end();

  // 3. Process asynchronously
  try {
    const { event, payload } = req.body;
    const { merchantOrderId, state } = payload;

    // Always use payload.state, not just the event name
    if (event === 'checkout.order.completed' && state === 'COMPLETED') {
      await handlePaymentSuccess(merchantOrderId, payload);
    } else if (event === 'checkout.order.failed' || state === 'FAILED') {
      await handlePaymentFailure(merchantOrderId, payload);
    } else if (event === 'pg.refund.completed') {
      await handleRefundCompleted(payload);
    } else if (event === 'pg.refund.failed') {
      await handleRefundFailed(payload);
    }
  } catch (err) {
    // Log error — do NOT surface to PhonePe (already responded 200)
    console.error('Webhook processing error:', err);
  }
});
```

### 6.5 Idempotent Booking Confirmation

```javascript
async function handlePaymentSuccess(merchantOrderId, payload) {
  // Check idempotency_key — if already processed, skip silently
  const payment = await db.payments.findOne({ idempotency_key: merchantOrderId });

  if (!payment || payment.status === 'success') {
    return; // Already confirmed — idempotent exit
  }

  await db.transaction(async (trx) => {
    // Update payment record
    await trx.payments.update(
      { idempotency_key: merchantOrderId },
      {
        status: 'success',
        gateway_payment_id: payload.paymentDetails[0]?.transactionId,
        webhook_received_at: new Date(),
        raw_webhook_payload: payload,
      }
    );

    // Confirm booking
    const bookingId = payload.metaInfo?.udf1;
    const booking = await trx.bookings.findOne({ id: bookingId });

    if (booking.status === 'confirmed') return; // Already confirmed via redirect handler

    await trx.bookings.update(
      { id: bookingId },
      { status: 'confirmed', expires_at: null }
    );

    // Finalize wallet deduction (was held optimistically)
    await finalizeWalletDeduction(trx, bookingId);

    // Emit booking_confirmed event to PostHog (server-side)
    // Send WhatsApp confirmation to user
  });
}
```

### 6.6 Webhook Event Types

| Event | Trigger |
|---|---|
| `checkout.order.completed` | Order paid and COMPLETED |
| `checkout.order.failed` | Payment failed |
| `pg.refund.accepted` | Refund accepted by PhonePe for processing |
| `pg.refund.completed` | Refund credited to customer's UPI |
| `pg.refund.failed` | Refund processing failed |

### 6.7 Critical Webhook Rules

- **Always use `payload.state`** to determine terminal state — do not rely solely on the event name.
- **Always use the top-level `event` field** to identify event type — ignore any `type` field inside `payload`.
- **Do not use strict deserialization** — PhonePe may add new fields without notice; use a permissive JSON parser.
- **Respond `200` before processing** — any processing errors after the 200 response must be logged but not re-thrown.
- `expireAt` and `timestamp` are in **epoch milliseconds**, not seconds.

---

## 7. Refund Flow

### 7.1 When Refunds Are Initiated (Platform-Triggered Only)

| Scenario | Refund Type | Amount |
|---|---|---|
| Stale/phantom payment (webhook arrives after slot expiry and rebooking) | Full refund via PhonePe | `payments.amount` |
| Force majeure cancellation where user opts for bank refund | Full PhonePe refund | `payments.amount` |
| Admin error correction | Full or partial PhonePe refund | As determined |

**Standard policy:** The platform does not offer cash refunds on cancellation — credits are issued instead (see Section 8). PhonePe refunds are reserved for platform-initiated exceptional scenarios.

### 7.2 Initiate Refund API

**Endpoint:** `POST /checkout/v2/order/refund`

**Headers:**
```
Authorization: O-Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "merchantRefundId": "REF-<uuid>",
  "originalMerchantOrderId": "PP-abc123",
  "amount": 45000
}
```

| Parameter | Type | Description |
|---|---|---|
| `merchantRefundId` | String | Unique per refund; use UUID. Never reuse for different refunds. |
| `originalMerchantOrderId` | String | The `merchantOrderId` of the original payment order |
| `amount` | Integer (paisa) | Refund amount. Cannot exceed original order amount. Partial refunds allowed. |

### 7.3 Refund Idempotency

Generate `merchantRefundId` before calling the API. Store it in `payments.refund_id` before initiating. If the API call fails mid-response (network timeout), use the same `merchantRefundId` on retry — PhonePe will deduplicate.

### 7.4 Refund Status Tracking

Refunds are tracked via webhooks:
- `pg.refund.accepted` → update `payments.status = 'refund_pending'`
- `pg.refund.completed` → update `payments.status = 'refunded'`, record `refund_amount` and `refund_initiated_at`
- `pg.refund.failed` → update `payments.status = 'refund_failed'`; alert admin; optionally fall back to wallet credits

**Refund timeline:** UPI refunds typically settle in 24–48 hours. Notify the user via WhatsApp when `pg.refund.completed` is received.

---

## 8. Wallet Credits — Full Lifecycle

### 8.1 Credit Issuance (Force Majeure Cancellation)

When the admin cancels a booking due to a business failure:

```javascript
async function issueCancellationCredits(bookingId, reason, adminId) {
  await db.transaction(async (trx) => {
    const booking = await trx.bookings.findOne({ id: bookingId, status: 'confirmed' });
    const creditAmount = booking.total_amount;  // Full amount as credits

    // Increment user wallet balance
    await trx.users.increment({ id: booking.user_id }, 'wallet_credits', creditAmount);

    // Record transaction
    const newBalance = await trx.users.getBalance(booking.user_id);
    await trx.wallet_transactions.insert({
      user_id: booking.user_id,
      booking_id: bookingId,
      type: 'credit_issued',
      amount: creditAmount,
      balance_after: newBalance,
      reason,
    });

    // Cancel booking
    await trx.bookings.update({ id: bookingId }, { status: 'cancelled' });
  });

  // Send WhatsApp notification
}
```

### 8.2 Credit Redemption (During Checkout)

Credits are applied before the PhonePe order is created:

```javascript
async function applyWalletCredits(bookingId, userId, totalPayable) {
  const user = await db.users.findOne({ id: userId });
  const creditsApplied = Math.min(user.wallet_credits, totalPayable);
  const phonepeAmount = totalPayable - creditsApplied;

  // Optimistically deduct wallet balance (held until payment completes or rolls back)
  await db.users.decrement({ id: userId }, 'wallet_credits', creditsApplied);
  await db.wallet_transactions.insert({
    user_id: userId,
    booking_id: bookingId,
    type: 'credit_redeemed',
    amount: creditsApplied,
    balance_after: user.wallet_credits - creditsApplied,
    reason: 'Applied during checkout',
  });
  await db.bookings.update({ id: bookingId }, { credits_applied: creditsApplied });

  return { creditsApplied, phonepeAmount };
}
```

### 8.3 Credit Rollback on Payment Failure

If the PhonePe payment fails or expires, the held wallet credits must be returned:

```javascript
async function rollbackWalletCredits(bookingId) {
  const booking = await db.bookings.findOne({ id: bookingId });
  if (booking.credits_applied === 0) return;

  await db.transaction(async (trx) => {
    await trx.users.increment({ id: booking.user_id }, 'wallet_credits', booking.credits_applied);
    const newBalance = await trx.users.getBalance(booking.user_id);
    await trx.wallet_transactions.insert({
      user_id: booking.user_id,
      booking_id: bookingId,
      type: 'credit_issued',
      amount: booking.credits_applied,
      balance_after: newBalance,
      reason: 'Rollback: payment failed or expired',
    });
    await trx.bookings.update({ id: bookingId }, { credits_applied: 0 });
  });
}
```

---

## 9. Payment Failure & Retry

### 9.1 Payment Failure Flow

When `state === 'FAILED'` is received (via redirect handler or webhook):

1. Call `rollbackWalletCredits(bookingId)` to restore the held credits.
2. Update `payments.status = 'failed'`.
3. **Do NOT expire the booking hold** automatically — give the user a chance to retry with the same booking.
4. Frontend shows failure UI with a "Try Again" button.

### 9.2 Retry Logic

When the user clicks "Try Again":
- Check that the booking `expires_at` has not passed.
- If still valid: create a **new** `merchantOrderId` (never reuse the failed order ID). Insert a new `payments` record linked to the same `booking_id`. Call Create Payment API again.
- If `expires_at` has passed: inform the user the slot hold expired, redirect them back to the booking page.

**Max retries:** The platform does not limit payment retries as long as the slot hold is valid (within 10 minutes).

### 9.3 PENDING State Handling

If the Order Status API returns `PENDING`:

- The payment is still being processed by the bank or UPI system.
- Show a "Payment Processing" screen to the user.
- Start a polling loop (every 5 seconds, max 5 polls):
  - If status changes to COMPLETED: confirm booking.
  - If status changes to FAILED: run failure flow.
  - If still PENDING after 5 polls: stop polling; inform user to wait; rely on webhook for eventual resolution.
- **Do not cancel or assume failure while PENDING.**
- Do not release wallet credits while PENDING.

### 9.4 ORDER_EXPIRED Error

If the user takes longer than `expireAfter` (600 seconds / 10 minutes) to complete payment:
- The slot hold will also be expired by the background sweeper.
- Redirect to booking page with message: "Your session timed out. Please select a slot again."
- Run wallet credit rollback.

---

## 10. The Stale Payment (Phantom Booking)

This is the most critical edge case. See also `03-BUSINESS-LOGIC.md` Section 5.1 for the full description.

**Trigger:** Payment success webhook arrives after the slot hold has expired AND the slot has been rebooked by another user.

**Detection:** In `handlePaymentSuccess()`, after confirming COMPLETED state:

```javascript
const booking = await db.bookings.findOne({ gateway_order_id: merchantOrderId });

if (booking.status === 'expired') {
  // Check if slot is now taken by another booking
  const conflictingBooking = await db.bookings.findOne({
    court_id: booking.court_id,
    slot_date: booking.slot_date,
    slot_start_time: booking.slot_start_time,
    status: ['confirmed', 'walk_in'],
  });

  if (conflictingBooking) {
    // Cannot confirm — initiate refund
    await initiatePhonePeRefund(merchantOrderId, booking.total_amount - booking.credits_applied);
    await rollbackWalletCredits(booking.id);
    await notifyAdminOfPhantomBooking(booking);
    await sendPhantomBookingApologyWhatsApp(booking.user_id);
  }
}
```

---

## 11. Settlement & Reconciliation

### 11.1 Settlement Timeline

PhonePe settles funds to the merchant's bank account. The settlement timeline depends on the merchant's plan (typically T+1 or T+2 business days for UPI). Settlement details are available in the PhonePe Business Dashboard.

### 11.2 Daily Reconciliation

Run a daily background job (after midnight) that:

1. Queries all `payments` records with `status = 'success'` and `created_at` within the previous settlement window.
2. Downloads the settlement report from PhonePe Business Dashboard (or via the Settlement API if enabled by PhonePe for the merchant's plan).
3. Cross-references `payments.gateway_payment_id` against the settlement report's transaction IDs.
4. Flags any discrepancy to the admin (booking confirmed but not in settlement, or in settlement but not confirmed).

### 11.3 Missing Webhook Recovery

A background job runs every 5 minutes to find `payments` records stuck in `status = 'initiated'` for more than 15 minutes:

```javascript
// Find stale initiated payments
const stalePayments = await db.payments.findAll({
  status: 'initiated',
  created_at: { lt: new Date(Date.now() - 15 * 60 * 1000) },
});

for (const payment of stalePayments) {
  const state = await verifyOrderStatus(payment.idempotency_key);
  if (state === 'COMPLETED') {
    await handlePaymentSuccess(payment.idempotency_key, {});
  } else if (state === 'FAILED') {
    await handlePaymentFailure(payment.idempotency_key, {});
  }
  // If PENDING: leave for next cycle
}
```

---

## 12. Security Considerations

| Concern | Implementation |
|---|---|
| `client_secret` never in frontend | Backend only; stored in `.env` and accessed only in `phonepeAuth.js` |
| Auth token never sent to browser | The `access_token` is used only for backend-to-PhonePe calls; frontend receives only `redirectUrl` |
| Webhook auth verification | SHA256 header verified on every incoming webhook before any processing |
| Payment amount set by backend | The amount in the Create Payment request is always set server-side from the database quote, never from a frontend-provided value |
| `merchantOrderId` uniqueness | UUID-based; stored with a `UNIQUE` constraint in `payments.idempotency_key` |
| No-referrer-policy | Ensure the checkout page does not have a `no-referrer-policy` meta tag; PhonePe requires a referrer to be present |
| HTTPS only | Both `redirectUrl` and webhook URL must be HTTPS in production |
| Idempotent webhook processing | Check `payments.status` before confirming; skip if already `success` |
| Wallet deduction atomicity | Wallet balance changes and booking confirmation are always in a single database transaction |

---

## 13. Module Structure

```
src/features/payment/
├── phonepeAuth.js           ← Token fetch + cache
├── phonepeClient.js         ← SDK wrapper (StandardCheckoutClient)
├── payment.service.js       ← Business logic (initiate, confirm, refund, rollback)
├── wallet.service.js        ← Credit issuance, redemption, rollback
├── routes/
│   ├── payment.routes.js    ← /initiate, /redirect, /status/:orderId
│   └── webhook.routes.js    ← POST /webhooks/phonepe (GET for health check)
└── reconciliation.job.js    ← Nightly settlement reconciliation
```

---

## 14. UAT Testing Checklist

### Sandbox Credentials

| Field | Value |
|---|---|
| Merchant ID | `PGTESTPAYUAT` or `PGTESTPAYUAT86` |
| Auth URL | `https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token` |
| PG Base URL | `https://api-preprod.phonepe.com/apis/pg-sandbox` |

Install the **PhonePe Test App** on a device during UAT. Standard PhonePe app cannot be used on sandbox. Contact `merchant-integration@phonepe.com` for the test app and UAT SIM credentials.

### Test Scenarios

| Scenario | Steps |
|---|---|
| Successful UPI payment (full) | Select slot → Checkout → Confirm → Pay via UPI in test app → Verify booking confirmed |
| Wallet-only payment | Seed test user with credits >= total → Checkout → Verify no PhonePe redirect → Verify booking confirmed |
| Partial wallet + UPI | Seed user with partial credits → Checkout → Verify PhonePe amount = total - credits → Pay → Verify booking confirmed and credits deducted |
| Payment failure | Initiate → Cancel in pay page → Verify slot still held → Retry succeeds |
| Slot expiry before payment | Let 10-minute hold expire → Attempt payment redirect → Verify slot released |
| Phantom booking | Expire slot, rebook it → Trigger late success webhook → Verify refund initiated |
| Duplicate webhook | Send same webhook payload twice → Verify booking confirmed only once |
| Webhook auth failure | Send webhook with wrong auth header → Verify 401 response |
| UPI-only mode | Verify PhonePe pay page shows only UPI options (no cards, no net banking) |
| Refund flow | Admin initiates refund → Verify `pg.refund.completed` webhook updates payment record |

### Go-Live Checklist

- [ ] Switch `PHONEPE_ENV=PRODUCTION` in backend `.env`
- [ ] Obtain production `client_id`, `client_secret`, `merchantId` from dashboard
- [ ] Configure production webhook URL in PhonePe Business Dashboard
- [ ] Update JS bundle URL from mercury-uat to `https://mercury.phonepe.com/web/bundle/checkout.js`
- [ ] Submit UAT test evidence to PhonePe for merchant approval
- [ ] Verify HTTPS on both redirect URL and webhook URL
- [ ] Set up daily settlement reconciliation job
- [ ] Set up missing webhook recovery job (runs every 5 minutes)
- [ ] Confirm refund flow with production credentials
- [ ] Verify `no-referrer-policy` is NOT set on checkout page
